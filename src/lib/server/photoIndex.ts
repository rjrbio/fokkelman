import type { Photo, PhotoIndex } from '$lib/types';

export interface IndexCache {
	get(): Promise<PhotoIndex>;
	invalidate(): void;
	/** Applies an update to the cached copy without refetching; a no-op when nothing is cached. */
	patch(mutate: (photos: Photo[]) => Photo[]): void;
}

export function createIndexCache(
	fetcher: () => Promise<Photo[]>,
	ttlMs = 5 * 60_000,
	nowFn: () => number = () => Date.now()
): IndexCache {
	let cached: { photos: Photo[]; fetchedAt: number } | null = null;

	return {
		async get(): Promise<PhotoIndex> {
			const now = nowFn();
			if (cached && now - cached.fetchedAt < ttlMs) {
				return { ...cached, stale: false };
			}
			try {
				const photos = await fetcher();
				cached = { photos, fetchedAt: now };
				return { photos, fetchedAt: now, stale: false };
			} catch (err) {
				if (cached) return { ...cached, stale: true };
				throw err;
			}
		},
		invalidate() {
			cached = null;
		},
		patch(mutate) {
			if (cached) cached = { ...cached, photos: mutate(cached.photos) };
		}
	};
}

export function withFavorite(photos: Photo[], publicId: string, favorite: boolean): Photo[] {
	return photos.map((p) => (p.publicId === publicId ? { ...p, favorite } : p));
}
