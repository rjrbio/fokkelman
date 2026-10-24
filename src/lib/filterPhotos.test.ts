import { describe, expect, it } from 'vitest';
import {
	decadeOf,
	decadesOf,
	filterPhotos,
	filtersFromSearchParams,
	filtersToSearch,
	isUnidentified,
	NO_DECADE,
	NO_FILTERS,
	sortPhotos,
	uniqueFolders,
	type GalleryFilters
} from './filterPhotos';
import type { Photo } from './types';
import { noAnnotation } from './annotations';

const photo = (publicId: string, folder = '', favorite = false, fields: Partial<Photo> = {}): Photo => ({
	publicId,
	folder,
	format: 'jpg',
	width: 1,
	height: 1,
	favorite,
	...noAnnotation(),
	...fields
});

const filters = (over: Partial<GalleryFilters>): GalleryFilters => ({ ...NO_FILTERS, ...over });

const photos = [
	photo('Fokkelman10_001_ab'),
	photo('family_uploads/beach_x1', 'family_uploads', true),
	photo('family_uploads/BEACH_x2', 'family_uploads')
];

describe('filterPhotos', () => {
	it('returns everything with empty filters', () => {
		expect(filterPhotos(photos, NO_FILTERS)).toHaveLength(3);
	});

	it('filters by exact folder', () => {
		const result = filterPhotos(photos, filters({ folder: 'family_uploads' }));
		expect(result.map((p) => p.publicId)).toEqual([
			'family_uploads/beach_x1',
			'family_uploads/BEACH_x2'
		]);
	});

	it('filters by case-insensitive substring of publicId', () => {
		const result = filterPhotos(photos, filters({ query: 'beach' }));
		expect(result).toHaveLength(2);
	});

	it('filters favorites only, combinable with the rest', () => {
		const result = filterPhotos(photos, filters({ folder: 'family_uploads', query: 'beach', favoritesOnly: true }));
		expect(result.map((p) => p.publicId)).toEqual(['family_uploads/beach_x1']);
	});
});

describe('searching the annotations', () => {
	const library = [
		photo('a', '', false, { caption: 'Cumpleaños de María', year: 1975, people: ['María', 'Luis'] }),
		photo('b', '', false, { caption: 'Playa de Sitges', year: 1982, people: ['Ana'] }),
		photo('c')
	];
	const found = (query: string) => filterPhotos(library, filters({ query })).map((p) => p.publicId);

	it('looks in the caption, the people and the year', () => {
		expect(found('sitges')).toEqual(['b']);
		expect(found('luis')).toEqual(['a']);
		expect(found('1982')).toEqual(['b']);
	});

	it('ignores case and accents, both ways', () => {
		expect(found('MARIA')).toEqual(['a']);
		expect(found('cumpleanos')).toEqual(['a']);
		expect(found('María')).toEqual(['a']);
	});

	it('wants every word, wherever each one is', () => {
		expect(found('maria 1975')).toEqual(['a']);
		expect(found('maria 1982')).toEqual([]);
		expect(found('  luis   playa ')).toEqual([]);
		expect(found('playa ana')).toEqual(['b']);
	});

	it('still finds by file name, and an empty query finds everything', () => {
		expect(found('c')).toEqual(['a', 'c']); // "Cumpleaños" has a c too
		expect(found('   ')).toEqual(['a', 'b', 'c']);
	});

	it('does not look at a year that is not there', () => {
		expect(found('null')).toEqual([]);
	});
});

describe('filtering by person, decade and what is not identified yet', () => {
	const library = [
		photo('a', '', false, { year: 1975, people: ['María', 'Luis'] }),
		photo('b', '', false, { year: 1979, people: ['Ana'] }),
		photo('c', '', false, { year: 1982 }),
		photo('d', '', false, { people: ['Ana'] }),
		photo('e')
	];
	const ids = (over: Partial<GalleryFilters>) => filterPhotos(library, filters(over)).map((p) => p.publicId);

	it('finds the photos a person is in, whatever the case or the accents', () => {
		expect(ids({ person: 'Ana' })).toEqual(['b', 'd']);
		expect(ids({ person: 'maria' })).toEqual(['a']);
		expect(ids({ person: 'Nadie' })).toEqual([]);
	});

	it('does not take a part of a name for a person', () => {
		expect(ids({ person: 'An' })).toEqual([]);
	});

	it('finds the photos of a decade, and the photos with no year', () => {
		expect(ids({ decade: '1970' })).toEqual(['a', 'b']);
		expect(ids({ decade: '1980' })).toEqual(['c']);
		expect(ids({ decade: '1990' })).toEqual([]);
		expect(ids({ decade: NO_DECADE })).toEqual(['d', 'e']);
	});

	it('finds what is not identified: no year and nobody in it', () => {
		expect(ids({ unidentified: true })).toEqual(['e']);
		expect(isUnidentified(library[3])).toBe(false);
		expect(isUnidentified(library[4])).toBe(true);
	});

	it('combines with each other and with the rest of the filters', () => {
		expect(ids({ person: 'Ana', decade: '1970' })).toEqual(['b']);
		expect(ids({ person: 'Ana', decade: NO_DECADE })).toEqual(['d']);
		expect(ids({ decade: '1970', query: 'luis' })).toEqual(['a']);
		expect(ids({ unidentified: true, decade: '1970' })).toEqual([]);
	});

	it('lists the decades that have photos, the oldest first, without repeating them', () => {
		expect(decadesOf(library)).toEqual([1970, 1980]);
		expect(decadesOf([])).toEqual([]);
		expect(decadeOf(1975)).toBe(1970);
		expect(decadeOf(1980)).toBe(1980);
		expect(decadeOf(1800)).toBe(1800);
	});
});

describe('sortPhotos', () => {
	it('puts the oldest year first, the photos with no year last, and orders by name inside a year', () => {
		const sorted = sortPhotos([
			photo('z'),
			photo('b', '', false, { year: 1982 }),
			photo('y', '', false, { year: 1975 }),
			photo('a', '', false, { year: 1982 }),
			photo('c')
		]);
		expect(sorted.map((p) => p.publicId)).toEqual(['y', 'a', 'b', 'c', 'z']);
	});

	it('keeps the code point order of the file names that Cloudinary uses', () => {
		expect(sortPhotos([photo('b'), photo('B'), photo('a')]).map((p) => p.publicId)).toEqual(['B', 'a', 'b']);
	});

	it('does not touch the array it is given', () => {
		const input = [photo('b', '', false, { year: 1990 }), photo('a')];
		sortPhotos(input);
		expect(input.map((p) => p.publicId)).toEqual(['b', 'a']);
	});
});

describe('filtersFromSearchParams', () => {
	it('reads folder, q and fav', () => {
		expect(filtersFromSearchParams(new URLSearchParams('folder=demo&q=cat&fav=1'))).toEqual(
			filters({ folder: 'demo', query: 'cat', favoritesOnly: true })
		);
	});

	it('reads the person, the decade and the unidentified switch', () => {
		expect(filtersFromSearchParams(new URLSearchParams('persona=Ana&decada=1970&sin=1'))).toEqual(
			filters({ person: 'Ana', decade: '1970', unidentified: true })
		);
		expect(filtersFromSearchParams(new URLSearchParams('decada=sin')).decade).toBe(NO_DECADE);
	});

	it('ignores a decade that is not one, because the address can be typed by hand', () => {
		for (const bad of ['1975', '19700', 'abc', '-1970', '1970s', '']) {
			expect(filtersFromSearchParams(new URLSearchParams({ decada: bad })).decade).toBe('');
		}
	});

	it('defaults to empty filters', () => {
		expect(filtersFromSearchParams(new URLSearchParams())).toEqual(NO_FILTERS);
	});
});

describe('uniqueFolders', () => {
	it('returns sorted unique non-root folders', () => {
		expect(uniqueFolders(photos)).toEqual(['family_uploads']);
	});
});

describe('filtersToSearch', () => {
	it('is empty when no filter is active', () => {
		expect(filtersToSearch(NO_FILTERS)).toBe('');
	});

	it('serializes every active filter in a stable order', () => {
		expect(filtersToSearch(filters({ folder: 'family_uploads', query: 'beach', favoritesOnly: true }))).toBe(
			'?folder=family_uploads&q=beach&fav=1'
		);
		expect(filtersToSearch(filters({ person: 'Ana', decade: '1970', unidentified: true }))).toBe(
			'?persona=Ana&decada=1970&sin=1'
		);
	});

	it('round-trips through filtersFromSearchParams, including special characters', () => {
		const active = filters({
			folder: 'vacaciones 2019',
			query: 'ñandú & co',
			favoritesOnly: true,
			person: 'María José',
			decade: NO_DECADE,
			unidentified: true
		});
		expect(filtersFromSearchParams(new URLSearchParams(filtersToSearch(active)))).toEqual(active);
	});
});
