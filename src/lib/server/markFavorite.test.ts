import { beforeEach, describe, expect, it, vi } from 'vitest';
import { noAnnotation } from '$lib/annotations';
import type { Photo } from '$lib/types';

const cloudinary = vi.hoisted(() => ({ searchAllPhotos: vi.fn(), setFavorite: vi.fn(), setFavorites: vi.fn() }));
vi.mock('./cloudinary', () => cloudinary);

import { getFamilyIndex, invalidateFamilyIndex, markFavorite, markFavorites } from './photos';

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
	cloudinary.setFavorites.mockReset().mockResolvedValue(undefined);
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

describe('markFavorites', () => {
	beforeEach(() => {
		cloudinary.searchAllPhotos.mockResolvedValue(Array.from({ length: 250 }, (_, i) => photo(`p${i}`)));
	});

	it('writes them to Cloudinary 100 to a call and patches the cached index without searching again', async () => {
		await getFamilyIndex();
		const ids = Array.from({ length: 250 }, (_, i) => `p${i}`);

		const outcome = await markFavorites(ids, true);

		expect(outcome).toEqual({ status: 'done', done: ids, failed: [] });
		expect(cloudinary.setFavorites.mock.calls.map((call) => call[1].length)).toEqual([100, 100, 50]);
		expect(cloudinary.setFavorites.mock.calls.every((call) => call[2] === true)).toBe(true);
		const { photos } = await getFamilyIndex();
		expect(photos.every((p) => p.favorite)).toBe(true);
		expect(cloudinary.searchAllPhotos).toHaveBeenCalledTimes(1);
	});

	it('refuses the whole request when a photo is not in the family index, and writes nothing', async () => {
		expect(await markFavorites(['p1', 'demo/cat'], true)).toEqual({ status: 'unknown-photo' });
		expect(cloudinary.setFavorites).not.toHaveBeenCalled();
	});

	it('goes on when one call fails: those photos come back as failed, the others are changed, the index is reloaded next time', async () => {
		const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
		await getFamilyIndex();
		cloudinary.setFavorites.mockRejectedValueOnce(new Error('boom'));
		const ids = Array.from({ length: 150 }, (_, i) => `p${i}`);

		const outcome = await markFavorites(ids, true);

		expect(outcome).toEqual({ status: 'done', done: ids.slice(100), failed: ids.slice(0, 100) });
		await getFamilyIndex();
		expect(cloudinary.searchAllPhotos).toHaveBeenCalledTimes(2);
		expect(quiet).toHaveBeenCalled();
		quiet.mockRestore();
	});

	it('takes the favorite off when asked to', async () => {
		cloudinary.searchAllPhotos.mockResolvedValue([photo('a', true), photo('b', true)]);
		await getFamilyIndex();
		await markFavorites(['a'], false);
		const { photos } = await getFamilyIndex();
		expect(photos.map((p) => p.favorite)).toEqual([false, true]);
	});
});
