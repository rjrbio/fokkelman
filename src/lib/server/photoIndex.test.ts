import { describe, expect, it, vi } from 'vitest';
import { createIndexCache } from './photoIndex';
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
