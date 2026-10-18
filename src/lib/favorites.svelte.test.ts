import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	clearFavoriteOverrides,
	dismissFavoriteFailure,
	FAVORITE_FAILURE_MS,
	favoriteFailure,
	toggleFavorite,
	withFavoriteOverrides
} from './favorites.svelte';
import type { Photo } from './types';

const photo = (publicId: string, favorite = false): Photo => ({
	publicId,
	folder: '',
	format: 'jpg',
	width: 1,
	height: 1,
	favorite
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
