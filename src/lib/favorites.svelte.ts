import { SvelteMap } from 'svelte/reactivity';
import { MAX_PHOTOS_PER_REQUEST } from './annotations';
import { applyFavoriteOverrides } from './favorites';
import type { Photo } from './types';

// Browser only: never call from server code (module state is shared across requests).

/** Favorite changes made in this session that the server-rendered index may not reflect yet. */
const overrides = new SvelteMap<string, boolean>();
const inFlight = new Set<string>();

/** How long the "could not save" message stays up before it dismisses itself. */
export const FAVORITE_FAILURE_MS = 5000;

/**
 * The photo whose last favorite change could not be saved (the first of them, when it was many: `count` says
 * how many), or `null`. Read it inside a template/`$derived`.
 */
export const favoriteFailure = $state<{ publicId: string | null; count: number }>({ publicId: null, count: 0 });
let failureTimer: ReturnType<typeof setTimeout> | undefined;

export function dismissFavoriteFailure(): void {
	clearTimeout(failureTimer);
	failureTimer = undefined;
	favoriteFailure.publicId = null;
	favoriteFailure.count = 0;
}

function reportFavoriteFailure(publicId: string, count = 1): void {
	dismissFavoriteFailure();
	favoriteFailure.publicId = publicId;
	favoriteFailure.count = count;
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

/**
 * The same for many photos at once: they all change right away, and go to the server `MAX_PHOTOS_PER_REQUEST`
 * at a time. The ones the server did not change are taken back, and told about once at the end. An expired
 * session stops it, and what was saved before stays saved. The photos that already are as asked are left alone.
 */
export async function setFavorites(
	photos: Pick<Photo, 'publicId' | 'favorite'>[],
	favorite: boolean,
	send: (publicIds: string[], favorite: boolean) => Promise<Response>
): Promise<ToggleOutcome> {
	const ids = photos.filter((photo) => photo.favorite !== favorite).map((photo) => photo.publicId);
	if (ids.some((id) => inFlight.has(id))) return 'busy';
	dismissFavoriteFailure();
	if (ids.length === 0) return 'done';

	const previous = new Map(ids.map((id) => [id, overrides.get(id)]));
	const revert = (publicIds: string[]) => {
		for (const id of publicIds) {
			const before = previous.get(id);
			if (before === undefined) overrides.delete(id);
			else overrides.set(id, before);
		}
	};
	for (const id of ids) {
		inFlight.add(id);
		overrides.set(id, favorite);
	}

	const failed: string[] = [];
	try {
		for (let start = 0; start < ids.length; start += MAX_PHOTOS_PER_REQUEST) {
			const group = ids.slice(start, start + MAX_PHOTOS_PER_REQUEST);
			try {
				const response = await send(group, favorite);
				if (response.status === 401) {
					revert(ids.slice(start)); // what the earlier groups saved stays
					return 'unauthorized';
				}
				if (!response.ok) {
					failed.push(...group);
					revert(group);
					continue;
				}
				const answer = (await response.json().catch(() => null)) as { failed?: unknown[] } | null;
				const notChanged = (answer?.failed ?? []).filter(
					(id): id is string => typeof id === 'string' && group.includes(id)
				);
				failed.push(...notChanged);
				revert(notChanged);
			} catch {
				failed.push(...group);
				revert(group);
			}
		}
	} finally {
		for (const id of ids) inFlight.delete(id);
	}
	if (failed.length > 0) {
		reportFavoriteFailure(failed[0], failed.length);
		return 'failed';
	}
	return 'done';
}
