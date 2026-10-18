<script lang="ts">
	import { tick } from 'svelte';
	import { fullUrl, thumbUrl, zoomUrl } from '$lib/cdn';
	import { focusTrap, isTypingTarget, swallowNextClick } from '$lib/dom';
	import { getMessages } from '$lib/i18n';
	import type { Photo } from '$lib/types';
	import Icon from './Icon.svelte';
	import PhotoPanel from './PhotoPanel.svelte';
	import ZoomStage from './ZoomStage.svelte';

	let {
		photo,
		cloudName,
		favorite,
		position,
		preload = [],
		onClose,
		onPrev,
		onNext,
		onToggleFavorite
	}: {
		photo: Photo;
		cloudName: string;
		favorite: boolean;
		/** Where this photo is in the list being browsed, for the panel. */
		position?: { index: number; total: number };
		/** The neighbours, fetched ahead of time so that moving to them is instant. */
		preload?: Photo[];
		onClose: () => void;
		onPrev?: () => void;
		onNext?: () => void;
		onToggleFavorite: () => void;
	} = $props();

	const m = getMessages().viewer;

	let overlay = $state<HTMLElement>();
	let exitButton = $state<HTMLElement>();
	let stage = $state<ZoomStage>();
	/** Only the photo, edge to edge: the panel is gone. Also the browser's full screen where there is one. */
	let immersive = $state(false);

	// The page behind must not scroll while the viewer is open.
	$effect(() => {
		document.documentElement.classList.add('viewer-open');
		return () => document.documentElement.classList.remove('viewer-open');
	});

	$effect(() => {
		for (const next of preload) new Image().src = fullUrl(cloudName, next);
	});

	// Leaving the viewer (e.g. with the browser's back button) must not leave the browser in full screen.
	$effect(() => {
		const element = overlay;
		return () => {
			if (element && document.fullscreenElement === element) document.exitFullscreen().catch(() => {});
		};
	});

	async function enterImmersive() {
		immersive = true;
		await tick(); // the panel, and the button that was pressed, are gone: the focus needs a home
		exitButton?.focus();
		// The browser's own full screen where it exists. iPhone Safari has none for anything but
		// video, so there the panel simply going away is the whole feature.
		try {
			await overlay?.requestFullscreen?.();
		} catch {
			/* refused: the immersive view alone is fine */
		}
	}

	async function leaveImmersive() {
		immersive = false;
		if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
		await tick();
		overlay?.querySelector<HTMLElement>('[data-action="fullscreen"]')?.focus();
	}

	const toggleImmersive = () => (immersive ? leaveImmersive() : enterImmersive());

	/** The browser left full screen by itself (Esc): follow it. */
	function onfullscreenchange() {
		if (!document.fullscreenElement && immersive) void leaveImmersive();
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
		if (e.key === 'Escape') {
			if (immersive) void leaveImmersive();
			else onClose();
		} else if (e.key === 'ArrowLeft') onPrev?.();
		else if (e.key === 'ArrowRight') onNext?.();
		else if (e.key === 'f' || e.key === 'F') void toggleImmersive();
		else if (e.key === '+' || e.key === '=') stage?.zoomBy(1.25);
		else if (e.key === '-') stage?.zoomBy(0.8);
		else if (e.key === '0') stage?.resetZoom();
	}

	function onSwipe(direction: 'prev' | 'next') {
		if (direction === 'prev') onPrev?.();
		else onNext?.();
	}

	/** In full screen a tap brings the panel back. */
	function onTap() {
		if (!immersive) return;
		// The panel appears under the finger, and the click that follows the tap would press it.
		swallowNextClick();
		void leaveImmersive();
	}
</script>

<svelte:window {onkeydown} />
<svelte:document {onfullscreenchange} />

<div
	class="overlay"
	role="dialog"
	aria-modal="true"
	aria-label={m.label}
	tabindex="-1"
	data-immersive={immersive}
	bind:this={overlay}
	use:focusTrap
>
	<div class="stage">
		<ZoomStage
			bind:this={stage}
			photoKey={photo.publicId}
			size={{ width: photo.width, height: photo.height }}
			src={fullUrl(cloudName, photo)}
			placeholderSrc={thumbUrl(cloudName, photo)}
			largeSrc={zoomUrl(cloudName, photo)}
			alt={photo.publicId}
			{immersive}
			{onSwipe}
			{onTap}
			onDoubleTap={enterImmersive}
		/>

		{#if onPrev}
			<button class="nav prev" aria-label={m.previous} onclick={onPrev}>
				<Icon name="chevron-left" size={24} />
			</button>
		{/if}
		{#if onNext}
			<button class="nav next" aria-label={m.next} onclick={onNext}>
				<Icon name="chevron-right" size={24} />
			</button>
		{/if}

		{#if immersive}
			<button class="nav exit" aria-label={m.exitFullscreen} bind:this={exitButton} onclick={leaveImmersive}>
				<Icon name="collapse" size={22} />
			</button>
		{/if}
	</div>

	{#if !immersive}
		<PhotoPanel
			{photo}
			{cloudName}
			{favorite}
			{position}
			{onClose}
			{onToggleFavorite}
			onToggleFullscreen={enterImmersive}
		/>
	{/if}
</div>

<style>
	.overlay {
		position: fixed;
		inset: 0;
		z-index: 100;
		display: grid;
		grid-template-columns: minmax(0, 1fr) 320px;
		background: var(--bg);
	}
	.overlay[data-immersive='true'] {
		grid-template-columns: minmax(0, 1fr);
		background: #000;
	}
	.stage {
		position: relative;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
	}
	.nav {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border: none;
		border-radius: 999px;
		background: rgb(0 0 0 / 0.55);
		color: #fff;
	}
	.prev {
		left: 0.75rem;
	}
	.next {
		right: 0.75rem;
	}
	.exit {
		top: calc(0.75rem + env(safe-area-inset-top));
		right: 0.75rem;
		transform: none;
	}

	@media (max-width: 720px) {
		.overlay {
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: minmax(0, 1fr) auto;
		}
	}
</style>
