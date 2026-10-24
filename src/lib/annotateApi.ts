import type { AnnotationPatch } from './annotations';

/**
 * Sends a patch for some photos to the server (the browser's side of `POST /api/annotate`).
 * Clearing a field takes two calls to Cloudinary, so it gets longer than a favorite does.
 */
export const postAnnotation = (publicIds: string[], patch: AnnotationPatch): Promise<Response> =>
	fetch('/api/annotate', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ publicIds, patch }),
		signal: AbortSignal.timeout(30000)
	});
