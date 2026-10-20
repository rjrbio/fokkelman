import { fold } from './annotations';
import type { Photo } from './types';

export interface GalleryFilters {
	folder: string;
	query: string;
	favoritesOnly: boolean;
}

/** Everything a search looks into, in lower case and without accents. */
const searchText = (p: Photo): string =>
	fold([p.publicId, p.caption, ...p.people, p.year ?? ''].join(' '));

/**
 * Every word of the query has to appear somewhere in the file name, the caption, the people or the
 * year, whatever the case or the accents: "maria 1975" finds "María" in a photo of 1975.
 */
export function filterPhotos(photos: Photo[], filters: GalleryFilters): Photo[] {
	const words = fold(filters.query).split(/\s+/).filter(Boolean);
	return photos.filter(
		(p) =>
			(!filters.folder || p.folder === filters.folder) &&
			(!filters.favoritesOnly || p.favorite) &&
			(words.length === 0 || words.every((word) => searchText(p).includes(word)))
	);
}

/**
 * The order of the gallery: the oldest year first, the photos with no year at the end, and by file
 * name within the same year. A new array; the one given is left as it was.
 */
export function sortPhotos(photos: Photo[]): Photo[] {
	return [...photos].sort((a, b) => {
		if (a.year !== b.year) {
			if (a.year === null) return 1;
			if (b.year === null) return -1;
			return a.year - b.year;
		}
		return a.publicId < b.publicId ? -1 : a.publicId > b.publicId ? 1 : 0;
	});
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
