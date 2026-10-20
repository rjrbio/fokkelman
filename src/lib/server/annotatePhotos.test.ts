import { beforeEach, describe, expect, it, vi } from 'vitest';
import { noAnnotation } from '$lib/annotations';
import type { Photo } from '$lib/types';

const cloudinary = vi.hoisted(() => ({
	searchAllPhotos: vi.fn(),
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

beforeEach(() => {
	cloudinary.searchAllPhotos
		.mockReset()
		.mockResolvedValue([photo('a'), photo('b', { caption: 'Vieja', year: 1975 }), photo('c')]);
	cloudinary.updateContext.mockReset().mockResolvedValue(undefined);
	invalidateFamilyIndex();
});

const annotationOf = async (publicId: string) =>
	(await getFamilyIndex()).photos.find((p) => p.publicId === publicId);

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

	it('does not write the photos that already are as asked, nor report them', async () => {
		const outcome = await annotatePhotos(['a', 'b'], { caption: 'Vieja' });
		expect(outcome).toMatchObject({ status: 'done', updated: [{ publicId: 'a' }] });
		expect(cloudinary.updateContext).toHaveBeenCalledTimes(1);
		expect(cloudinary.updateContext.mock.calls[0][2]).toEqual(['a']);
	});

	it('refuses the whole request when a photo is not in the family index', async () => {
		expect(await annotatePhotos(['a', 'demo/cat'], { caption: 'x' })).toEqual({ status: 'unknown-photo' });
		expect(cloudinary.updateContext).not.toHaveBeenCalled();
	});

	it('writes nothing when the patch cannot be applied to one of the photos', async () => {
		cloudinary.searchAllPhotos.mockResolvedValue([
			photo('a'),
			photo('b', { people: Array.from({ length: 7 }, (_, i) => `${'N'.repeat(30)}${i}`) })
		]);
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
		cloudinary.searchAllPhotos.mockResolvedValue([
			photo('a', { caption: 'x', year: 1975 }),
			photo('b', { caption: 'y' })
		]);
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
});
