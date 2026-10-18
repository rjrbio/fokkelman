import { json } from '@sveltejs/kit';
import { requireAuthed } from '$lib/server/guard';
import { markFavorite } from '$lib/server/photos';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	requireAuthed(locals);
	const body = (await request.json().catch(() => null)) as {
		publicId?: unknown;
		favorite?: unknown;
	} | null;

	if (!body || typeof body.publicId !== 'string' || typeof body.favorite !== 'boolean') {
		return json({ message: 'publicId (string) and favorite (boolean) are required' }, { status: 400 });
	}

	if ((await markFavorite(body.publicId, body.favorite)) === 'unknown-photo') {
		return json({ message: 'Unknown photo' }, { status: 404 });
	}
	return new Response(null, { status: 204 });
};
