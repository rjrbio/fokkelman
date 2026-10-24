/**
 * Marks or unmarks many photos as favorites on the server (the browser's side of `POST /api/favorites`).
 * A call to Cloudinary for each 100 photos: more than a single favorite, still not worth a minute of waiting.
 */
export const postFavorites = (publicIds: string[], favorite: boolean): Promise<Response> =>
	fetch('/api/favorites', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ publicIds, favorite }),
		signal: AbortSignal.timeout(15000)
	});
