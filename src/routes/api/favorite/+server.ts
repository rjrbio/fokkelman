import { json } from '@sveltejs/kit';
import { setFavorite } from '$lib/server/cloudinary';
import { cloudinaryConfig, invalidateFamilyIndex } from '$lib/server/photos';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json().catch(() => null)) as {
		publicId?: unknown;
		favorite?: unknown;
	} | null;

	if (!body || typeof body.publicId !== 'string' || typeof body.favorite !== 'boolean') {
		return json({ message: 'publicId (string) and favorite (boolean) are required' }, { status: 400 });
	}

	await setFavorite(cloudinaryConfig(), body.publicId, body.favorite);
	invalidateFamilyIndex();
	return new Response(null, { status: 204 });
};
