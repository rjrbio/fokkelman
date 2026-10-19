import { describe, expect, it } from 'vitest';
import { aspectOf, layoutRows, MAX_ASPECT, MIN_ASPECT, type Row } from './justifiedRows';

const photo = (width: number, height: number, id = `${width}x${height}`) => ({ id, width, height });
const landscape = (id: string) => photo(4, 3, id); // aspect 1.333…
const options = { containerWidth: 1000, targetHeight: 200, gap: 4 };

/** Sum of the widths plus the gaps of a row. */
const spanOf = <T>(row: Row<T>, gap: number) =>
	row.items.reduce((sum, { width }) => sum + width, 0) + gap * (row.items.length - 1);

describe('aspectOf', () => {
	it('is width over height', () => {
		expect(aspectOf({ width: 300, height: 200 })).toBeCloseTo(1.5);
	});

	it('clamps extreme shapes', () => {
		expect(aspectOf({ width: 5000, height: 100 })).toBe(MAX_ASPECT);
		expect(aspectOf({ width: 100, height: 5000 })).toBe(MIN_ASPECT);
	});

	it('treats missing or broken dimensions as square', () => {
		expect(aspectOf({ width: 0, height: 100 })).toBe(1);
		expect(aspectOf({ width: 100, height: 0 })).toBe(1);
		expect(aspectOf({ width: Number.NaN, height: 100 })).toBe(1);
		expect(aspectOf({ width: -5, height: 100 })).toBe(1);
	});
});

describe('layoutRows', () => {
	it('returns nothing without items, width or a target height', () => {
		expect(layoutRows([], options)).toEqual([]);
		expect(layoutRows([landscape('a')], { ...options, containerWidth: 0 })).toEqual([]);
		expect(layoutRows([landscape('a')], { ...options, targetHeight: 0 })).toEqual([]);
	});

	it('keeps every item exactly once and in order', () => {
		const items = Array.from({ length: 37 }, (_, i) =>
			photo(300 + ((i * 53) % 400), 200 + ((i * 31) % 300), `p${i}`)
		);
		const ids = layoutRows(items, options).flatMap((row) => row.items.map((p) => p.item.id));
		expect(ids).toEqual(items.map((p) => p.id));
	});

	it('stretches every row but the last to span the container exactly', () => {
		const items = Array.from({ length: 23 }, (_, i) => landscape(`p${i}`));
		const rows = layoutRows(items, options);
		expect(rows.length).toBeGreaterThan(1);
		for (const row of rows.slice(0, -1)) {
			expect(spanOf(row, options.gap)).toBeCloseTo(options.containerWidth, 6);
		}
	});

	it('keeps the rendered shape of each photo (no cropping, widths follow the aspect)', () => {
		const rows = layoutRows([photo(300, 200, 'wide'), photo(200, 300, 'tall'), photo(300, 200, 'w2')], {
			...options,
			containerWidth: 600
		});
		for (const row of rows) {
			for (const { item, width } of row.items) {
				expect(width / row.height).toBeCloseTo(item.width / item.height, 6);
			}
		}
	});

	it('leaves the last, unfilled row at the target height instead of stretching it', () => {
		const rows = layoutRows([landscape('a'), landscape('b')], options);
		expect(rows).toHaveLength(1);
		expect(rows[0].height).toBe(options.targetHeight);
		expect(spanOf(rows[0], options.gap)).toBeLessThan(options.containerWidth);
	});

	it('keeps row heights close to the target', () => {
		const items = Array.from({ length: 200 }, (_, i) =>
			photo(400 + ((i * 97) % 600), 300 + ((i * 61) % 500), `p${i}`)
		);
		const rows = layoutRows(items, options);
		for (const row of rows.slice(0, -1)) {
			expect(row.height).toBeGreaterThan(options.targetHeight * 0.5);
			expect(row.height).toBeLessThan(options.targetHeight * 1.5);
		}
	});

	it('picks the arrangement whose rows are closer to the target height', () => {
		// 4 landscapes at 200px high take 4·266.7 + 3·4 = 1078.7px: too wide for 1000px.
		// Keeping all 4 gives a 185.25px row; stopping at 3 gives a 248px one. 4 is closer to 200.
		const four = layoutRows(Array.from({ length: 5 }, (_, i) => landscape(`p${i}`)), options);
		expect(four[0].items).toHaveLength(4);

		// Make the 4th item very wide: keeping it would shrink the row to ~141px (|141-200| = 59),
		// stopping at 3 gives 248px (|248-200| = 48). Stopping is closer to the target.
		const items = [landscape('a'), landscape('b'), landscape('c'), photo(30, 10, 'strip'), landscape('d')];
		const rows = layoutRows(items, options);
		expect(rows[0].items.map((p) => p.item.id)).toEqual(['a', 'b', 'c']);
		expect(rows[1].items[0].item.id).toBe('strip');
	});

	it('gives a photo that is wider than the container a row of its own', () => {
		const rows = layoutRows([photo(3000, 1000, 'pano'), landscape('a')], {
			containerWidth: 500,
			targetHeight: 300,
			gap: 4
		});
		expect(rows[0].items.map((p) => p.item.id)).toEqual(['pano']);
		expect(rows[0].height).toBeCloseTo(500 / MAX_ASPECT, 6);
	});

	it('never lets a panorama collapse its row below a readable height', () => {
		// 200:1 on the file, laid out as MAX_ASPECT (3:1). Enough neighbours that the panorama
		// lands in a full row (a, b, pano at ~175px) and not in the last, unstretched one.
		const items = [
			landscape('a'),
			landscape('b'),
			photo(20000, 100, 'pano'),
			...['c', 'd', 'e', 'f', 'g'].map(landscape)
		];
		const rows = layoutRows(items, options);
		expect(rows.length).toBeGreaterThan(1);

		const panoRow = rows.findIndex((row) => row.items.some((p) => p.item.id === 'pano'));
		expect(panoRow).toBeGreaterThanOrEqual(0);
		expect(panoRow).toBeLessThan(rows.length - 1);

		const pano = rows[panoRow].items.find((p) => p.item.id === 'pano')!;
		expect(pano.width / rows[panoRow].height).toBeCloseTo(MAX_ASPECT, 9);

		for (const row of rows.slice(0, -1)) {
			expect(row.height).toBeGreaterThan(options.targetHeight * 0.5);
		}
	});

	it('copes with photos that have no dimensions', () => {
		const rows = layoutRows([photo(0, 0, 'a'), photo(0, 0, 'b')], options);
		expect(rows[0].items.map((p) => p.width)).toEqual([200, 200]);
	});

	it('works with a narrow phone-sized container', () => {
		const items = Array.from({ length: 10 }, (_, i) => landscape(`p${i}`));
		const rows = layoutRows(items, { containerWidth: 360, targetHeight: 120, gap: 3 });
		for (const row of rows.slice(0, -1)) expect(spanOf(row, 3)).toBeCloseTo(360, 6);
	});
});
