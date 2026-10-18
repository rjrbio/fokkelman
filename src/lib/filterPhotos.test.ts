import { describe, expect, it } from 'vitest';
import { filterPhotos, filtersFromSearchParams, filtersToSearch, uniqueFolders } from './filterPhotos';
import type { Photo } from './types';

const photo = (publicId: string, folder = '', favorite = false): Photo => ({
	publicId,
	folder,
	format: 'jpg',
	width: 1,
	height: 1,
	favorite
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
