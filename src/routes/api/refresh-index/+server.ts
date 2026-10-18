import { requireAuthed } from '$lib/server/guard';
import { invalidateFamilyIndex } from '$lib/server/photos';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = ({ locals }) => {
	requireAuthed(locals);
	invalidateFamilyIndex();
	return new Response(null, { status: 204 });
};
