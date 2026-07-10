import { invalidateFamilyIndex } from '$lib/server/photos';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = () => {
	invalidateFamilyIndex();
	return new Response(null, { status: 204 });
};
