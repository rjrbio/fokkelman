import { describe, expect, it } from 'vitest';
import { applyFavoriteOverrides } from './favorites';
import type { Photo } from './types';
import { noAnnotation } from './annotations';

const photo = (publicId: string, favorite = false): Photo => ({
	publicId,
	folder: '',
	format: 'jpg',
	width: 1,
	height: 1,
	favorite,
	...noAnnotation()
});

describe('applyFavoriteOverrides', () => {
	it('returns the very same array when there is nothing to apply', () => {
		const photos = [photo('a')];
		expect(applyFavoriteOverrides(photos, new Map())).toBe(photos);
	});

	it('applies an override on top of the server value', () => {
		const result = applyFavoriteOverrides([photo('a'), photo('b', true)], new Map([['a', true], ['b', false]]));
		expect(result.map((p) => p.favorite)).toEqual([true, false]);
	});

	it('keeps the original object when the override matches the server value', () => {
		const original = photo('a', true);
		const result = applyFavoriteOverrides([original], new Map([['a', true]]));
		expect(result[0]).toBe(original);
	});

	it('ignores overrides for photos that are not in the list', () => {
		const photos = [photo('a')];
		expect(applyFavoriteOverrides(photos, new Map([['zzz', true]])).map((p) => p.favorite)).toEqual([false]);
	});
});
