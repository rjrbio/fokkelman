import { fold } from './annotations';
import type { Photo } from './types';

export interface GalleryFilters {
	folder: string;
	query: string;
	favoritesOnly: boolean;
	/** The name of a person in the photo; `''` for everybody. */
	person: string;
	/** A decade ("1970"), or `NO_DECADE` for the photos with no year; `''` for any. */
	decade: string;
	/** Only the photos nobody has described yet: no year and no people. */
	unidentified: boolean;
}

export const NO_FILTERS: GalleryFilters = {
	folder: '',
	query: '',
	favoritesOnly: false,
	person: '',
	decade: '',
	unidentified: false
};

/** The value of `GalleryFilters.decade` that means "no year". */
export const NO_DECADE = 'sin';

/** 1975 -> 1970. */
export const decadeOf = (year: number): number => Math.floor(year / 10) * 10;

/** A photo nobody has described yet: no year and nobody in it. */
export const isUnidentified = (photo: Pick<Photo, 'year' | 'people'>): boolean =>
	photo.year === null && photo.people.length === 0;

/** The decades that have photos, the oldest first. */
export function decadesOf(photos: Pick<Photo, 'year'>[]): number[] {
	const decades = new Set<number>();
	for (const { year } of photos) if (year !== null) decades.add(decadeOf(year));
	return [...decades].sort((a, b) => a - b);
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
	const person = fold(filters.person);
	return photos.filter(
		(p) =>
			(!filters.folder || p.folder === filters.folder) &&
			(!filters.favoritesOnly || p.favorite) &&
			(!person || p.people.some((name) => fold(name) === person)) &&
			matchesDecade(p, filters.decade) &&
			(!filters.unidentified || isUnidentified(p)) &&
			(words.length === 0 || words.every((word) => searchText(p).includes(word)))
	);
}

function matchesDecade(photo: Pick<Photo, 'year'>, decade: string): boolean {
	if (!decade) return true;
	if (decade === NO_DECADE) return photo.year === null;
	return photo.year !== null && decadeOf(photo.year) === Number(decade);
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
	const decade = params.get('decada') ?? '';
	return {
		folder: params.get('folder') ?? '',
		query: params.get('q') ?? '',
		favoritesOnly: params.get('fav') === '1',
		person: params.get('persona') ?? '',
		// Anything that is not a decade is ignored: the URL is typed by hand or shared.
		decade: decade === NO_DECADE || /^\d{3}0$/.test(decade) ? decade : '',
		unidentified: params.get('sin') === '1'
	};
}

/** Inverse of `filtersFromSearchParams`: `''` when no filter is active, otherwise `?folder=…&q=…&fav=1&persona=…`. */
export function filtersToSearch(filters: GalleryFilters): string {
	const params = new URLSearchParams();
	if (filters.folder) params.set('folder', filters.folder);
	if (filters.query) params.set('q', filters.query);
	if (filters.favoritesOnly) params.set('fav', '1');
	if (filters.person) params.set('persona', filters.person);
	if (filters.decade) params.set('decada', filters.decade);
	if (filters.unidentified) params.set('sin', '1');
	const qs = params.toString();
	return qs ? `?${qs}` : '';
}

export function uniqueFolders(photos: Photo[]): string[] {
	return [...new Set(photos.map((p) => p.folder).filter(Boolean))].sort();
}
