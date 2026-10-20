import { beforeEach, describe, expect, it, vi } from 'vitest';

const photos = vi.hoisted(() => ({ annotatePhotos: vi.fn() }));
vi.mock('$lib/server/photos', () => photos);

import { POST } from './+server';

async function call(body: unknown, authed = true) {
	const event = { locals: { authed }, request: { json: async () => body } } as never;
	const response = (await POST(event)) as Response;
	return { status: response.status, body: await response.json() };
}

beforeEach(() => {
	photos.annotatePhotos.mockReset().mockResolvedValue({ status: 'done', updated: [], failed: [] });
});

describe('POST /api/annotate', () => {
	it('applies a valid patch to the photos asked for, once each', async () => {
		const result = await call({ publicIds: ['a', 'b', 'a'], patch: { caption: '  Playa  ', addPeople: ['Ana'] } });
		expect(photos.annotatePhotos).toHaveBeenCalledWith(['a', 'b'], { caption: 'Playa', addPeople: ['Ana'] });
		expect(result.status).toBe(200);
	});

	it('answers with what was written and what failed', async () => {
		photos.annotatePhotos.mockResolvedValue({
			status: 'done',
			updated: [{ publicId: 'a', annotation: { caption: 'x', year: null, people: [] } }],
			failed: ['b']
		});
		expect((await call({ publicIds: ['a', 'b'], patch: { caption: 'x' } })).body).toEqual({
			updated: [{ publicId: 'a', annotation: { caption: 'x', year: null, people: [] } }],
			failed: ['b']
		});
	});

	it.each([
		['no body', null],
		['no photos', { publicIds: [], patch: { caption: 'x' } }],
		['photos that are not a list', { publicIds: 'a', patch: { caption: 'x' } }],
		['an id that is not text', { publicIds: ['a', 5], patch: { caption: 'x' } }],
		['an empty id', { publicIds: [''], patch: { caption: 'x' } }],
		['too many photos', { publicIds: Array.from({ length: 201 }, (_, i) => `p${i}`), patch: { caption: 'x' } }]
	])('answers 400 to %s, and writes nothing', async (_name, body) => {
		const result = await call(body);
		expect(result).toMatchObject({ status: 400, body: { problem: 'bad-shape' } });
		expect(photos.annotatePhotos).not.toHaveBeenCalled();
	});

	it.each([
		['nothing to change', {}, 'nothing-to-change'],
		['a year in the future', { year: 3000 }, 'year-out-of-range'],
		['a caption that is too long', { caption: 'x'.repeat(256) }, 'caption-too-long'],
		['a backslash', { caption: 'a\\b' }, 'has-backslash'],
		['a name with a comma', { addPeople: ['Ana, Luis'] }, 'person-has-comma'],
		['no patch at all', undefined, 'bad-shape']
	])('answers 400 to %s, and writes nothing', async (_name, patch, problem) => {
		const result = await call({ publicIds: ['a'], patch });
		expect(result).toMatchObject({ status: 400, body: { problem } });
		expect(photos.annotatePhotos).not.toHaveBeenCalled();
	});

	it('answers 404 when a photo is not in the family index', async () => {
		photos.annotatePhotos.mockResolvedValue({ status: 'unknown-photo' });
		expect((await call({ publicIds: ['demo/x'], patch: { caption: 'x' } })).status).toBe(404);
	});

	it('answers 422 with the reason when the patch cannot be applied to a photo', async () => {
		photos.annotatePhotos.mockResolvedValue({ status: 'rejected', problem: 'too-many-people' });
		expect(await call({ publicIds: ['a'], patch: { addPeople: ['Ana'] } })).toMatchObject({
			status: 422,
			body: { problem: 'too-many-people' }
		});
	});
});
