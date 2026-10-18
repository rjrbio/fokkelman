import { beforeEach, describe, expect, it, vi } from 'vitest';

const photos = vi.hoisted(() => ({
	markFavorite: vi.fn(),
	invalidateFamilyIndex: vi.fn()
}));
vi.mock('$lib/server/photos', () => photos);

import { POST } from './+server';

async function call(body: BodyInit | null, authed = true): Promise<Response> {
	const request = new Request('http://localhost/api/favorite', { method: 'POST', body });
	return POST({ request, locals: { authed } } as never);
}
const json = (value: unknown) => JSON.stringify(value);

beforeEach(() => {
	for (const mock of Object.values(photos)) mock.mockReset();
	photos.markFavorite.mockResolvedValue('ok');
});

describe('POST /api/favorite', () => {
	it('answers 204 and records the change for a known photo', async () => {
		const response = await call(json({ publicId: 'a', favorite: true }));

		expect(response.status).toBe(204);
		expect(photos.markFavorite).toHaveBeenCalledExactlyOnceWith('a', true);
	});

	it('answers 404 "Unknown photo" when the photo is not in the family index', async () => {
		photos.markFavorite.mockResolvedValue('unknown-photo');

		const response = await call(json({ publicId: 'stranger', favorite: false }));

		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ message: 'Unknown photo' });
		expect(photos.markFavorite).toHaveBeenCalledExactlyOnceWith('stranger', false);
	});

	it.each([
		['no body', null],
		['a body that is not JSON', 'not json'],
		['a JSON body that is not an object', json(null)],
		['a publicId that is not a string', json({ publicId: 5, favorite: true })],
		['a favorite that is not a boolean', json({ publicId: 'a', favorite: 'yes' })],
		['a missing favorite', json({ publicId: 'a' })]
	])('answers 400 without touching Cloudinary for %s', async (_case, body) => {
		const response = await call(body);

		expect(response.status).toBe(400);
		expect(photos.markFavorite).not.toHaveBeenCalled();
	});

	it('answers 401 before reading the body or calling markFavorite when there is no session', async () => {
		const request = new Request('http://localhost/api/favorite', {
			method: 'POST',
			body: json({ publicId: 'a', favorite: true })
		});

		await expect(
			(async () => POST({ request, locals: { authed: false } } as never))()
		).rejects.toMatchObject({ status: 401 });
		expect(request.bodyUsed).toBe(false);
		expect(photos.markFavorite).not.toHaveBeenCalled();
	});

	it('never reloads the photo index, whatever the outcome', async () => {
		await call(json({ publicId: 'a', favorite: true }));
		photos.markFavorite.mockResolvedValue('unknown-photo');
		await call(json({ publicId: 'stranger', favorite: true }));
		await call('not json');
		await call(json({ publicId: 'a', favorite: true }), false).catch(() => {});

		expect(photos.invalidateFamilyIndex).not.toHaveBeenCalled();
	});
});
