import { afterEach, describe, expect, it, vi } from 'vitest';
import { postFavorites } from './favoritesApi';

afterEach(() => vi.unstubAllGlobals());

describe('postFavorites', () => {
	it('posts the photos and the flag as JSON to /api/favorites, with a time limit', async () => {
		const fetchFn = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
		vi.stubGlobal('fetch', fetchFn);

		await postFavorites(['a', 'b'], true);

		const [url, init] = fetchFn.mock.calls[0];
		expect(url).toBe('/api/favorites');
		expect(init.method).toBe('POST');
		expect(JSON.parse(init.body)).toEqual({ publicIds: ['a', 'b'], favorite: true });
		expect(init.signal).toBeInstanceOf(AbortSignal);
	});
});
