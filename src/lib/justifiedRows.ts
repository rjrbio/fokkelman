export interface Dimensions {
	width: number;
	height: number;
}

export interface LayoutOptions {
	/** Width available to the rows, in px. */
	containerWidth: number;
	/** Height the rows aim for, in px. */
	targetHeight: number;
	/** Space between neighbours, in px (the vertical space between rows is up to the caller). */
	gap: number;
}

export interface PlacedItem<T> {
	item: T;
	/** Rendered width in px; the height is the row's. */
	width: number;
}

export interface Row<T> {
	/** Rendered height in px. */
	height: number;
	items: PlacedItem<T>[];
}

/** Very tall or very wide photos are laid out as if they were this shape (the cell crops the rest). */
export const MIN_ASPECT = 0.4;
export const MAX_ASPECT = 3;

/** width / height, clamped to `[MIN_ASPECT, MAX_ASPECT]`; `1` when the dimensions are missing or broken. */
export function aspectOf({ width, height }: Dimensions): number {
	const ratio = width / height;
	if (!Number.isFinite(ratio) || ratio <= 0) return 1;
	return Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, ratio));
}

/**
 * Packs `items` into rows of equal height that span `containerWidth` exactly (a "justified"
 * gallery), keeping the order. Every row but the last is scaled to fit; the last one keeps
 * `targetHeight` and is left-aligned so a handful of leftovers do not blow up.
 *
 * Greedy: an item that would overflow the row is kept in it, or pushed to the next row,
 * whichever leaves the row closer to `targetHeight`.
 */
export function layoutRows<T extends Dimensions>(
	items: readonly T[],
	{ containerWidth, targetHeight, gap }: LayoutOptions
): Row<T>[] {
	if (!(containerWidth > 0) || !(targetHeight > 0) || items.length === 0) return [];

	const rows: Row<T>[] = [];
	let current: { item: T; aspect: number }[] = [];
	let aspectSum = 0;

	/** Height at which `count` items with this aspect sum exactly span the container. */
	const fitHeight = (count: number, sum: number) => (containerWidth - gap * (count - 1)) / sum;
	const fillsRow = (count: number, sum: number) =>
		sum * targetHeight + gap * (count - 1) >= containerWidth;

	function closeRow(height: number) {
		rows.push({
			height,
			items: current.map(({ item, aspect }) => ({ item, width: aspect * height }))
		});
		current = [];
		aspectSum = 0;
	}

	for (const item of items) {
		const aspect = aspectOf(item);
		const sumWith = aspectSum + aspect;
		const countWith = current.length + 1;

		if (!fillsRow(countWith, sumWith)) {
			current.push({ item, aspect });
			aspectSum = sumWith;
			continue;
		}

		const heightWith = fitHeight(countWith, sumWith);
		const keepsItOut =
			current.length > 0 &&
			Math.abs(fitHeight(current.length, aspectSum) - targetHeight) <
				Math.abs(heightWith - targetHeight);

		if (keepsItOut) {
			closeRow(fitHeight(current.length, aspectSum));
			current.push({ item, aspect });
			aspectSum = aspect;
			if (fillsRow(1, aspect)) closeRow(fitHeight(1, aspect));
		} else {
			current.push({ item, aspect });
			aspectSum = sumWith;
			closeRow(heightWith);
		}
	}

	if (current.length > 0) closeRow(targetHeight);
	return rows;
}
