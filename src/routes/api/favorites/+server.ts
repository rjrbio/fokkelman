import { json } from '@sveltejs/kit';
import { MAX_PHOTOS_PER_REQUEST } from '$lib/annotations';
import { requireAuthed } from '$lib/server/guard';
import { markFavorites } from '$lib/server/photos';
import type { RequestHandler } from './$types';

/** Many photos at once: `{ publicIds, favorite }`. (`/api/favorite` is the one-photo version.) */
export const POST: RequestHandler = async ({ request, locals }) => {
	requireAuthed(locals);
	const body = (await request.json().catch(() => null)) as { publicIds?: unknown; favorite?: unknown } | null;

	const ids = body?.publicIds;
	if (
		!Array.isArray(ids) ||
		ids.length === 0 ||
		ids.length > MAX_PHOTOS_PER_REQUEST ||
		ids.some((id) => typeof id !== 'string' || id === '') ||
		typeof body?.favorite !== 'boolean'
	) {
		return json(
			{ message: `publicIds (1 to ${MAX_PHOTOS_PER_REQUEST} strings) and favorite (boolean) are required` },
			{ status: 400 }
		);
	}

	const outcome = await markFavorites([...new Set(ids as string[])], body.favorite);
	if (outcome.status === 'unknown-photo') return json({ message: 'Unknown photo' }, { status: 404 });
	return json({ done: outcome.done, failed: outcome.failed });
};
