import { beforeEach, describe, expect, it, vi } from 'vitest';

const photos = vi.hoisted(() => ({ markFavorites: vi.fn() }));
vi.mock('$lib/server/photos', () => photos);

import { POST } from './+server';

async function call(body: unknown) {
	const event = { locals: { authed: true }, request: { json: async () => body } } as never;
	const response = (await POST(event)) as Response;
	return { status: response.status, body: await response.json() };
}

beforeEach(() => {
	photos.markFavorites.mockReset().mockResolvedValue({ status: 'done', done: ['a'], failed: [] });
});

describe('POST /api/favorites', () => {
	it('marks the photos asked for, once each', async () => {
		await call({ publicIds: ['a', 'b', 'a'], favorite: true });
		expect(photos.markFavorites).toHaveBeenCalledWith(['a', 'b'], true);
	});

	it('answers with what was changed and what was not', async () => {
		photos.markFavorites.mockResolvedValue({ status: 'done', done: ['a'], failed: ['b'] });
		expect(await call({ publicIds: ['a', 'b'], favorite: false })).toEqual({
			status: 200,
			body: { done: ['a'], failed: ['b'] }
		});
	});

	it.each([
		['no body', null],
		['no photos', { publicIds: [], favorite: true }],
		['photos that are not a list', { publicIds: 'a', favorite: true }],
		['an id that is not text', { publicIds: ['a', 5], favorite: true }],
		['an empty id', { publicIds: [''], favorite: true }],
		['too many photos', { publicIds: Array.from({ length: 201 }, (_, i) => `p${i}`), favorite: true }],
		['no favorite flag', { publicIds: ['a'] }],
		['a favorite flag that is not a boolean', { publicIds: ['a'], favorite: 'yes' }]
	])('answers 400 to %s, and changes nothing', async (_name, body) => {
		expect((await call(body)).status).toBe(400);
		expect(photos.markFavorites).not.toHaveBeenCalled();
	});

	it('answers 404 when a photo is not in the family index', async () => {
		photos.markFavorites.mockResolvedValue({ status: 'unknown-photo' });
		expect((await call({ publicIds: ['demo/x'], favorite: true })).status).toBe(404);
	});
});
