import { describe, expect, it } from 'vitest';
import {
	clampView,
	createTapDetector,
	fitSize,
	IDENTITY,
	isZoomed,
	MAX_SCALE,
	panBy,
	pinchView,
	wheelFactor,
	zoomAt
} from './zoomPan';

const viewport = { width: 1000, height: 600 };
// A 3:2 photo that just fits a 1000×600 stage is 900×600.
const fitted = fitSize({ width: 3000, height: 2000 }, viewport);

describe('fitSize', () => {
	it('fits the photo inside the stage keeping its shape', () => {
		expect(fitted).toEqual({ width: 900, height: 600 });
		expect(fitSize({ width: 1000, height: 4000 }, viewport)).toEqual({ width: 150, height: 600 });
	});

	it('upscales a small photo to fill the stage', () => {
		expect(fitSize({ width: 150, height: 100 }, viewport)).toEqual({ width: 900, height: 600 });
	});

	it('is empty when something has no size yet', () => {
		expect(fitSize({ width: 0, height: 100 }, viewport)).toEqual({ width: 0, height: 0 });
		expect(fitSize({ width: 100, height: 100 }, { width: 0, height: 600 })).toEqual({
			width: 0,
			height: 0
		});
	});
});

describe('clampView', () => {
	it('keeps the photo centred while it is not bigger than the stage', () => {
		expect(clampView({ scale: 1, x: 300, y: -200 }, fitted, viewport)).toEqual(IDENTITY);
	});

	it('limits the pan to the part of the photo that sticks out of the stage', () => {
		// At 2x the photo is 1800×1200 on a 1000×600 stage: 400px to each side, 300px up and down.
		expect(clampView({ scale: 2, x: 999, y: -999 }, fitted, viewport)).toEqual({
			scale: 2,
			x: 400,
			y: -300
		});
	});

	it('does not let a narrow photo be panned sideways', () => {
		const tall = fitSize({ width: 1000, height: 4000 }, viewport); // 150×600
		const view = clampView({ scale: 2, x: 200, y: 50 }, tall, viewport);
		expect(view.x).toBe(0); // 300px wide, still narrower than the stage
		expect(view.y).toBe(50); // 1200px tall on a 600px stage: 300px of room
	});

	it('keeps the scale within bounds', () => {
		expect(clampView({ scale: 0.3, x: 0, y: 0 }, fitted, viewport).scale).toBe(1);
		expect(clampView({ scale: 50, x: 0, y: 0 }, fitted, viewport).scale).toBe(MAX_SCALE);
	});
});

describe('zoomAt', () => {
	it('keeps the point under the cursor in place', () => {
		const focal = { x: 200, y: 100 }; // relative to the stage's centre
		const view = zoomAt(IDENTITY, 2, focal, fitted, viewport);
		// The photo point that was under the focal point (200, 100) is at 2·(200, 100) + (x, y) now.
		expect(2 * focal.x + view.x).toBeCloseTo(focal.x);
		expect(2 * focal.y + view.y).toBeCloseTo(focal.y);
	});

	it('zooming at the centre does not move the photo', () => {
		expect(zoomAt(IDENTITY, 3, { x: 0, y: 0 }, fitted, viewport)).toEqual({ scale: 3, x: 0, y: 0 });
	});

	it('zooming back out to 1 returns to the centre', () => {
		const zoomed = zoomAt(IDENTITY, 3, { x: 300, y: 200 }, fitted, viewport);
		expect(zoomAt(zoomed, 1, { x: 300, y: 200 }, fitted, viewport)).toEqual(IDENTITY);
	});

	it('cannot zoom past the maximum or out past the fit', () => {
		expect(zoomAt(IDENTITY, 100, { x: 0, y: 0 }, fitted, viewport).scale).toBe(MAX_SCALE);
		expect(zoomAt(IDENTITY, 0.1, { x: 0, y: 0 }, fitted, viewport).scale).toBe(1);
	});
});

describe('panBy', () => {
	it('moves a zoomed photo and stops at its edges', () => {
		const zoomed = { scale: 2, x: 0, y: 0 };
		expect(panBy(zoomed, 150, -80, fitted, viewport)).toEqual({ scale: 2, x: 150, y: -80 });
		expect(panBy(zoomed, 9999, 0, fitted, viewport).x).toBe(400);
	});

	it('does nothing to a photo that is not zoomed', () => {
		expect(panBy(IDENTITY, 50, 50, fitted, viewport)).toEqual(IDENTITY);
	});
});

describe('pinchView', () => {
	const start = { view: IDENTITY, distance: 100, mid: { x: 0, y: 0 } };

	it('scales with the distance between the fingers', () => {
		expect(pinchView(start, 250, { x: 0, y: 0 }, fitted, viewport).scale).toBeCloseTo(2.5);
		expect(pinchView(start, 40, { x: 0, y: 0 }, fitted, viewport).scale).toBe(1);
	});

	it('follows the midpoint of the fingers', () => {
		const view = pinchView(start, 200, { x: 100, y: 0 }, fitted, viewport);
		// The photo point that was under the first midpoint (0,0) must end up under the new one (100,0).
		expect(view.scale).toBe(2);
		expect(view.x).toBeCloseTo(100);
	});

	it('survives a degenerate start', () => {
		expect(pinchView({ ...start, distance: 0 }, 50, { x: 0, y: 0 }, fitted, viewport)).toEqual(IDENTITY);
	});
});

describe('wheelFactor', () => {
	it('zooms in when scrolling up and out when scrolling down, symmetrically', () => {
		expect(wheelFactor(-100, 0, false)).toBeGreaterThan(1);
		expect(wheelFactor(100, 0, false)).toBeLessThan(1);
		expect(wheelFactor(100, 0, false) * wheelFactor(-100, 0, false)).toBeCloseTo(1);
	});

	it('treats line-based wheels as bigger steps and pinch gestures as more sensitive', () => {
		expect(wheelFactor(-3, 1, false)).toBeGreaterThan(wheelFactor(-3, 0, false));
		expect(wheelFactor(-5, 0, true)).toBeGreaterThan(wheelFactor(-5, 0, false));
	});
});

describe('isZoomed', () => {
	it('ignores rounding noise around 1', () => {
		expect(isZoomed({ scale: 1, x: 0, y: 0 })).toBe(false);
		expect(isZoomed({ scale: 1.005, x: 0, y: 0 })).toBe(false);
		expect(isZoomed({ scale: 1.2, x: 0, y: 0 })).toBe(true);
	});
});

describe('createTapDetector', () => {
	const at = (x = 100, y = 100) => ({ x, y });

	it('reports a second tap soon after and near the first as a double tap', () => {
		const taps = createTapDetector();
		expect(taps.register(1000, at(), true)).toBe('single');
		expect(taps.register(1200, at(110, 95), true)).toBe('double');
	});

	it('does not pair taps that are too far apart in time or space', () => {
		const taps = createTapDetector();
		taps.register(1000, at(), true);
		expect(taps.register(1400, at(), true)).toBe('single');
		taps.register(5000, at(0, 0), true);
		expect(taps.register(5100, at(300, 300), true)).toBe('single');
	});

	it('a double tap is consumed: the next tap starts over', () => {
		const taps = createTapDetector();
		taps.register(1000, at(), true);
		taps.register(1100, at(), true);
		expect(taps.register(1200, at(), true)).toBe('single');
	});

	it('forgets the previous tap when doubles are not allowed', () => {
		const taps = createTapDetector();
		taps.register(1000, at(), true);
		expect(taps.register(1100, at(), false)).toBe('single');
		expect(taps.register(1200, at(), true)).toBe('single');
	});
});
