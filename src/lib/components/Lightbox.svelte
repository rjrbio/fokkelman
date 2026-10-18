<script lang="ts">
	import { untrack } from 'svelte';
	import { fullUrl, thumbUrl } from '$lib/cdn';
	import { focusTrap, isTypingTarget, watchLoad } from '$lib/dom';
	import { getMessages } from '$lib/i18n';
	import type { Photo } from '$lib/types';
	import Icon from './Icon.svelte';
	import PhotoPanel from './PhotoPanel.svelte';

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

	let fullImage = $state<HTMLImageElement>();
	let fullLoaded = $state(false);
	let pointerStartX = $state<number | null>(null);

	$effect(() => (fullImage ? watchLoad(fullImage, () => (fullLoaded = true)) : undefined));

	// A new photo starts unloaded. Not on the first run: a server-rendered photo may have loaded
	// already, and `watchLoad` has said so.
	let currentKey = untrack(() => photo.publicId);
	$effect(() => {
		if (photo.publicId === currentKey) return;
		currentKey = photo.publicId;
		fullLoaded = false;
	});

	// The page behind must not scroll while the viewer is open.
	$effect(() => {
		document.documentElement.classList.add('viewer-open');
		return () => document.documentElement.classList.remove('viewer-open');
	});

	$effect(() => {
		for (const next of preload) new Image().src = fullUrl(cloudName, next);
	});

	function onkeydown(e: KeyboardEvent) {
		if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
		if (e.key === 'Escape') onClose();
		else if (e.key === 'ArrowLeft') onPrev?.();
		else if (e.key === 'ArrowRight') onNext?.();
	}

	function onpointerdown(e: PointerEvent) {
		pointerStartX = e.clientX;
	}

	function onpointerup(e: PointerEvent) {
		if (pointerStartX === null) return;
		const dx = e.clientX - pointerStartX;
		pointerStartX = null;
		if (dx > 50) onPrev?.();
		if (dx < -50) onNext?.();
	}
</script>

<svelte:window {onkeydown} />

<div class="overlay" role="dialog" aria-modal="true" aria-label={m.label} tabindex="-1" use:focusTrap>
	<div class="stage" role="presentation" {onpointerdown} {onpointerup}>
		{#if !fullLoaded}
			<img class="placeholder" src={thumbUrl(cloudName, photo)} alt="" aria-hidden="true" />
		{/if}
		<img
			class="full"
			class:visible={fullLoaded}
			src={fullUrl(cloudName, photo)}
			alt={photo.publicId}
			bind:this={fullImage}
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
	</div>

	<PhotoPanel {photo} {cloudName} {favorite} {position} {onClose} {onToggleFavorite} />
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
	.stage {
		position: relative;
		display: grid;
		place-items: center;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
		touch-action: pan-y;
	}
	.stage img {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
	}
	.placeholder {
		position: absolute;
		filter: blur(8px);
	}
	.full {
		opacity: 0;
		transition: opacity 0.2s;
	}
	.full.visible {
		opacity: 1;
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

	@media (max-width: 720px) {
		.overlay {
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: minmax(0, 1fr) auto;
		}
	}
</style>
