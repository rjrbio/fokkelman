export interface Size {
	width: number;
	height: number;
}

export interface Point {
	x: number;
	y: number;
}

/**
 * How the photo is shown inside the stage. `x`/`y` are how far the photo's centre has moved from the
 * stage's centre, in px; `scale` multiplies the size it has when it just fits ("contain").
 */
export interface View {
	scale: number;
	x: number;
	y: number;
}

export const MIN_SCALE = 1;
export const MAX_SCALE = 6;
export const IDENTITY: View = { scale: 1, x: 0, y: 0 };

/** Below this the photo counts as not zoomed (a drag then means "swipe", not "pan"). */
const ZOOMED_ABOVE = 1.01;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** `value` kept within `±limit`; exactly 0 (never -0) when there is no room to move. */
const clampAxis = (value: number, limit: number) => (limit === 0 ? 0 : clamp(value, -limit, limit));

export const isZoomed = (view: View): boolean => view.scale > ZOOMED_ABOVE;

/** The size a `content` shaped photo takes when it just fits inside `viewport`, upscaling if needed. */
export function fitSize(content: Size, viewport: Size): Size {
	if (!(content.width > 0 && content.height > 0 && viewport.width > 0 && viewport.height > 0)) {
		return { width: 0, height: 0 };
	}
	const k = Math.min(viewport.width / content.width, viewport.height / content.height);
	return { width: content.width * k, height: content.height * k };
}

/** Keeps the scale in range and the photo from being dragged away from the stage. */
export function clampView(view: View, fitted: Size, viewport: Size): View {
	const scale = clamp(view.scale, MIN_SCALE, MAX_SCALE);
	const limitX = Math.max(0, (fitted.width * scale - viewport.width) / 2);
	const limitY = Math.max(0, (fitted.height * scale - viewport.height) / 2);
	return { scale, x: clampAxis(view.x, limitX), y: clampAxis(view.y, limitY) };
}

/** Zooms to `scale` keeping the photo point under `focal` (relative to the stage's centre) where it is. */
export function zoomAt(view: View, scale: number, focal: Point, fitted: Size, viewport: Size): View {
	const next = clamp(scale, MIN_SCALE, MAX_SCALE);
	const ratio = next / view.scale;
	return clampView(
		{ scale: next, x: focal.x - ratio * (focal.x - view.x), y: focal.y - ratio * (focal.y - view.y) },
		fitted,
		viewport
	);
}

export function panBy(view: View, dx: number, dy: number, fitted: Size, viewport: Size): View {
	return clampView({ ...view, x: view.x + dx, y: view.y + dy }, fitted, viewport);
}

export interface PinchStart {
	view: View;
	/** Distance between the two fingers when the gesture began, in px. */
	distance: number;
	/** Midpoint of the two fingers when it began, relative to the stage's centre. */
	mid: Point;
}

/** The view for a pinch in progress: scaled by how far the fingers moved apart, and following their midpoint. */
export function pinchView(
	start: PinchStart,
	distance: number,
	mid: Point,
	fitted: Size,
	viewport: Size
): View {
	if (!(start.distance > 0)) return start.view;
	const scale = clamp(start.view.scale * (distance / start.distance), MIN_SCALE, MAX_SCALE);
	const ratio = scale / start.view.scale;
	return clampView(
		{
			scale,
			x: mid.x - ratio * (start.mid.x - start.view.x),
			y: mid.y - ratio * (start.mid.y - start.view.y)
		},
		fitted,
		viewport
	);
}

/** Multiplier for the scale for one wheel event: up zooms in, down zooms out, and the two cancel out. */
export function wheelFactor(deltaY: number, deltaMode: number, ctrlKey: boolean): number {
	const pixels = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 400 : deltaY;
	// A trackpad pinch arrives as a wheel event with ctrlKey set and tiny deltas.
	return Math.exp(-pixels * (ctrlKey ? 0.01 : 0.0015));
}

export interface TapDetector {
	/**
	 * Registers a tap. Returns `'double'` when it completes a double tap (a second tap soon after and near
	 * the first); `canDouble: false` makes every tap a plain `'single'` and forgets the previous one.
	 */
	register(time: number, point: Point, canDouble: boolean): 'single' | 'double';
}

export function createTapDetector(doubleTapMs = 300, slop = 24): TapDetector {
	let last: { time: number; point: Point } | null = null;
	return {
		register(time, point, canDouble) {
			if (!canDouble) {
				last = null;
				return 'single';
			}
			const isDouble =
				last !== null &&
				time - last.time <= doubleTapMs &&
				Math.hypot(point.x - last.point.x, point.y - last.point.y) <= slop;
			last = isDouble ? null : { time, point };
			return isDouble ? 'double' : 'single';
		}
	};
}
