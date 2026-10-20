import { beforeEach, describe, expect, it, vi } from 'vitest';
import { noAnnotation } from '$lib/annotations';
import type { Photo } from '$lib/types';

const cloudinary = vi.hoisted(() => ({ searchAllPhotos: vi.fn(), setFavorite: vi.fn() }));
vi.mock('./cloudinary', () => cloudinary);

import { getFamilyIndex, invalidateFamilyIndex, markFavorite } from './photos';

const photo = (publicId: string, favorite = false): Photo => ({
	publicId,
	folder: '',
	format: 'jpg',
	width: 1,
	height: 1,
	favorite,
	...noAnnotation()
});

beforeEach(() => {
	cloudinary.searchAllPhotos.mockReset().mockResolvedValue([photo('a'), photo('b')]);
	cloudinary.setFavorite.mockReset().mockResolvedValue(undefined);
	invalidateFamilyIndex();
});

describe('markFavorite', () => {
	it('writes to Cloudinary and patches the cached index without searching again', async () => {
		await getFamilyIndex();

		expect(await markFavorite('a', true)).toBe('ok');

		expect(cloudinary.setFavorite).toHaveBeenCalledWith(expect.anything(), 'a', true);
		const { photos } = await getFamilyIndex();
		expect(photos.find((p) => p.publicId === 'a')?.favorite).toBe(true);
		expect(cloudinary.searchAllPhotos).toHaveBeenCalledTimes(1);
	});

	it('refuses a photo that is not in the family index (e.g. a demo photo)', async () => {
		expect(await markFavorite('demo/cat', true)).toBe('unknown-photo');
		expect(cloudinary.setFavorite).not.toHaveBeenCalled();
	});

	it('leaves the cache untouched when Cloudinary rejects the write', async () => {
		cloudinary.setFavorite.mockRejectedValue(new Error('boom'));
		await getFamilyIndex();

		await expect(markFavorite('a', true)).rejects.toThrow('boom');

		const { photos } = await getFamilyIndex();
		expect(photos.find((p) => p.publicId === 'a')?.favorite).toBe(false);
	});
});
