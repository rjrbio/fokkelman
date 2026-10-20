import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { noAnnotation } from '$lib/annotations';
import type { Photo } from '$lib/types';
import { CONTEXT_BATCH } from './annotate';
import { contextEntries } from './context';

const cloudinary = vi.hoisted(() => ({
	searchAllPhotos: vi.fn(),
	getContexts: vi.fn(),
	setFavorite: vi.fn(),
	updateContext: vi.fn()
}));
vi.mock('./cloudinary', () => cloudinary);

import { annotatePhotos, getFamilyIndex, invalidateFamilyIndex } from './photos';

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

/** Cloudinary's answer for the context of a photo: nothing at all when it has none. */
const contextOf = (p: Photo): unknown => {
	const entries = contextEntries(p, p.extraContext);
	return Object.keys(entries).length > 0 ? { custom: entries } : undefined;
};

/** What the Admin API answers: an entry for each photo that exists, with the raw context it has now. */
const answers = (contexts: Record<string, unknown>) => new Map(Object.entries(contexts));

let library: Photo[];
// Writing logs what goes wrong so that it can be put right by hand: it is caught here to keep the output clean.
let errorLog: MockInstance<typeof console.error>;

beforeEach(() => {
	library = [photo('a'), photo('b', { caption: 'Vieja', year: 1975 }), photo('c')];
	cloudinary.searchAllPhotos.mockReset().mockImplementation(async () => library);
	// By default Cloudinary agrees with the cached index, so that each test only says where it differs.
	cloudinary.getContexts.mockReset().mockImplementation(
		async (_cfg: unknown, ids: string[]) =>
			new Map(library.filter((p) => ids.includes(p.publicId)).map((p) => [p.publicId, contextOf(p)]))
	);
	cloudinary.updateContext.mockReset().mockResolvedValue(undefined);
	invalidateFamilyIndex();
	errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
	errorLog.mockRestore();
});

const annotationOf = async (publicId: string) =>
	(await getFamilyIndex()).photos.find((p) => p.publicId === publicId);

const writes = () => cloudinary.updateContext.mock.calls.map((call) => [call[1], call[2], call[3]]);

describe('annotatePhotos', () => {
	it('writes to Cloudinary, patches the cached index and says what each photo has now', async () => {
		await getFamilyIndex();

		const outcome = await annotatePhotos(['a', 'b'], { caption: 'Playa', addPeople: ['Ana'] });

		expect(outcome).toEqual({
			status: 'done',
			updated: [
				{ publicId: 'a', annotation: { caption: 'Playa', year: null, people: ['Ana'] } },
				{ publicId: 'b', annotation: { caption: 'Playa', year: 1975, people: ['Ana'] } }
			],
			failed: []
		});
		expect(await annotationOf('b')).toMatchObject({ caption: 'Playa', people: ['Ana'] });
		expect(cloudinary.searchAllPhotos).toHaveBeenCalledTimes(1);
	});

	it('does not write the photos that already are as asked, and says what they have', async () => {
		const outcome = await annotatePhotos(['a', 'b'], { caption: 'Vieja' });
		expect(outcome).toEqual({
			status: 'done',
			updated: [
				{ publicId: 'a', annotation: { caption: 'Vieja', year: null, people: [] } },
				{ publicId: 'b', annotation: { caption: 'Vieja', year: 1975, people: [] } }
			],
			failed: []
		});
		expect(cloudinary.updateContext).toHaveBeenCalledTimes(1);
		expect(cloudinary.updateContext.mock.calls[0][2]).toEqual(['a']);
	});

	it('refuses the whole request when a photo is not in the family index, reading and writing nothing', async () => {
		expect(await annotatePhotos(['a', 'demo/cat'], { caption: 'x' })).toEqual({ status: 'unknown-photo' });
		expect(cloudinary.getContexts).not.toHaveBeenCalled();
		expect(cloudinary.updateContext).not.toHaveBeenCalled();
	});

	it('writes nothing when the patch cannot be applied to one of the photos', async () => {
		library = [photo('a'), photo('b', { people: Array.from({ length: 7 }, (_, i) => `${'N'.repeat(30)}${i}`) })];
		expect(await annotatePhotos(['a', 'b'], { addPeople: ['M'.repeat(30)] })).toEqual({
			status: 'rejected',
			problem: 'too-many-people'
		});
		expect(cloudinary.updateContext).not.toHaveBeenCalled();
	});

	it('leaves the cache alone and reloads it next time when Cloudinary fails', async () => {
		await getFamilyIndex();
		cloudinary.updateContext.mockRejectedValue(new Error('boom'));

		const outcome = await annotatePhotos(['a'], { caption: 'Playa' });

		expect(outcome).toEqual({ status: 'done', updated: [], failed: ['a'] });
		expect(cloudinary.searchAllPhotos).toHaveBeenCalledTimes(1);
		await annotationOf('a');
		expect(cloudinary.searchAllPhotos).toHaveBeenCalledTimes(2);
	});

	it('reports what was written and what failed when only some of the photos fail', async () => {
		// Clearing the caption leaves 'a' with a year and 'b' with nothing: they are written in separate groups.
		library = [photo('a', { caption: 'x', year: 1975 }), photo('b', { caption: 'y' })];
		cloudinary.updateContext.mockImplementation(async (_cfg, _command, ids: string[]) => {
			if (ids.includes('a')) throw new Error('boom');
		});

		const outcome = await annotatePhotos(['a', 'b'], { caption: '' });

		expect(outcome).toEqual({
			status: 'done',
			updated: [{ publicId: 'b', annotation: noAnnotation() }],
			failed: ['a']
		});
	});

	describe('plans from the context Cloudinary has now, not from the cached copy', () => {
		it('keeps a person that was added by hand after the copy was taken', async () => {
			library = [photo('a', { people: ['A'] })];
			await getFamilyIndex();
			cloudinary.getContexts.mockResolvedValue(answers({ a: { custom: { people: 'A, B' } } }));

			const outcome = await annotatePhotos(['a'], { addPeople: ['C'] });

			expect(writes()).toEqual([['add', ['a'], 'people=A, B, C']]);
			expect(outcome).toEqual({
				status: 'done',
				updated: [{ publicId: 'a', annotation: { caption: '', year: null, people: ['A', 'B', 'C'] } }],
				failed: []
			});
			expect(await annotationOf('a')).toMatchObject({ people: ['A', 'B', 'C'] });
		});

		it('keeps a key that is not ours which the copy did not have, when clearing a field', async () => {
			library = [photo('b', { caption: 'Vieja', year: 1975 })];
			await getFamilyIndex();
			cloudinary.getContexts.mockResolvedValue(answers({ b: { custom: { caption: 'Vieja', year: '1975', alt: 'texto' } } }));

			const outcome = await annotatePhotos(['b'], { caption: '' });

			expect(writes()).toEqual([
				['remove_all', ['b'], undefined],
				['add', ['b'], 'alt=texto|year=1975']
			]);
			expect(outcome).toMatchObject({ updated: [{ publicId: 'b', annotation: { caption: '', year: 1975, people: [] } }] });
			expect(await annotationOf('b')).toMatchObject({ caption: '', year: 1975, extraContext: { alt: 'texto' } });
		});

		it('asks for the photos it is going to change, in groups of 100', async () => {
			library = Array.from({ length: CONTEXT_BATCH + 1 }, (_, i) => photo(`p${i}`));
			const ids = library.map((p) => p.publicId);

			await annotatePhotos(ids, { year: 1975 });

			expect(cloudinary.getContexts.mock.calls.map((call) => call[1].length)).toEqual([100, 1]);
			expect(cloudinary.getContexts.mock.calls.flatMap((call) => call[1])).toEqual(ids);
		});

		it('does nothing, and says the photos are not available, when the context cannot be read', async () => {
			await getFamilyIndex();
			cloudinary.getContexts.mockRejectedValue(new Error('timeout'));

			expect(await annotatePhotos(['a', 'b'], { caption: 'Playa' })).toEqual({ status: 'unavailable' });

			expect(cloudinary.updateContext).not.toHaveBeenCalled();
			expect(String(errorLog.mock.calls[0][0])).toBe('[annotate] could not read the current context');
			expect(errorLog.mock.calls[0][1]).toEqual(new Error('timeout'));
			// The cache is as it was: neither patched nor thrown away.
			expect(await annotationOf('b')).toMatchObject({ caption: 'Vieja' });
			expect(cloudinary.searchAllPhotos).toHaveBeenCalledTimes(1);
		});

		it('does not read the second group when the first one cannot be read, and writes nothing', async () => {
			library = Array.from({ length: CONTEXT_BATCH + 1 }, (_, i) => photo(`p${i}`));
			cloudinary.getContexts.mockRejectedValueOnce(new Error('down'));

			expect(await annotatePhotos(library.map((p) => p.publicId), { year: 1975 })).toEqual({ status: 'unavailable' });

			expect(cloudinary.getContexts).toHaveBeenCalledTimes(1);
			expect(cloudinary.updateContext).not.toHaveBeenCalled();
		});

		it('reports a photo Cloudinary does not return as failed, writes the others, and reloads the index', async () => {
			await getFamilyIndex();
			cloudinary.getContexts.mockResolvedValue(answers({ a: undefined, b: { custom: { caption: 'Vieja', year: '1975' } } }));

			const outcome = await annotatePhotos(['a', 'b', 'c'], { addPeople: ['Ana'] });

			expect(outcome).toEqual({
				status: 'done',
				updated: [
					{ publicId: 'a', annotation: { caption: '', year: null, people: ['Ana'] } },
					{ publicId: 'b', annotation: { caption: 'Vieja', year: 1975, people: ['Ana'] } }
				],
				failed: ['c']
			});
			expect(writes()).toEqual([['add', ['a', 'b'], 'people=Ana']]);
			await annotationOf('c');
			expect(cloudinary.searchAllPhotos).toHaveBeenCalledTimes(2);
		});

		it('treats a photo with no context as a photo with nothing: a clear changes nothing and an add writes only what is new', async () => {
			await getFamilyIndex(); // the copy says 'b' has a caption and a year
			cloudinary.getContexts.mockResolvedValue(answers({ b: undefined }));

			const cleared = await annotatePhotos(['b'], { caption: '' });
			expect(cleared).toEqual({ status: 'done', updated: [{ publicId: 'b', annotation: noAnnotation() }], failed: [] });
			expect(cloudinary.updateContext).not.toHaveBeenCalled();

			const added = await annotatePhotos(['b'], { addPeople: ['Ana'] });
			expect(writes()).toEqual([['add', ['b'], 'people=Ana']]);
			expect(added).toMatchObject({ updated: [{ publicId: 'b', annotation: { caption: '', year: null, people: ['Ana'] } }] });
		});

		it('corrects the cached copy of a photo it finds already as asked, and answers with what it has', async () => {
			await getFamilyIndex(); // the copy says 'b' is "Vieja", 1975
			cloudinary.getContexts.mockResolvedValue(answers({ b: { custom: { caption: 'Nueva', year: '1990', alt: 'x' } } }));

			const outcome = await annotatePhotos(['b'], { caption: 'Nueva' });

			expect(cloudinary.updateContext).not.toHaveBeenCalled();
			expect(outcome).toEqual({
				status: 'done',
				updated: [{ publicId: 'b', annotation: { caption: 'Nueva', year: 1990, people: [] } }],
				failed: []
			});
			expect(await annotationOf('b')).toMatchObject({ caption: 'Nueva', year: 1990, extraContext: { alt: 'x' } });
			expect(cloudinary.searchAllPhotos).toHaveBeenCalledTimes(1);
		});

		it('does not rewrite a photo whose existing text has a backslash: it fails, and the index is reloaded', async () => {
			await getFamilyIndex();
			cloudinary.getContexts.mockResolvedValue(
				answers({ a: { custom: { people: 'C:\\Ana' } }, c: { custom: { caption: 'x' } } })
			);

			const outcome = await annotatePhotos(['a', 'c'], { addPeople: ['Luis'] });

			expect(writes()).toEqual([['add', ['c'], 'people=Luis']]);
			expect(outcome).toEqual({
				status: 'done',
				updated: [{ publicId: 'c', annotation: { caption: 'x', year: null, people: ['Luis'] } }],
				failed: ['a']
			});
			await annotationOf('a');
			expect(cloudinary.searchAllPhotos).toHaveBeenCalledTimes(2);
		});

		it('lists the failures in this order: the writes that failed, the photos not found, the photos not written', async () => {
			library = [photo('a'), photo('b'), photo('c'), photo('d')];
			await getFamilyIndex();
			cloudinary.getContexts.mockResolvedValue(
				answers({ a: undefined, b: { custom: { people: 'x\\y' } }, c: undefined })
			);
			cloudinary.updateContext.mockRejectedValue(new Error('boom'));

			const outcome = await annotatePhotos(['a', 'b', 'c', 'd'], { addPeople: ['Ana'] });

			expect(outcome).toMatchObject({ updated: [], failed: ['a', 'c', 'd', 'b'] });
		});
	});
});
