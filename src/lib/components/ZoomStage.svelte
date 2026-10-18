<script lang="ts">
	import { untrack } from 'svelte';
	import { watchLoad } from '$lib/dom';
	import {
		clampView,
		createTapDetector,
		fitSize,
		IDENTITY,
		isZoomed,
		panBy,
		pinchView,
		wheelFactor,
		zoomAt,
		type PinchStart,
		type Point,
		type View
	} from '$lib/zoomPan';

	let {
		photoKey,
		size,
		src,
		placeholderSrc,
		largeSrc,
		alt,
		immersive,
		onSwipe,
		onTap,
		onDoubleTap
	}: {
		/** Changes with the photo: the zoom starts over and the images are loaded again. */
		photoKey: string;
		/** The photo's own dimensions, to know how it fits the stage. */
		size: { width: number; height: number };
		src: string;
		placeholderSrc: string;
		/** A bigger version, fetched only in full screen or when zoomed in. */
		largeSrc: string;
		alt: string;
		immersive: boolean;
		onSwipe: (direction: 'prev' | 'next') => void;
		onTap: () => void;
		onDoubleTap: () => void;
	} = $props();

	/** A finger that moves less than this between touching and lifting made a tap, not a drag. */
	const TAP_SLOP = 10;
	const SWIPE_MIN = 50;

	let stage = $state<HTMLElement>();
	let viewport = $state({ width: 0, height: 0 });
	let view = $state<View>(IDENTITY);
	let fullImage = $state<HTMLImageElement>();
	let largeImage = $state<HTMLImageElement>();
	let fullLoaded = $state(false);
	let largeLoaded = $state(false);

	const fitted = $derived(fitSize(size, viewport));
	const wantLarge = $derived(immersive || isZoomed(view));

	export function zoomBy(factor: number): void {
		view = zoomAt(view, view.scale * factor, { x: 0, y: 0 }, fitted, viewport);
	}

	export function resetZoom(): void {
		view = IDENTITY;
	}

	$effect(() => (fullImage ? watchLoad(fullImage, () => (fullLoaded = true)) : undefined));
	$effect(() => (largeImage ? watchLoad(largeImage, () => (largeLoaded = true)) : undefined));

	// A new photo starts fitted and unloaded. Not on the first run: a server-rendered photo may
	// have loaded already, and `watchLoad` has said so.
	let currentKey = untrack(() => photoKey);
	$effect(() => {
		if (photoKey === currentKey) return;
		currentKey = photoKey;
		view = IDENTITY;
		fullLoaded = false;
		largeLoaded = false;
	});

	// The stage can change size (the panel goes away in full screen): keep the photo inside it.
	$effect(() => {
		view = clampView(
			untrack(() => view),
			fitted,
			viewport
		);
	});

	// Not a template handler: it has to be non-passive to stop the page from scrolling.
	$effect(() => {
		if (!stage) return;
		const element = stage;
		function onwheel(event: WheelEvent) {
			event.preventDefault();
			const factor = wheelFactor(event.deltaY, event.deltaMode, event.ctrlKey);
			view = zoomAt(view, view.scale * factor, fromCentre(event.clientX, event.clientY), fitted, viewport);
		}
		element.addEventListener('wheel', onwheel, { passive: false });
		return () => element.removeEventListener('wheel', onwheel);
	});

	/** A screen point relative to the centre of the stage, which is where the zoom is anchored. */
	function fromCentre(clientX: number, clientY: number): Point {
		const box = stage!.getBoundingClientRect();
		return { x: clientX - (box.left + box.width / 2), y: clientY - (box.top + box.height / 2) };
	}

	const taps = createTapDetector();
	const pointers = new Map<number, Point>();
	let down: (Point & { moved: boolean }) | null = null;
	let lastDrag: Point | null = null;
	let pinchStart: PinchStart | null = null;
	/** A second finger touched during this gesture: lifting the first must not count as a tap or a swipe. */
	let multiTouch = false;

	function pinchMeasure(): { distance: number; mid: Point } {
		const [a, b] = [...pointers.values()];
		return {
			distance: Math.hypot(a.x - b.x, a.y - b.y),
			mid: fromCentre((a.x + b.x) / 2, (a.y + b.y) / 2)
		};
	}

	function onpointerdown(event: PointerEvent) {
		if (event.pointerType === 'mouse' && event.button !== 0) return;
		stage!.setPointerCapture(event.pointerId);
		pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
		if (pointers.size === 1) {
			down = { x: event.clientX, y: event.clientY, moved: false };
			lastDrag = { x: event.clientX, y: event.clientY };
			multiTouch = false;
		} else if (pointers.size === 2) {
			multiTouch = true;
			pinchStart = { view, ...pinchMeasure() };
		}
	}

	function onpointermove(event: PointerEvent) {
		if (!pointers.has(event.pointerId)) return;
		pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

		if (pointers.size === 2 && pinchStart) {
			const { distance, mid } = pinchMeasure();
			view = pinchView(pinchStart, distance, mid, fitted, viewport);
		} else if (pointers.size === 1 && down && lastDrag) {
			if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > TAP_SLOP) down.moved = true;
			if (isZoomed(view)) {
				view = panBy(view, event.clientX - lastDrag.x, event.clientY - lastDrag.y, fitted, viewport);
			}
			lastDrag = { x: event.clientX, y: event.clientY };
		}
	}

	function onpointerup(event: PointerEvent) {
		if (!pointers.delete(event.pointerId)) return;
		if (pointers.size === 1) {
			// One finger of a pinch is still down: it carries on as a drag from where it is.
			lastDrag = [...pointers.values()][0];
			pinchStart = null;
			return;
		}
		if (pointers.size > 0) return;

		const start = down;
		down = null;
		lastDrag = null;
		pinchStart = null;
		const wasMulti = multiTouch;
		multiTouch = false;
		if (!start || wasMulti || event.type === 'pointercancel') return;

		const dx = event.clientX - start.x;
		const dy = event.clientY - start.y;
		// A mouse drag is not a swipe: it would skip photos when someone only meant to grab the image.
		if (event.pointerType !== 'mouse' && !isZoomed(view) && Math.abs(dx) > SWIPE_MIN && Math.abs(dx) > Math.abs(dy)) {
			onSwipe(dx > 0 ? 'prev' : 'next');
		} else if (!start.moved) {
			const kind = taps.register(event.timeStamp, { x: event.clientX, y: event.clientY }, !immersive);
			if (kind === 'single') onTap();
			else if (isZoomed(view)) resetZoom();
			else onDoubleTap();
		}
	}
</script>

<div
	class="stage"
	role="presentation"
	bind:this={stage}
	bind:clientWidth={viewport.width}
	bind:clientHeight={viewport.height}
	{onpointerdown}
	{onpointermove}
	{onpointerup}
	onpointercancel={onpointerup}
>
	<div
		class="photo"
		data-testid="zoomable"
		data-scale={view.scale.toFixed(2)}
		data-x={Math.round(view.x)}
		data-y={Math.round(view.y)}
		style:transform="translate({view.x}px, {view.y}px) scale({view.scale})"
	>
		{#if !fullLoaded}
			<img class="placeholder" src={placeholderSrc} alt="" aria-hidden="true" draggable="false" />
		{/if}
		<img
			class="full"
			class:visible={fullLoaded}
			{src}
			{alt}
			draggable="false"
			bind:this={fullImage}
		/>
		{#if wantLarge}
			<img
				class="large"
				class:visible={largeLoaded}
				src={largeSrc}
				alt=""
				aria-hidden="true"
				draggable="false"
				bind:this={largeImage}
			/>
		{/if}
	</div>
</div>

<style>
	.stage {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
		/* The gestures are ours: no page scroll, no browser pinch-zoom. */
		touch-action: none;
		user-select: none;
	}
	.photo {
		position: absolute;
		inset: 0;
		will-change: transform;
	}
	.photo img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: contain;
		-webkit-user-drag: none;
	}
	.placeholder {
		filter: blur(8px);
	}
	.full,
	.large {
		opacity: 0;
		transition: opacity 0.2s;
	}
	.full.visible,
	.large.visible {
		opacity: 1;
	}
</style>
