import { fullUrl } from './cdn';
import type { Photo } from './types';

/** What came of sharing a photo. `'cancelled'` is the person closing the share sheet: not a failure. */
export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

/** The parts of the browser that sharing uses, so that they can be replaced in tests. */
export interface ShareTools {
	navigator: Pick<Navigator, 'share' | 'canShare' | 'clipboard'>;
	origin: string;
}

/** The link to a photo in the app. It asks for the family's password: the person it is sent to needs it. */
export const photoLink = (origin: string, publicId: string): string => `${origin}/app/photo/${publicId}`;

/** Whether this device can share image files (phones can; most computers cannot). */
export function canShareFiles(nav: Pick<Navigator, 'canShare'>): boolean {
	try {
		return nav.canShare?.({ files: [new File([], 'photo.jpg', { type: 'image/jpeg' })] }) ?? false;
	} catch {
		return false;
	}
}

const EXTENSIONS: Record<string, string> = {
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp',
	'image/avif': 'avif',
	'image/gif': 'gif'
};

/**
 * The photo at the viewer's size (about 1600 px, not the original) as a file to share, or `null` when it
 * cannot be had (the network, or the CDN not allowing this page to read it). Meant to be done before the
 * button is pressed: some browsers only let a share start close to the press, and a download in between
 * would be too late.
 */
export async function prepareShareFile(
	cloudName: string,
	photo: Photo,
	fetchFn: typeof fetch = fetch,
	signal?: AbortSignal
): Promise<File | null> {
	try {
		const response = await fetchFn(fullUrl(cloudName, photo), { signal });
		if (!response.ok) return null;
		const blob = await response.blob();
		if (!blob.type.startsWith('image/')) return null;
		const name = photo.publicId.split('/').pop() || 'foto';
		return new File([blob], `${name}.${EXTENSIONS[blob.type] ?? photo.format}`, { type: blob.type });
	} catch {
		return null;
	}
}

const isCancel = (error: unknown): boolean => error instanceof DOMException && error.name === 'AbortError';

/**
 * Shares a photo the best way the device allows: the image itself where files can be shared; else the link
 * through the device's share sheet; else the link on the clipboard.
 */
export async function sharePhoto(
	photo: Photo,
	file: File | null,
	{ navigator: nav, origin }: ShareTools
): Promise<ShareOutcome> {
	if (file && nav.canShare?.({ files: [file] })) {
		try {
			await nav.share({ files: [file], title: photo.caption || photo.publicId });
			return 'shared';
		} catch (error) {
			if (isCancel(error)) return 'cancelled';
			// The browser said no after all: the link still goes.
		}
	}

	const url = photoLink(origin, photo.publicId);
	if (typeof nav.share === 'function') {
		try {
			await nav.share({ url, title: photo.caption || photo.publicId });
			return 'shared';
		} catch (error) {
			if (isCancel(error)) return 'cancelled';
		}
	}

	try {
		await nav.clipboard.writeText(url);
		return 'copied';
	} catch {
		return 'failed';
	}
}
