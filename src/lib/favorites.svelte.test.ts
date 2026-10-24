import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	clearFavoriteOverrides,
	dismissFavoriteFailure,
	FAVORITE_FAILURE_MS,
	favoriteFailure,
	setFavorites,
	toggleFavorite,
	withFavoriteOverrides
} from './favorites.svelte';
import type { Photo } from './types';
import { noAnnotation } from './annotations';

const photo = (publicId: string, favorite = false): Photo => ({
	publicId,
	folder: '',
	format: 'jpg',
	width: 1,
	height: 1,
	favorite,
	...noAnnotation()
});

const ok = () => Promise.resolve(new Response(null, { status: 204 }));
const status = (code: number) => () => Promise.resolve(new Response(null, { status: code }));
const favoriteOf = (id: string, base: Photo[]) =>
	withFavoriteOverrides(base).find((p) => p.publicId === id)?.favorite;

beforeEach(() => {
	vi.useFakeTimers();
	clearFavoriteOverrides();
	dismissFavoriteFailure();
});
afterEach(() => vi.useRealTimers());

describe('toggleFavorite', () => {
	it('applies the change immediately and keeps it once the server confirms', async () => {
		const base = [photo('a')];
		let release!: (r: Response) => void;
		const send = vi.fn(() => new Promise<Response>((resolve) => (release = resolve)));

		const pending = toggleFavorite(base[0], send);
		expect(favoriteOf('a', base)).toBe(true); // optimistic, before the response
		release(new Response(null, { status: 204 }));

		expect(await pending).toBe('done');
		expect(send).toHaveBeenCalledWith('a', true);
		expect(favoriteOf('a', base)).toBe(true);
	});

	it('reverts and reports a failure when the server rejects the change', async () => {
		const base = [photo('a')];
		expect(await toggleFavorite(base[0], status(500))).toBe('failed');
		expect(favoriteOf('a', base)).toBe(false);
	});

	it('reverts and reports an expired session on 401', async () => {
		const base = [photo('a')];
		expect(await toggleFavorite(base[0], status(401))).toBe('unauthorized');
		expect(favoriteOf('a', base)).toBe(false);
	});

	it('reverts when the network fails', async () => {
		const base = [photo('a')];
		const send = () => Promise.reject(new Error('offline'));
		expect(await toggleFavorite(base[0], send)).toBe('failed');
		expect(favoriteOf('a', base)).toBe(false);
	});

	it('ignores a second toggle while the first is still in flight', async () => {
		const base = [photo('a')];
		let release!: (r: Response) => void;
		const send = vi.fn(() => new Promise<Response>((resolve) => (release = resolve)));

		const first = toggleFavorite(base[0], send);
		const second = await toggleFavorite({ publicId: 'a', favorite: true }, send);
		release(new Response(null, { status: 204 }));
		await first;

		expect(second).toBe('busy');
		expect(send).toHaveBeenCalledTimes(1);
		expect(favoriteOf('a', base)).toBe(true);
	});

	it('a failed change restores the previous confirmed state, not the stale server value', async () => {
		const base = [photo('a')]; // the server-rendered list still says "not favorite"
		await toggleFavorite(base[0], ok); // confirmed: now favorite
		await toggleFavorite({ publicId: 'a', favorite: true }, status(500)); // tries to unfavorite, fails
		expect(favoriteOf('a', base)).toBe(true);
	});
});

describe('favoriteFailure', () => {
	it('names the photo whose change could not be saved', async () => {
		await toggleFavorite(photo('a'), status(500));
		expect(favoriteFailure.publicId).toBe('a');
	});

	it('also reports a network failure', async () => {
		await toggleFavorite(photo('a'), () => Promise.reject(new Error('offline')));
		expect(favoriteFailure.publicId).toBe('a');
	});

	it('stays empty when the change is saved', async () => {
		await toggleFavorite(photo('a'), ok);
		expect(favoriteFailure.publicId).toBeNull();
	});

	it('is cleared as soon as the next toggle starts', async () => {
		await toggleFavorite(photo('a'), status(500));
		let release!: (r: Response) => void;
		const pending = toggleFavorite(photo('b'), () => new Promise<Response>((resolve) => (release = resolve)));
		expect(favoriteFailure.publicId).toBeNull();

		release(new Response(null, { status: 204 }));
		await pending;
	});

	it('dismisses itself after the timeout', async () => {
		await toggleFavorite(photo('a'), status(500));
		vi.advanceTimersByTime(FAVORITE_FAILURE_MS - 1);
		expect(favoriteFailure.publicId).toBe('a');
		vi.advanceTimersByTime(1);
		expect(favoriteFailure.publicId).toBeNull();
	});

	it('restarts the timeout when a newer failure replaces the previous one', async () => {
		await toggleFavorite(photo('a'), status(500));
		vi.advanceTimersByTime(3000);
		await toggleFavorite(photo('b'), status(500));
		vi.advanceTimersByTime(FAVORITE_FAILURE_MS - 1);
		expect(favoriteFailure.publicId).toBe('b');
		vi.advanceTimersByTime(1);
		expect(favoriteFailure.publicId).toBeNull();
	});

	it('is not cleared by a tap that is ignored because the photo is busy', async () => {
		let release!: (r: Response) => void;
		const pending = toggleFavorite(photo('a'), () => new Promise<Response>((resolve) => (release = resolve)));
		await toggleFavorite(photo('b'), status(500));
		expect(favoriteFailure.publicId).toBe('b');

		expect(await toggleFavorite(photo('a', true), ok)).toBe('busy');
		expect(favoriteFailure.publicId).toBe('b');

		release(new Response(null, { status: 204 }));
		await pending;
	});

	it('is not set by an expired session, which redirects instead', async () => {
		expect(await toggleFavorite(photo('a'), status(401))).toBe('unauthorized');
		expect(favoriteFailure.publicId).toBeNull();
	});
});

describe('setFavorites', () => {
	const crowd = (n: number, favorite = false) => Array.from({ length: n }, (_, i) => photo(`p${i}`, favorite));
	const allOk = (ids: string[]) => Promise.resolve(Response.json({ done: ids, failed: [] }));

	it('changes them all right away and keeps them once the server confirms', async () => {
		const base = crowd(3);
		let release!: (r: Response) => void;
		const send = vi.fn(() => new Promise<Response>((resolve) => (release = resolve)));

		const pending = setFavorites(base, true, send);
		expect(base.map((p) => favoriteOf(p.publicId, base))).toEqual([true, true, true]); // before the answer
		release(Response.json({ done: ['p0', 'p1', 'p2'], failed: [] }));

		expect(await pending).toBe('done');
		expect(send).toHaveBeenCalledWith(['p0', 'p1', 'p2'], true);
		expect(base.map((p) => favoriteOf(p.publicId, base))).toEqual([true, true, true]);
	});

	it('leaves alone the photos that already are as asked, and asks nothing when all are', async () => {
		const base = [photo('a', true), photo('b')];
		const send = vi.fn(allOk);

		await setFavorites(base, true, send);
		expect(send).toHaveBeenCalledWith(['b'], true);

		send.mockClear();
		expect(await setFavorites([photo('a', true)], true, send)).toBe('done');
		expect(send).not.toHaveBeenCalled();
	});

	it('sends them 200 at a time', async () => {
		const sent: number[] = [];
		const send = async (ids: string[]) => {
			sent.push(ids.length);
			return Response.json({ done: ids, failed: [] });
		};
		await setFavorites(crowd(450), true, send);
		expect(sent).toEqual([200, 200, 50]);
	});

	it('takes back the photos the server did not change, and says how many, once', async () => {
		const base = crowd(3);
		const send = async () => Response.json({ done: ['p0'], failed: ['p1', 'p2'] });

		expect(await setFavorites(base, true, send)).toBe('failed');

		expect(base.map((p) => favoriteOf(p.publicId, base))).toEqual([true, false, false]);
		expect(favoriteFailure).toEqual({ publicId: 'p1', count: 2 });
	});

	it('takes back a whole group when its request fails, and keeps the others', async () => {
		let call = 0;
		const base = crowd(450);
		const send = async (ids: string[]) => (++call === 2 ? new Response(null, { status: 500 }) : Response.json({ done: ids, failed: [] }));

		expect(await setFavorites(base, true, send)).toBe('failed');

		expect(favoriteOf('p0', base)).toBe(true);
		expect(favoriteOf('p250', base)).toBe(false);
		expect(favoriteOf('p449', base)).toBe(true);
		expect(favoriteFailure.count).toBe(200);
	});

	it('takes everything back when the network fails', async () => {
		const base = crowd(2);
		expect(await setFavorites(base, true, () => Promise.reject(new Error('offline')))).toBe('failed');
		expect(base.map((p) => favoriteOf(p.publicId, base))).toEqual([false, false]);
	});

	it('stops at an expired session, taking back what it had not saved and keeping what it had', async () => {
		let call = 0;
		const base = crowd(450);
		const send = async (ids: string[]) => (++call === 2 ? new Response(null, { status: 401 }) : Response.json({ done: ids, failed: [] }));

		expect(await setFavorites(base, true, send)).toBe('unauthorized');

		expect(call).toBe(2);
		expect(favoriteOf('p0', base)).toBe(true);
		expect(favoriteOf('p250', base)).toBe(false);
		expect(favoriteOf('p449', base)).toBe(false);
		expect(favoriteFailure.publicId).toBeNull();
	});

	it('ignores a photo that has a change in flight', async () => {
		const base = crowd(2);
		let release!: (r: Response) => void;
		const slow = vi.fn(() => new Promise<Response>((resolve) => (release = resolve)));
		const first = toggleFavorite(base[0], slow);

		expect(await setFavorites(base, true, vi.fn())).toBe('busy');

		release(new Response(null, { status: 204 }));
		await first;
	});
});
