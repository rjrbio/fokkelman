import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
	createUploadSignature,
	searchAllPhotos,
	setFavorite,
	signParams,
	type CloudinaryConfig
} from './cloudinary';

function makeConfig(fetchFn: typeof fetch): CloudinaryConfig {
	return {
		cloudName: 'testcloud',
		apiKey: 'key123',
		apiSecret: 'secret123',
		apiBase: 'https://api.example',
		fetchFn
	};
}

const jsonResponse = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('signParams', () => {
	it('sorts params alphabetically and signs with sha1(query + secret)', () => {
		const expected = createHash('sha1')
			.update('folder=family_uploads&timestamp=1700000000' + 'secret123')
			.digest('hex');
		expect(signParams({ timestamp: 1700000000, folder: 'family_uploads' }, 'secret123')).toBe(
			expected
		);
	});
});

describe('createUploadSignature', () => {
	it('returns everything the browser needs for a signed upload', () => {
		const cfg = makeConfig(fetch);
		const sig = createUploadSignature(cfg, 'family_uploads', 1700000000000);
		expect(sig).toEqual({
			cloudName: 'testcloud',
			apiKey: 'key123',
			timestamp: 1700000000,
			folder: 'family_uploads',
			signature: signParams({ folder: 'family_uploads', timestamp: 1700000000 }, 'secret123')
		});
	});
});

describe('setFavorite', () => {
	it('POSTs a signed add-tag command', async () => {
		const fetchFn = vi.fn().mockResolvedValue(jsonResponse({}));
		await setFavorite(makeConfig(fetchFn as typeof fetch), 'pic1', true);

		const [url, init] = fetchFn.mock.calls[0];
		expect(url).toBe('https://api.example/v1_1/testcloud/image/tags');
		const body = init.body as URLSearchParams;
		expect(body.get('command')).toBe('add');
		expect(body.get('tag')).toBe('favorite');
		expect(body.get('public_ids')).toBe('pic1');
		expect(body.get('api_key')).toBe('key123');
		expect(body.get('signature')).toHaveLength(40);
	});

	it('sends remove when favorite=false and throws on HTTP error', async () => {
		const fetchFn = vi.fn().mockResolvedValue(jsonResponse({}, 500));
		await expect(
			setFavorite(makeConfig(fetchFn as typeof fetch), 'pic1', false)
		).rejects.toThrow('Cloudinary tags API failed: 500');
		const body = fetchFn.mock.calls[0][1].body as URLSearchParams;
		expect(body.get('command')).toBe('remove');
	});
});

describe('searchAllPhotos', () => {
	it('paginates with next_cursor and maps resources to Photo', async () => {
		const fetchFn = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse({
					resources: [
						{ public_id: 'a1', folder: '', format: 'jpg', width: 10, height: 20, tags: ['favorite'] }
					],
					next_cursor: 'cursor-2'
				})
			)
			.mockResolvedValueOnce(
				jsonResponse({
					resources: [{ public_id: 'demo/b2', folder: 'demo', format: 'png', width: 30, height: 40 }]
				})
			);

		const photos = await searchAllPhotos(makeConfig(fetchFn as typeof fetch), 'resource_type:image');

		expect(fetchFn).toHaveBeenCalledTimes(2);
		const secondBody = JSON.parse(fetchFn.mock.calls[1][1].body as string);
		expect(secondBody.next_cursor).toBe('cursor-2');
		expect(photos).toEqual([
			{ publicId: 'a1', folder: '', format: 'jpg', width: 10, height: 20, favorite: true },
			{ publicId: 'demo/b2', folder: 'demo', format: 'png', width: 30, height: 40, favorite: false }
		]);
	});

	it('throws on HTTP error', async () => {
		const fetchFn = vi.fn().mockResolvedValue(jsonResponse({}, 401));
		await expect(
			searchAllPhotos(makeConfig(fetchFn as typeof fetch), 'resource_type:image')
		).rejects.toThrow('Cloudinary search failed: 401');
	});
});
