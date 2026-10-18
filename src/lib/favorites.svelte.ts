import { SvelteMap } from 'svelte/reactivity';
import { applyFavoriteOverrides } from './favorites';
import type { Photo } from './types';

// Browser only: never call from server code (module state is shared across requests).

/** Favorite changes made in this session that the server-rendered index may not reflect yet. */
const overrides = new SvelteMap<string, boolean>();
const inFlight = new Set<string>();

/** How long the "could not save" message stays up before it dismisses itself. */
export const FAVORITE_FAILURE_MS = 5000;

/** The photo whose last favorite change could not be saved, or `null`. Read it inside a template/`$derived`. */
export const favoriteFailure = $state<{ publicId: string | null }>({ publicId: null });
let failureTimer: ReturnType<typeof setTimeout> | undefined;

export function dismissFavoriteFailure(): void {
	clearTimeout(failureTimer);
	failureTimer = undefined;
	favoriteFailure.publicId = null;
}

function reportFavoriteFailure(publicId: string): void {
	dismissFavoriteFailure();
	favoriteFailure.publicId = publicId;
	failureTimer = setTimeout(dismissFavoriteFailure, FAVORITE_FAILURE_MS);
}

/** Call inside a `$derived`/template: it tracks the overrides, so the list updates on every toggle. */
export const withFavoriteOverrides = (photos: Photo[]): Photo[] =>
	applyFavoriteOverrides(photos, overrides);

/** Drop the overrides once fresh server data has arrived. */
export const clearFavoriteOverrides = (): void => overrides.clear();

export type ToggleOutcome = 'done' | 'failed' | 'unauthorized' | 'busy';

/**
 * Flips the favorite flag right away and reverts if the request fails. At most one request
 * per photo is in flight; extra taps while it is pending are ignored (`'busy'`). A failed save
 * is also published in `favoriteFailure` so the app can tell the user wherever they are.
 */
export async function toggleFavorite(
	photo: Pick<Photo, 'publicId' | 'favorite'>,
	send: (publicId: string, favorite: boolean) => Promise<Response>
): Promise<ToggleOutcome> {
	const { publicId } = photo;
	if (inFlight.has(publicId)) return 'busy';
	inFlight.add(publicId);
	dismissFavoriteFailure();

	const previous = overrides.get(publicId);
	const revert = () => (previous === undefined ? overrides.delete(publicId) : overrides.set(publicId, previous));
	const fail = (): ToggleOutcome => {
		revert();
		reportFavoriteFailure(publicId);
		return 'failed';
	};

	const next = !photo.favorite;
	overrides.set(publicId, next);
	try {
		const response = await send(publicId, next);
		if (response.ok) return 'done';
		if (response.status === 401) {
			revert();
			return 'unauthorized';
		}
		return fail();
	} catch {
		return fail();
	} finally {
		inFlight.delete(publicId);
	}
}
