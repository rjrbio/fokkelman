import { beforeEach, describe, expect, it, vi } from 'vitest';
import { noAnnotation } from '$lib/annotations';
import type { Photo } from '$lib/types';

const cloudinary = vi.hoisted(() => ({ updateContext: vi.fn() }));
vi.mock('./cloudinary', () => cloudinary);

import { CONTEXT_BATCH, MAX_CONTEXT_CALLS, planAnnotation, withChange, writeOperations } from './annotate';

const photo = (publicId: string, fields: Partial<Photo> = {}): Photo => ({
	publicId,
	folder: '',
	format: 'jpg',
	width: 1,
	height: 1,
	favorite: false,
	...noAnnotation(),
	...fields
});

const cfg = {} as never;

beforeEach(() => {
	cloudinary.updateContext.mockReset().mockResolvedValue(undefined);
});

describe('planAnnotation', () => {
	it('sets only the keys that change, in one group for the photos that get the same ones', () => {
		const plan = planAnnotation([photo('a'), photo('b')], { caption: 'Playa' });
		expect(plan).toMatchObject({
			ok: true,
			unchanged: [],
			calls: 1,
			operations: [{ kind: 'add', publicIds: ['a', 'b'], entries: { caption: 'Playa' } }]
		});
	});

	it('does not touch a key it is not changing, nor the keys that are not ours', () => {
		const a = photo('a', { caption: 'Playa', year: 1975, people: ['Ana'], extraContext: { alt: 'x' } });
		const plan = planAnnotation([a], { addPeople: ['Luis'] });
		expect(plan.ok && plan.operations).toEqual([{ kind: 'add', publicIds: ['a'], entries: { people: 'Ana, Luis' } }]);
	});

	it('gives different writes to photos that end up different, and skips the ones already as asked', () => {
		const plan = planAnnotation(
			[photo('a', { people: ['Ana'] }), photo('b', { people: ['Luis'] }), photo('c', { people: ['Ana', 'Luis'] })],
			{ addPeople: ['Ana'] }
		);
		expect(plan).toMatchObject({
			ok: true,
			unchanged: ['a', 'c'],
			operations: [{ kind: 'add', publicIds: ['b'], entries: { people: 'Luis, Ana' } }]
		});
	});

	it('empties and writes again the whole context when a field is cleared', () => {
		const a = photo('a', { caption: 'Playa', year: 1975, extraContext: { alt: 'x' } });
		const plan = planAnnotation([a], { caption: '' });
		expect(plan).toMatchObject({
			ok: true,
			calls: 2,
			operations: [
				{
					kind: 'replace',
					publicIds: ['a'],
					before: { alt: 'x', caption: 'Playa', year: '1975' },
					after: { alt: 'x', year: '1975' }
				}
			]
		});
	});

	it('takes one call when clearing leaves nothing to write again', () => {
		const plan = planAnnotation([photo('a', { year: 1975 })], { year: null });
		expect(plan).toMatchObject({ ok: true, calls: 1, operations: [{ kind: 'replace', after: {} }] });
	});

	it('groups what clears the same way, and keeps apart what does not', () => {
		const same = { caption: 'x', year: 1975 };
		const plan = planAnnotation([photo('a', same), photo('b', same), photo('c', { ...same, year: 1980 })], { caption: '' });
		expect(plan).toMatchObject({
			ok: true,
			calls: 4,
			operations: [{ publicIds: ['a', 'b'] }, { publicIds: ['c'] }]
		});
	});

	it('replaces a year nobody can read when a year is set, and clearing it later does not bring it back', () => {
		const a = photo('a', { extraContext: { year: 'circa 1975', alt: 'x' } });
		const plan = planAnnotation([a], { year: 1980 });
		expect(plan).toMatchObject({
			ok: true,
			operations: [{ kind: 'add', entries: { year: '1980' } }],
			changes: [{ after: { year: 1980 } }]
		});
		expect(plan.ok && plan.changes[0].extra).toEqual({ alt: 'x' });
	});

	it('refuses the whole patch when one photo would end up with too many people', () => {
		const crowded = photo('b', { people: Array.from({ length: 7 }, (_, i) => `${'N'.repeat(30)}${i}`) });
		const plan = planAnnotation([photo('a'), crowded], { addPeople: ['M'.repeat(30)] });
		expect(plan).toEqual({ ok: false, problem: 'too-many-people', publicId: 'b' });
	});

	it('refuses a patch that would spend too many calls', () => {
		const photos = Array.from({ length: MAX_CONTEXT_CALLS }, (_, i) => photo(`p${i}`, { caption: `c${i}`, year: 1975 }));
		expect(planAnnotation(photos, { caption: '' })).toEqual({ ok: false, problem: 'too-many-calls' });
		expect(planAnnotation(photos.slice(0, MAX_CONTEXT_CALLS / 2), { caption: '' })).toMatchObject({ ok: true });
	});

	it('is a plan with nothing to do when nothing changes', () => {
		expect(planAnnotation([photo('a', { caption: 'x' })], { caption: 'x' })).toEqual({
			ok: true,
			changes: [],
			unchanged: ['a'],
			operations: [],
			calls: 0
		});
	});
});

describe('writeOperations', () => {
	const op = (publicIds: string[]) => ({ kind: 'add' as const, publicIds, entries: { caption: 'Playa' } });

	it('writes the keys of a group with one call', async () => {
		const result = await writeOperations(cfg, [op(['a', 'b'])]);
		expect(cloudinary.updateContext).toHaveBeenCalledTimes(1);
		expect(cloudinary.updateContext).toHaveBeenCalledWith(cfg, 'add', ['a', 'b'], 'caption=Playa');
		expect(result).toEqual({ done: ['a', 'b'], failed: [] });
	});

	it('sends no more than 100 photos in a call', async () => {
		const ids = Array.from({ length: CONTEXT_BATCH * 2 + 1 }, (_, i) => `p${i}`);
		await writeOperations(cfg, [op(ids)]);
		expect(cloudinary.updateContext.mock.calls.map((call) => call[2].length)).toEqual([100, 100, 1]);
	});

	it('empties the context and then writes it again', async () => {
		await writeOperations(cfg, [{ kind: 'replace', publicIds: ['a'], before: { caption: 'x', year: '1975' }, after: { year: '1975' } }]);
		expect(cloudinary.updateContext.mock.calls).toEqual([
			[cfg, 'remove_all', ['a']],
			[cfg, 'add', ['a'], 'year=1975']
		]);
	});

	it('only empties it when there is nothing to write again', async () => {
		const result = await writeOperations(cfg, [{ kind: 'replace', publicIds: ['a'], before: { year: '1975' }, after: {} }]);
		expect(cloudinary.updateContext.mock.calls).toEqual([[cfg, 'remove_all', ['a']]]);
		expect(result.done).toEqual(['a']);
	});

	it('puts the old context back when it cannot write the new one', async () => {
		cloudinary.updateContext.mockImplementation(async (_cfg, command, _ids, context) => {
			if (command === 'add' && context === 'year=1975') throw new Error('boom');
		});
		const result = await writeOperations(cfg, [{ kind: 'replace', publicIds: ['a'], before: { caption: 'x', year: '1975' }, after: { year: '1975' } }]);
		expect(cloudinary.updateContext.mock.calls.map((call) => [call[1], call[3]])).toEqual([
			['remove_all', undefined],
			['add', 'year=1975'],
			['add', 'caption=x|year=1975']
		]);
		expect(result).toEqual({ done: [], failed: ['a'] });
	});

	it('does not try to write anything if it could not even empty it', async () => {
		cloudinary.updateContext.mockRejectedValue(new Error('boom'));
		const result = await writeOperations(cfg, [{ kind: 'replace', publicIds: ['a'], before: { caption: 'x' }, after: { year: '1975' } }]);
		expect(cloudinary.updateContext).toHaveBeenCalledTimes(1);
		expect(result.failed).toEqual(['a']);
	});

	it('goes on with the other groups when one fails, and says which photos failed', async () => {
		cloudinary.updateContext.mockImplementation(async (_cfg, _command, ids: string[]) => {
			if (ids.includes('b')) throw new Error('boom');
		});
		const result = await writeOperations(cfg, [op(['a']), op(['b']), op(['c'])]);
		expect(result).toEqual({ done: ['a', 'c'], failed: ['b'] });
	});
});

describe('withChange', () => {
	it('lays the new annotation and the extras over the photo', () => {
		const a = photo('a', { year: 1975, extraContext: { year: 'x', alt: 'y' } });
		const next = withChange(a, { publicId: 'a', before: a, after: { caption: 'Hi', year: 1980, people: [] }, extra: { alt: 'y' } });
		expect(next).toMatchObject({ publicId: 'a', caption: 'Hi', year: 1980, extraContext: { alt: 'y' } });
		expect(a.year).toBe(1975);
	});

	it('leaves no extras behind when there are none', () => {
		const a = photo('a', { extraContext: { year: 'circa' } });
		const next = withChange(a, { publicId: 'a', before: a, after: { caption: '', year: 1980, people: [] }, extra: {} });
		expect(next).not.toHaveProperty('extraContext');
	});
});
