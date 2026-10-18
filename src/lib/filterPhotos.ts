import type { Photo } from './types';

export interface GalleryFilters {
	folder: string;
	query: string;
	favoritesOnly: boolean;
}

export function filterPhotos(photos: Photo[], filters: GalleryFilters): Photo[] {
	const q = filters.query.trim().toLowerCase();
	return photos.filter(
		(p) =>
			(!filters.folder || p.folder === filters.folder) &&
			(!filters.favoritesOnly || p.favorite) &&
			(!q || p.publicId.toLowerCase().includes(q))
	);
}

export function filtersFromSearchParams(params: URLSearchParams): GalleryFilters {
	return {
		folder: params.get('folder') ?? '',
		query: params.get('q') ?? '',
		favoritesOnly: params.get('fav') === '1'
	};
}

/** Inverse of `filtersFromSearchParams`: `''` when no filter is active, otherwise `?folder=…&q=…&fav=1`. */
export function filtersToSearch(filters: GalleryFilters): string {
	const params = new URLSearchParams();
	if (filters.folder) params.set('folder', filters.folder);
	if (filters.query) params.set('q', filters.query);
	if (filters.favoritesOnly) params.set('fav', '1');
	const qs = params.toString();
	return qs ? `?${qs}` : '';
}

export function uniqueFolders(photos: Photo[]): string[] {
	return [...new Set(photos.map((p) => p.folder).filter(Boolean))].sort();
}
