import { afterEach, describe, expect, it, vi } from 'vitest';
import { postAnnotation } from './annotateApi';

afterEach(() => vi.unstubAllGlobals());

describe('postAnnotation', () => {
	it('posts the photos and the patch as JSON to /api/annotate, with a time limit', async () => {
		const fetchFn = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
		vi.stubGlobal('fetch', fetchFn);

		await postAnnotation(['a', 'b'], { caption: 'x', addPeople: ['Ana'] });

		const [url, init] = fetchFn.mock.calls[0];
		expect(url).toBe('/api/annotate');
		expect(init.method).toBe('POST');
		expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
		expect(JSON.parse(init.body)).toEqual({ publicIds: ['a', 'b'], patch: { caption: 'x', addPeople: ['Ana'] } });
		expect(init.signal).toBeInstanceOf(AbortSignal);
	});
});
