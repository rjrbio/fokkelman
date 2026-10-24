import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { noAnnotation } from '$lib/annotations';
import {
	CONTEXT_CALL_TIMEOUT_MS,
	createUploadSignature,
	getContexts,
	searchAllPhotos,
	setFavorite,
	setFavorites,
	signParams,
	updateContext,
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

describe('setFavorites', () => {
	const sha1 = (text: string) => createHash('sha1').update(text).digest('hex');

	afterEach(() => vi.useRealTimers());

	it('tags many photos with one call: the ids as an array, signed comma-joined, with a time limit', async () => {
		vi.useFakeTimers().setSystemTime(1_700_000_000_000);
		const fetchFn = vi.fn().mockResolvedValue(jsonResponse({}));

		await setFavorites(makeConfig(fetchFn as typeof fetch), ['a', 'b/c'], true);

		const [url, init] = fetchFn.mock.calls[0];
		expect(url).toBe('https://api.example/v1_1/testcloud/image/tags');
		const body = init.body as URLSearchParams;
		expect(body.getAll('public_ids[]')).toEqual(['a', 'b/c']);
		expect(body.get('command')).toBe('add');
		expect(body.get('tag')).toBe('favorite');
		expect(body.get('api_key')).toBe('key123');
		expect(body.get('signature')).toBe(
			sha1('command=add&public_ids=a,b/c&tag=favorite&timestamp=1700000000secret123')
		);
		expect(init.signal).toBeInstanceOf(AbortSignal);
	});

	it('removes the tag when favorite is false, and throws on HTTP error', async () => {
		const fetchFn = vi.fn().mockResolvedValue(jsonResponse({}, 500));
		await expect(setFavorites(makeConfig(fetchFn as typeof fetch), ['a'], false)).rejects.toThrow(
			'Cloudinary tags API failed: 500'
		);
		expect((fetchFn.mock.calls[0][1].body as URLSearchParams).get('command')).toBe('remove');
	});
});

describe('updateContext', () => {
	const sha1 = (text: string) => createHash('sha1').update(text).digest('hex');

	afterEach(() => vi.useRealTimers());

	it('sends the photos as an array, the context as is, and signs the ids comma-joined', async () => {
		vi.useFakeTimers().setSystemTime(1_700_000_000_000);
		const fetchFn = vi.fn().mockResolvedValue(jsonResponse({}));

		await updateContext(makeConfig(fetchFn as typeof fetch), 'add', ['a', 'b/c'], 'caption=Playa|year=1975');

		expect(fetchFn.mock.calls[0][0]).toBe('https://api.example/v1_1/testcloud/image/context');
		const body = fetchFn.mock.calls[0][1].body as URLSearchParams;
		expect(body.getAll('public_ids[]')).toEqual(['a', 'b/c']);
		expect(body.get('command')).toBe('add');
		expect(body.get('context')).toBe('caption=Playa|year=1975');
		expect(body.get('api_key')).toBe('key123');
		expect(body.get('timestamp')).toBe('1700000000');
		expect(body.get('signature')).toBe(
			sha1('command=add&context=caption=Playa|year=1975&public_ids=a,b/c&timestamp=1700000000secret123')
		);
	});

	it('sends no context to remove them all', async () => {
		vi.useFakeTimers().setSystemTime(1_700_000_000_000);
		const fetchFn = vi.fn().mockResolvedValue(jsonResponse({}));

		await updateContext(makeConfig(fetchFn as typeof fetch), 'remove_all', ['a']);

		const body = fetchFn.mock.calls[0][1].body as URLSearchParams;
		expect(body.has('context')).toBe(false);
		expect(body.get('signature')).toBe(sha1('command=remove_all&public_ids=a&timestamp=1700000000secret123'));
	});

	it('gives up a call that takes too long', async () => {
		const fetchFn = vi.fn().mockResolvedValue(jsonResponse({}));
		await updateContext(makeConfig(fetchFn as typeof fetch), 'add', ['a'], 'x=y');
		await updateContext(makeConfig(fetchFn as typeof fetch), 'remove_all', ['a']);
		for (const [, init] of fetchFn.mock.calls) expect(init.signal).toBeInstanceOf(AbortSignal);
	});

	it('throws on HTTP error', async () => {
		const fetchFn = vi.fn().mockResolvedValue(jsonResponse({}, 400));
		await expect(updateContext(makeConfig(fetchFn as typeof fetch), 'add', ['a'], 'x=y')).rejects.toThrow(
			'Cloudinary context API failed: 400'
		);
	});
});

describe('getContexts', () => {
	const basic = 'Basic ' + Buffer.from('key123:secret123').toString('base64');

	it('is a 3 second wait at most', () => {
		expect(CONTEXT_CALL_TIMEOUT_MS).toBe(3000);
	});

	it('asks the Admin API for the context of the photos, authenticated, with a time limit', async () => {
		const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ resources: [] }));

		await getContexts(makeConfig(fetchFn as typeof fetch), ['a', 'b/c', 'd e']);

		const [url, init] = fetchFn.mock.calls[0];
		const asked = new URL(url);
		expect(`${asked.origin}${asked.pathname}`).toBe('https://api.example/v1_1/testcloud/resources/image/upload');
		expect(asked.searchParams.getAll('public_ids[]')).toEqual(['a', 'b/c', 'd e']);
		expect(asked.searchParams.get('context')).toBe('true');
		expect(asked.searchParams.get('max_results')).toBe('100');
		expect(init.method ?? 'GET').toBe('GET');
		expect(init.headers.Authorization).toBe(basic);
		expect(init.signal).toBeInstanceOf(AbortSignal);
	});

	it('maps each photo it gets back to its context, and says nothing of the ones it does not get', async () => {
		const fetchFn = vi.fn().mockResolvedValue(
			jsonResponse({
				resources: [
					{ public_id: 'a', context: { custom: { caption: 'Playa', alt: 'x' } } },
					{ public_id: 'b' },
					{ public_id: 'c', context: { custom: {} } }
				]
			})
		);

		const contexts = await getContexts(makeConfig(fetchFn as typeof fetch), ['a', 'b', 'c', 'gone']);

		expect([...contexts.keys()]).toEqual(['a', 'b', 'c']);
		expect(contexts.get('a')).toEqual({ custom: { caption: 'Playa', alt: 'x' } });
		// A photo with no context is there, with nothing: it is not the same as a photo that was not returned.
		expect(contexts.has('b')).toBe(true);
		expect(contexts.get('b')).toBeUndefined();
		expect(contexts.get('c')).toEqual({ custom: {} });
		expect(contexts.has('gone')).toBe(false);
	});

	it('does not call at all when there is nothing to ask for', async () => {
		const fetchFn = vi.fn();
		expect(await getContexts(makeConfig(fetchFn as typeof fetch), [])).toEqual(new Map());
		expect(fetchFn).not.toHaveBeenCalled();
	});

	it('throws on HTTP error', async () => {
		const fetchFn = vi.fn().mockResolvedValue(jsonResponse({}, 401));
		await expect(getContexts(makeConfig(fetchFn as typeof fetch), ['a'])).rejects.toThrow(
			'Cloudinary resources API failed: 401'
		);
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
			{ publicId: 'a1', folder: '', format: 'jpg', width: 10, height: 20, favorite: true, ...noAnnotation() },
			{ publicId: 'demo/b2', folder: 'demo', format: 'png', width: 30, height: 40, favorite: false, ...noAnnotation() }
		]);
	});

	it('asks for the context and maps it to the annotation, keeping the keys that are not ours', async () => {
		const fetchFn = vi.fn().mockResolvedValueOnce(
			jsonResponse({
				resources: [
					{
						public_id: 'a1',
						folder: '',
						format: 'jpg',
						width: 10,
						height: 20,
						context: { custom: { caption: 'Playa', year: '1975', people: 'Ana, Luis', alt: 'texto' } }
					},
					{ public_id: 'a2', folder: '', format: 'jpg', width: 10, height: 20, context: { custom: { year: 'circa 1975' } } }
				]
			})
		);

		const photos = await searchAllPhotos(makeConfig(fetchFn as typeof fetch), 'resource_type:image');

		expect(JSON.parse(fetchFn.mock.calls[0][1].body as string).with_field).toEqual(['tags', 'context']);
		expect(photos[0]).toMatchObject({ caption: 'Playa', year: 1975, people: ['Ana', 'Luis'], extraContext: { alt: 'texto' } });
		// A year nobody can read is not shown, but it is not lost either.
		expect(photos[1]).toEqual({
			publicId: 'a2', folder: '', format: 'jpg', width: 10, height: 20, favorite: false, ...noAnnotation(),
			extraContext: { year: 'circa 1975' }
		});
	});

	it('throws on HTTP error', async () => {
		const fetchFn = vi.fn().mockResolvedValue(jsonResponse({}, 401));
		await expect(
			searchAllPhotos(makeConfig(fetchFn as typeof fetch), 'resource_type:image')
		).rejects.toThrow('Cloudinary search failed: 401');
	});
});
