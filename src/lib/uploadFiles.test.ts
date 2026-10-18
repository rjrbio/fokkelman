import { describe, expect, it } from 'vitest';
import { fileKey, splitSelection } from './uploadFiles';

const file = (name: string, size = 100, type = 'image/jpeg') => ({ name, size, type });

describe('fileKey', () => {
	it('combines name and size', () => {
		expect(fileKey(file('a.jpg', 5))).toBe('a.jpg:5');
	});
});

describe('splitSelection', () => {
	it('accepts new images', () => {
		const result = splitSelection([file('a.jpg'), file('b.png', 1, 'image/png')], new Set());
		expect(result.accepted.map((f) => f.name)).toEqual(['a.jpg', 'b.png']);
		expect(result.duplicates).toEqual([]);
		expect(result.rejected).toEqual([]);
	});

	it('flags a file that is already queued', () => {
		const result = splitSelection([file('a.jpg')], new Set([fileKey(file('a.jpg'))]));
		expect(result.accepted).toEqual([]);
		expect(result.duplicates).toHaveLength(1);
	});

	it('flags the same file repeated inside one selection', () => {
		const result = splitSelection([file('a.jpg'), file('a.jpg')], new Set());
		expect(result.accepted).toHaveLength(1);
		expect(result.duplicates).toHaveLength(1);
	});

	it('treats the same name with a different size as a different photo', () => {
		const result = splitSelection([file('IMG_0001.jpg', 100), file('IMG_0001.jpg', 200)], new Set());
		expect(result.accepted).toHaveLength(2);
	});

	it('rejects anything that is not an image', () => {
		const result = splitSelection([file('notes.pdf', 10, 'application/pdf'), file('x.jpg')], new Set());
		expect(result.rejected.map((f) => f.name)).toEqual(['notes.pdf']);
		expect(result.accepted.map((f) => f.name)).toEqual(['x.jpg']);
	});
});
