import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearFavoriteOverrides, toggleFavorite, withFavoriteOverrides } from './favorites.svelte';
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

beforeEach(() => clearFavoriteOverrides());

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
