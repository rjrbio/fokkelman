import { describe, expect, it, vi } from 'vitest';
import { noAnnotation } from './annotations';
import { canShareFiles, photoLink, prepareShareFile, sharePhoto, type ShareTools } from './share';
import type { Photo } from './types';

const photo = (fields: Partial<Photo> = {}): Photo => ({
	publicId: 'family_uploads/IMG_0001',
	folder: 'family_uploads',
	format: 'jpg',
	width: 800,
	height: 600,
	favorite: false,
	...noAnnotation(),
	...fields
});

const file = new File(['x'], 'IMG_0001.jpg', { type: 'image/jpeg' });
const abort = () => new DOMException('closed', 'AbortError');

function tools(nav: Partial<Pick<Navigator, 'share' | 'canShare'>> & { clipboard?: { writeText: (t: string) => Promise<void> } } = {}) {
	return {
		navigator: { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) }, ...nav } as unknown as ShareTools['navigator'],
		origin: 'https://fokkelman.example'
	};
}

describe('photoLink', () => {
	it('points at the photo in the app', () => {
		expect(photoLink('https://x.example', 'a/b')).toBe('https://x.example/app/photo/a/b');
	});
});

describe('canShareFiles', () => {
	it('asks the browser with a file of the kind that would be shared', () => {
		const canShare = vi.fn().mockReturnValue(true);
		expect(canShareFiles({ canShare })).toBe(true);
		expect(canShare.mock.calls[0][0].files[0].type).toBe('image/jpeg');
	});

	it('is no when the browser cannot, or has no such thing, or throws', () => {
		expect(canShareFiles({ canShare: () => false })).toBe(false);
		expect(canShareFiles({} as never)).toBe(false);
		expect(
			canShareFiles({
				canShare: () => {
					throw new Error('nope');
				}
			})
		).toBe(false);
	});
});

describe('prepareShareFile', () => {
	const respond = (body: BlobPart, type: string, status = 200) =>
		vi.fn().mockResolvedValue(new Response(new Blob([body], { type }), { status }));

	it('fetches the viewer size of the photo as a file named after it, with the kind the CDN sent', async () => {
		const fetchFn = respond('bytes', 'image/webp');

		const result = await prepareShareFile('testcloud', photo(), fetchFn);

		expect(fetchFn.mock.calls[0][0]).toBe('https://res.cloudinary.com/testcloud/image/upload/c_limit,f_auto,q_auto,w_1600/family_uploads/IMG_0001');
		expect(result).toBeInstanceOf(File);
		expect(result?.name).toBe('IMG_0001.webp');
		expect(result?.type).toBe('image/webp');
	});

	it('falls back to the format of the photo for a kind it does not know', async () => {
		const result = await prepareShareFile('testcloud', photo({ format: 'heic' }), respond('x', 'image/heic'));
		expect(result?.name).toBe('IMG_0001.heic');
	});

	it('is null when the CDN says no, when it is not an image, and when the network fails', async () => {
		expect(await prepareShareFile('c', photo(), respond('x', 'image/jpeg', 404))).toBeNull();
		expect(await prepareShareFile('c', photo(), respond('<html>', 'text/html'))).toBeNull();
		expect(await prepareShareFile('c', photo(), vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))).toBeNull();
	});

	it('can be called off', async () => {
		const controller = new AbortController();
		const fetchFn = vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(abort()))));
		const pending = prepareShareFile('c', photo(), fetchFn as never, controller.signal);
		controller.abort();
		expect(await pending).toBeNull();
	});
});

describe('sharePhoto', () => {
	it('shares the image itself where the device can share files', async () => {
		const share = vi.fn().mockResolvedValue(undefined);
		const outcome = await sharePhoto(photo({ caption: 'Playa' }), file, tools({ share, canShare: () => true }));

		expect(outcome).toBe('shared');
		expect(share).toHaveBeenCalledWith({ files: [file], title: 'Playa' });
	});

	it('names the photo by its file when it has no description', async () => {
		const share = vi.fn().mockResolvedValue(undefined);
		await sharePhoto(photo(), file, tools({ share, canShare: () => true }));
		expect(share.mock.calls[0][0].title).toBe('family_uploads/IMG_0001');
	});

	it('is not a failure when the person closes the share sheet, and nothing else is tried', async () => {
		const share = vi.fn().mockRejectedValue(abort());
		const t = tools({ share, canShare: () => true });

		expect(await sharePhoto(photo(), file, t)).toBe('cancelled');

		expect(share).toHaveBeenCalledTimes(1);
		expect(t.navigator.clipboard.writeText).not.toHaveBeenCalled();
	});

	it('sends the link through the share sheet when there is no file, or files cannot be shared', async () => {
		const share = vi.fn().mockResolvedValue(undefined);

		expect(await sharePhoto(photo(), null, tools({ share, canShare: () => true }))).toBe('shared');
		expect(await sharePhoto(photo(), file, tools({ share, canShare: () => false }))).toBe('shared');

		expect(share.mock.calls.map((call) => call[0].url)).toEqual([
			'https://fokkelman.example/app/photo/family_uploads/IMG_0001',
			'https://fokkelman.example/app/photo/family_uploads/IMG_0001'
		]);
	});

	it('goes on to the link when the browser refuses the file after saying it could', async () => {
		const share = vi
			.fn()
			.mockRejectedValueOnce(new DOMException('no', 'NotAllowedError'))
			.mockResolvedValueOnce(undefined);

		expect(await sharePhoto(photo(), file, tools({ share, canShare: () => true }))).toBe('shared');

		expect(share.mock.calls[1][0].url).toContain('/app/photo/');
	});

	it('copies the link when there is no share sheet at all', async () => {
		const t = tools();
		expect(await sharePhoto(photo(), file, t)).toBe('copied');
		expect(t.navigator.clipboard.writeText).toHaveBeenCalledWith('https://fokkelman.example/app/photo/family_uploads/IMG_0001');
	});

	it('is a failure only when nothing works', async () => {
		const clipboard = { writeText: vi.fn().mockRejectedValue(new Error('denied')) };
		expect(await sharePhoto(photo(), null, tools({ clipboard }))).toBe('failed');
		expect(await sharePhoto(photo(), null, { navigator: {} as never, origin: 'https://x' })).toBe('failed');
	});
});
