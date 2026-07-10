import { json } from '@sveltejs/kit';
import { createUploadSignature } from '$lib/server/cloudinary';
import { cloudinaryConfig, getFamilyIndex, UPLOAD_FOLDER } from '$lib/server/photos';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json().catch(() => null)) as { folder?: unknown } | null;
	const requested = typeof body?.folder === 'string' ? body.folder : '';

	const index = await getFamilyIndex();
	const allowed = new Set([UPLOAD_FOLDER, ...index.photos.map((p) => p.folder).filter(Boolean)]);
	const folder = allowed.has(requested) ? requested : UPLOAD_FOLDER;

	return json(createUploadSignature(cloudinaryConfig(), folder));
};
