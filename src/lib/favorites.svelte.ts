import { SvelteMap } from 'svelte/reactivity';
import { applyFavoriteOverrides } from './favorites';
import type { Photo } from './types';

/** Favorite changes made in this session that the server-rendered index may not reflect yet. */
const overrides = new SvelteMap<string, boolean>();
const inFlight = new Set<string>();

/** Call inside a `$derived`/template: it tracks the overrides, so the list updates on every toggle. */
export const withFavoriteOverrides = (photos: Photo[]): Photo[] =>
	applyFavoriteOverrides(photos, overrides);

/** Drop the overrides once fresh server data has arrived. */
export const clearFavoriteOverrides = (): void => overrides.clear();

export type ToggleOutcome = 'done' | 'failed' | 'unauthorized' | 'busy';

/**
 * Flips the favorite flag right away and reverts if the request fails. At most one request
 * per photo is in flight; extra taps while it is pending are ignored (`'busy'`).
 */
export async function toggleFavorite(
	photo: Pick<Photo, 'publicId' | 'favorite'>,
	send: (publicId: string, favorite: boolean) => Promise<Response>
): Promise<ToggleOutcome> {
	const { publicId } = photo;
	if (inFlight.has(publicId)) return 'busy';
	inFlight.add(publicId);

	const previous = overrides.get(publicId);
	const revert = () => (previous === undefined ? overrides.delete(publicId) : overrides.set(publicId, previous));

	overrides.set(publicId, !photo.favorite);
	try {
		const response = await send(publicId, !photo.favorite);
		if (response.ok) return 'done';
		revert();
		return response.status === 401 ? 'unauthorized' : 'failed';
	} catch {
		revert();
		return 'failed';
	} finally {
		inFlight.delete(publicId);
	}
}
