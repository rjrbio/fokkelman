import { json } from '@sveltejs/kit';
import { createUploadSignature } from '$lib/server/cloudinary';
import { cloudinaryConfig, getFamilyIndex, resolveUploadFolder } from '$lib/server/photos';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json().catch(() => null)) as { folder?: unknown } | null;
	const requested = typeof body?.folder === 'string' ? body.folder : '';

	const index = await getFamilyIndex();
	const folder = resolveUploadFolder(
		requested,
		index.photos.map((p) => p.folder)
	);

	return json(createUploadSignature(cloudinaryConfig(), folder));
};
