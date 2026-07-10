<script lang="ts">
	import { downloadUrl, fullUrl, thumbUrl } from '$lib/cdn';
	import type { Photo } from '$lib/types';

	let {
		photo,
		cloudName,
		favorite,
		onClose,
		onPrev,
		onNext,
		onToggleFavorite
	}: {
		photo: Photo;
		cloudName: string;
		favorite: boolean;
		onClose: () => void;
		onPrev?: () => void;
		onNext?: () => void;
		onToggleFavorite: () => void;
	} = $props();

	let fullLoaded = $state(false);
	let pointerStartX = $state<number | null>(null);

	$effect(() => {
		void photo.publicId;
		fullLoaded = false;
	});

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
		if (e.key === 'ArrowLeft') onPrev?.();
		if (e.key === 'ArrowRight') onNext?.();
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

<div class="overlay" role="dialog" aria-modal="true" aria-label="Photo viewer" tabindex="-1" {onpointerdown} {onpointerup}>
	<div class="stage">
		{#if !fullLoaded}
			<img class="placeholder" src={thumbUrl(cloudName, photo)} alt="" aria-hidden="true" />
		{/if}
		<img
			class="full"
			class:visible={fullLoaded}
			src={fullUrl(cloudName, photo)}
			alt={photo.publicId}
			onload={() => (fullLoaded = true)}
		/>
	</div>

	<div class="toolbar">
		<button
			class="action"
			aria-pressed={favorite}
			aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
			onclick={onToggleFavorite}
		>
			{favorite ? '★' : '☆'} Favorite
		</button>
		<a class="action" href={downloadUrl(cloudName, photo)} download>⬇ Download</a>
		<button class="action" aria-label="Close viewer" onclick={onClose}>✕ Close</button>
	</div>

	{#if onPrev}
		<button class="nav prev" aria-label="Previous photo" onclick={onPrev}>‹</button>
	{/if}
	{#if onNext}
		<button class="nav next" aria-label="Next photo" onclick={onNext}>›</button>
	{/if}
</div>

<style>
	.overlay {
		position: fixed;
		inset: 0;
		z-index: 100;
		background: rgb(0 0 0 / 0.92);
		display: grid;
		place-items: center;
		touch-action: pan-y;
	}
	.stage {
		position: relative;
		width: 100vw;
		height: 100vh;
		display: grid;
		place-items: center;
	}
	.stage img {
		max-width: 100vw;
		max-height: 100vh;
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
	.toolbar {
		position: fixed;
		top: 0;
		right: 0;
		display: flex;
		gap: 0.5rem;
		padding: 0.75rem;
	}
	.action {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.6rem 1rem;
		border: none;
		border-radius: 999px;
		background: rgb(255 255 255 / 0.15);
		color: white;
		text-decoration: none;
		font: inherit;
	}
	.action[aria-pressed='true'] {
		background: var(--accent);
	}
	.nav {
		position: fixed;
		top: 50%;
		transform: translateY(-50%);
		border: none;
		background: rgb(255 255 255 / 0.15);
		color: white;
		font-size: 2.5rem;
		line-height: 1;
		padding: 0.75rem 1rem;
		border-radius: 999px;
	}
	.prev {
		left: 1rem;
	}
	.next {
		right: 1rem;
	}
</style>
