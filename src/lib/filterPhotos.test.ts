import { describe, expect, it } from 'vitest';
import { filterPhotos, filtersFromSearchParams, filtersToSearch, sortPhotos, uniqueFolders } from './filterPhotos';
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

const photos = [
	photo('Fokkelman10_001_ab'),
	photo('family_uploads/beach_x1', 'family_uploads', true),
	photo('family_uploads/BEACH_x2', 'family_uploads')
];

describe('filterPhotos', () => {
	it('returns everything with empty filters', () => {
		expect(filterPhotos(photos, { folder: '', query: '', favoritesOnly: false })).toHaveLength(3);
	});

	it('filters by exact folder', () => {
		const result = filterPhotos(photos, { folder: 'family_uploads', query: '', favoritesOnly: false });
		expect(result.map((p) => p.publicId)).toEqual([
			'family_uploads/beach_x1',
			'family_uploads/BEACH_x2'
		]);
	});

	it('filters by case-insensitive substring of publicId', () => {
		const result = filterPhotos(photos, { folder: '', query: 'beach', favoritesOnly: false });
		expect(result).toHaveLength(2);
	});

	it('filters favorites only, combinable with the rest', () => {
		const result = filterPhotos(photos, { folder: 'family_uploads', query: 'beach', favoritesOnly: true });
		expect(result.map((p) => p.publicId)).toEqual(['family_uploads/beach_x1']);
	});
});

describe('searching the annotations', () => {
	const none = { folder: '', favoritesOnly: false };
	const library = [
		photo('a', '', false, { caption: 'Cumpleaños de María', year: 1975, people: ['María', 'Luis'] }),
		photo('b', '', false, { caption: 'Playa de Sitges', year: 1982, people: ['Ana'] }),
		photo('c')
	];
	const found = (query: string) => filterPhotos(library, { ...none, query }).map((p) => p.publicId);

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
		expect(filtersFromSearchParams(new URLSearchParams('folder=demo&q=cat&fav=1'))).toEqual({
			folder: 'demo',
			query: 'cat',
			favoritesOnly: true
		});
	});

	it('defaults to empty filters', () => {
		expect(filtersFromSearchParams(new URLSearchParams())).toEqual({
			folder: '',
			query: '',
			favoritesOnly: false
		});
	});
});

describe('uniqueFolders', () => {
	it('returns sorted unique non-root folders', () => {
		expect(uniqueFolders(photos)).toEqual(['family_uploads']);
	});
});

describe('filtersToSearch', () => {
	it('is empty when no filter is active', () => {
		expect(filtersToSearch({ folder: '', query: '', favoritesOnly: false })).toBe('');
	});

	it('serializes every active filter in a stable order', () => {
		expect(filtersToSearch({ folder: 'family_uploads', query: 'beach', favoritesOnly: true })).toBe(
			'?folder=family_uploads&q=beach&fav=1'
		);
	});

	it('round-trips through filtersFromSearchParams, including special characters', () => {
		const filters = { folder: 'vacaciones 2019', query: 'ñandú & co', favoritesOnly: true };
		expect(filtersFromSearchParams(new URLSearchParams(filtersToSearch(filters)))).toEqual(filters);
	});
});
