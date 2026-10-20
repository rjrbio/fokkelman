import { createHash } from 'node:crypto';
import type { Photo } from '$lib/types';
import { noAnnotation } from '$lib/annotations';

export interface CloudinaryConfig {
	cloudName: string;
	apiKey: string;
	apiSecret: string;
	/** default https://api.cloudinary.com; en tests/e2e apunta al mock */
	apiBase: string;
	fetchFn: typeof fetch;
}

export function signParams(params: Record<string, string | number>, apiSecret: string): string {
	const toSign = Object.keys(params)
		.sort()
		.map((k) => `${k}=${params[k]}`)
		.join('&');
	return createHash('sha1').update(toSign + apiSecret).digest('hex');
}

export interface UploadSignature {
	cloudName: string;
	apiKey: string;
	timestamp: number;
	folder: string;
	signature: string;
}

export function createUploadSignature(
	cfg: CloudinaryConfig,
	folder: string,
	now: number = Date.now()
): UploadSignature {
	const timestamp = Math.floor(now / 1000);
	return {
		cloudName: cfg.cloudName,
		apiKey: cfg.apiKey,
		timestamp,
		folder,
		signature: signParams({ folder, timestamp }, cfg.apiSecret)
	};
}

export async function setFavorite(
	cfg: CloudinaryConfig,
	publicId: string,
	favorite: boolean
): Promise<void> {
	const params = {
		command: favorite ? 'add' : 'remove',
		public_ids: publicId,
		tag: 'favorite',
		timestamp: Math.floor(Date.now() / 1000)
	};
	const body = new URLSearchParams({
		command: params.command,
		public_ids: params.public_ids,
		tag: params.tag,
		timestamp: String(params.timestamp),
		api_key: cfg.apiKey,
		signature: signParams(params, cfg.apiSecret)
	});
	const res = await cfg.fetchFn(`${cfg.apiBase}/v1_1/${cfg.cloudName}/image/tags`, {
		method: 'POST',
		body
	});
	if (!res.ok) throw new Error(`Cloudinary tags API failed: ${res.status}`);
}

interface SearchResource {
	public_id: string;
	folder?: string;
	format: string;
	width: number;
	height: number;
	tags?: string[];
}

export async function searchAllPhotos(
	cfg: CloudinaryConfig,
	expression: string
): Promise<Photo[]> {
	const photos: Photo[] = [];
	const auth = 'Basic ' + Buffer.from(`${cfg.apiKey}:${cfg.apiSecret}`).toString('base64');
	let nextCursor: string | undefined;
	do {
		const res = await cfg.fetchFn(`${cfg.apiBase}/v1_1/${cfg.cloudName}/resources/search`, {
			method: 'POST',
			headers: { Authorization: auth, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				expression,
				max_results: 500,
				with_field: ['tags'],
				sort_by: [{ public_id: 'asc' }],
				...(nextCursor ? { next_cursor: nextCursor } : {})
			})
		});
		if (!res.ok) throw new Error(`Cloudinary search failed: ${res.status}`);
		const data = (await res.json()) as { resources: SearchResource[]; next_cursor?: string };
		for (const r of data.resources) {
			photos.push({
				publicId: r.public_id,
				folder: r.folder ?? '',
				format: r.format,
				width: r.width,
				height: r.height,
				favorite: (r.tags ?? []).includes('favorite'),
				...noAnnotation()
			});
		}
		nextCursor = data.next_cursor;
	} while (nextCursor);
	return photos;
}
