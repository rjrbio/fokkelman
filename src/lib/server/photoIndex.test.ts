import { describe, expect, it, vi } from 'vitest';
import { createIndexCache, withFavorite } from './photoIndex';
import type { Photo } from '$lib/types';

const photo = (publicId: string): Photo => ({
	publicId,
	folder: '',
	format: 'jpg',
	width: 1,
	height: 1,
	favorite: false
});

describe('createIndexCache', () => {
	it('fetches once and serves from cache within the TTL', async () => {
		let now = 0;
		const fetcher = vi.fn().mockResolvedValue([photo('a')]);
		const cache = createIndexCache(fetcher, 5000, () => now);

		const first = await cache.get();
		now = 4000;
		const second = await cache.get();

		expect(fetcher).toHaveBeenCalledTimes(1);
		expect(first).toEqual({ photos: [photo('a')], fetchedAt: 0, stale: false });
		expect(second.stale).toBe(false);
	});

	it('refetches after the TTL expires', async () => {
		let now = 0;
		const fetcher = vi.fn().mockResolvedValue([photo('a')]);
		const cache = createIndexCache(fetcher, 5000, () => now);

		await cache.get();
		now = 6000;
		const result = await cache.get();

		expect(fetcher).toHaveBeenCalledTimes(2);
		expect(result.fetchedAt).toBe(6000);
	});

	it('serves the stale copy when the refetch fails', async () => {
		let now = 0;
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce([photo('a')])
			.mockRejectedValueOnce(new Error('rate limited'));
		const cache = createIndexCache(fetcher, 5000, () => now);

		await cache.get();
		now = 6000;
		const result = await cache.get();

		expect(result).toEqual({ photos: [photo('a')], fetchedAt: 0, stale: true });
	});

	it('throws when there is no cached copy and the fetch fails', async () => {
		const fetcher = vi.fn().mockRejectedValue(new Error('down'));
		const cache = createIndexCache(fetcher, 5000, () => 0);
		await expect(cache.get()).rejects.toThrow('down');
	});

	it('invalidate() forces the next get to refetch', async () => {
		let now = 0;
		const fetcher = vi.fn().mockResolvedValue([photo('a')]);
		const cache = createIndexCache(fetcher, 5000, () => now);

		await cache.get();
		cache.invalidate();
		await cache.get();

		expect(fetcher).toHaveBeenCalledTimes(2);
	});
});

describe('createIndexCache.patch', () => {
	it('updates the cached copy without refetching or extending the TTL', async () => {
		let now = 0;
		const fetcher = vi.fn().mockResolvedValue([photo('a'), photo('b')]);
		const cache = createIndexCache(fetcher, 5000, () => now);

		await cache.get();
		cache.patch((photos) => withFavorite(photos, 'a', true));
		now = 4000;
		const result = await cache.get();

		expect(fetcher).toHaveBeenCalledTimes(1);
		expect(result.photos.find((p) => p.publicId === 'a')?.favorite).toBe(true);
		expect(result.fetchedAt).toBe(0); // the patch does not make the data look fresher than it is
	});

	it('is a no-op when nothing is cached yet', async () => {
		const fetcher = vi.fn().mockResolvedValue([photo('a')]);
		const cache = createIndexCache(fetcher, 5000, () => 0);

		cache.patch((photos) => withFavorite(photos, 'a', true));
		const result = await cache.get();

		expect(result.photos[0].favorite).toBe(false); // came from the fetch, not from a ghost patch
	});

	it('also patches the copy that is served stale', async () => {
		let now = 0;
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce([photo('a')])
			.mockRejectedValueOnce(new Error('rate limited'));
		const cache = createIndexCache(fetcher, 5000, () => now);

		await cache.get();
		cache.patch((photos) => withFavorite(photos, 'a', true));
		now = 6000;
		const result = await cache.get();

		expect(result.stale).toBe(true);
		expect(result.photos[0].favorite).toBe(true);
	});
});

describe('withFavorite', () => {
	it('flips only the matching photo and does not mutate the input', () => {
		const input = [photo('a'), photo('b')];
		const output = withFavorite(input, 'b', true);
		expect(output.map((p) => p.favorite)).toEqual([false, true]);
		expect(input[1].favorite).toBe(false);
		expect(output[0]).toBe(input[0]);
	});
});
