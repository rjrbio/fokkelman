import { describe, expect, it } from 'vitest';
import { fileKey, MAX_UPLOAD_BYTES, runWithLimit, splitSelection } from './uploadFiles';

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

describe('the size limit', () => {
	it('sets aside the images that are bigger than 10 MB, and takes the ones that are exactly that', () => {
		const result = splitSelection(
			[file('big.jpg', MAX_UPLOAD_BYTES + 1), file('exact.jpg', MAX_UPLOAD_BYTES), file('small.jpg')],
			new Set()
		);
		expect(result.tooBig.map((f) => f.name)).toEqual(['big.jpg']);
		expect(result.accepted.map((f) => f.name)).toEqual(['exact.jpg', 'small.jpg']);
	});

	it('does not count a big file that is not an image as a big image', () => {
		const result = splitSelection([file('video.mp4', MAX_UPLOAD_BYTES * 5, 'video/mp4')], new Set());
		expect(result.rejected).toHaveLength(1);
		expect(result.tooBig).toEqual([]);
	});
});

describe('runWithLimit', () => {
	it('never runs more than the limit at once, and runs everything', async () => {
		let active = 0;
		let most = 0;
		const done: number[] = [];

		await runWithLimit([1, 2, 3, 4, 5], 2, async (n) => {
			active++;
			most = Math.max(most, active);
			await new Promise((resolve) => setTimeout(resolve, 5));
			done.push(n);
			active--;
		});

		expect(most).toBe(2);
		expect(done.sort()).toEqual([1, 2, 3, 4, 5]);
	});

	it('starts them in order', async () => {
		const started: number[] = [];
		await runWithLimit([1, 2, 3], 2, async (n) => void started.push(n));
		expect(started).toEqual([1, 2, 3]);
	});

	it('copes with fewer items than lanes, and with none', async () => {
		const seen: number[] = [];
		await runWithLimit([1], 4, async (n) => void seen.push(n));
		await runWithLimit([], 2, async (n) => void seen.push(n));
		expect(seen).toEqual([1]);
	});
});
