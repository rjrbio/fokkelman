import type { Photo } from './types';

/** `photos` with the user's pending favorite changes applied; the same array when there are none. */
export function applyFavoriteOverrides(
	photos: Photo[],
	overrides: ReadonlyMap<string, boolean>
): Photo[] {
	if (overrides.size === 0) return photos;
	return photos.map((p) => {
		const override = overrides.get(p.publicId);
		return override === undefined || override === p.favorite ? p : { ...p, favorite: override };
	});
}
