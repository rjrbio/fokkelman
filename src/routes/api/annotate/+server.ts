import { json } from '@sveltejs/kit';
import { MAX_PHOTOS_PER_REQUEST, parsePatch } from '$lib/annotations';
import { requireAuthed } from '$lib/server/guard';
import { annotatePhotos } from '$lib/server/photos';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	requireAuthed(locals);
	const body = (await request.json().catch(() => null)) as { publicIds?: unknown; patch?: unknown } | null;

	const ids = body?.publicIds;
	if (
		!Array.isArray(ids) ||
		ids.length === 0 ||
		ids.length > MAX_PHOTOS_PER_REQUEST ||
		ids.some((id) => typeof id !== 'string' || id === '')
	) {
		return json(
			{ message: `publicIds (1 to ${MAX_PHOTOS_PER_REQUEST} strings) and patch are required`, problem: 'bad-shape' },
			{ status: 400 }
		);
	}

	const patch = parsePatch(body?.patch);
	if (!patch.ok) return json({ message: 'Invalid patch', problem: patch.problem }, { status: 400 });

	const outcome = await annotatePhotos([...new Set(ids as string[])], patch.value);
	if (outcome.status === 'unknown-photo') return json({ message: 'Unknown photo' }, { status: 404 });
	if (outcome.status === 'unavailable') {
		return json({ message: 'Could not read the current photo data', problem: 'unavailable' }, { status: 503 });
	}
	if (outcome.status === 'rejected') {
		return json({ message: 'Cannot apply the patch', problem: outcome.problem }, { status: 422 });
	}
	return json({ updated: outcome.updated, failed: outcome.failed });
};
