import { json } from '@sveltejs/kit';
import { createUploadSignature } from '$lib/server/cloudinary';
import { requireAuthed } from '$lib/server/guard';
import { cloudinaryConfig, getFamilyIndex, resolveUploadFolder } from '$lib/server/photos';
import { uploadContextFrom } from '$lib/server/uploadContext';
import type { RequestHandler } from './$types';

/**
 * `{ folder, caption?, year?, people? }`: the signature for one upload. What the photo is to be called is
 * checked like an edit and turned into the context here, and signed with the rest.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	requireAuthed(locals);
	const body = (await request.json().catch(() => null)) as {
		folder?: unknown;
		caption?: unknown;
		year?: unknown;
		people?: unknown;
	} | null;
	const requested = typeof body?.folder === 'string' ? body.folder : '';

	const metadata = uploadContextFrom(body ?? {});
	if (!metadata.ok) {
		return json(
			{ message: 'Invalid photo data', problem: metadata.problem },
			{ status: metadata.problem === 'too-many-people' ? 422 : 400 }
		);
	}

	const index = await getFamilyIndex();
	const folder = resolveUploadFolder(
		requested,
		index.photos.map((p) => p.folder)
	);

	return json(createUploadSignature(cloudinaryConfig(), folder, { context: metadata.context }));
};
