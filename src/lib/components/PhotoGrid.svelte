<script lang="ts">
	import { thumbUrl } from '$lib/cdn';
	import type { Photo } from '$lib/types';

	let {
		photos,
		cloudName,
		resetKey = '',
		onOpen
	}: {
		photos: Photo[];
		cloudName: string;
		/** The visible batch goes back to the first page only when this key changes (i.e. the filters), not on every data refresh. */
		resetKey?: string;
		onOpen: (publicId: string) => void;
	} = $props();

	const BATCH = 60;
	let visibleCount = $state(BATCH);
	let sentinel = $state<HTMLElement>();

	// Un $derived compara por valor: una prop que se reevalúa (p. ej. `page.url.search` en cada
	// navegación) pero devuelve la misma cadena no reinicia el lote visible.
	const key = $derived(resetKey);

	// Al cambiar los filtros, volver al primer lote
	$effect(() => {
		void key;
		visibleCount = BATCH;
	});

	$effect(() => {
		if (!sentinel) return;
		const io = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting) {
					visibleCount = Math.min(visibleCount + BATCH, photos.length);
				}
			},
			{ rootMargin: '600px' }
		);
		io.observe(sentinel);
		return () => io.disconnect();
	});
</script>

{#if photos.length === 0}
	<p class="empty">No photos match your filters.</p>
{:else}
	<div class="grid" data-testid="photo-grid">
		{#each photos.slice(0, visibleCount) as photo (photo.publicId)}
			<button class="cell" onclick={() => onOpen(photo.publicId)} aria-label="Open {photo.publicId}">
				<img src={thumbUrl(cloudName, photo)} alt="" loading="lazy" />
				{#if photo.favorite}<span class="star" aria-hidden="true">★</span>{/if}
			</button>
		{/each}
	</div>
	{#if visibleCount < photos.length}
		<div bind:this={sentinel} class="sentinel" data-testid="grid-sentinel"></div>
	{/if}
{/if}

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
		gap: 4px;
		padding: 4px;
	}
	.cell {
		position: relative;
		padding: 0;
		border: none;
		background: var(--surface);
		aspect-ratio: 1;
		overflow: hidden;
		border-radius: 4px;
	}
	.cell img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.star {
		position: absolute;
		bottom: 6px;
		left: 8px;
		color: white;
		text-shadow: 0 1px 3px rgb(0 0 0 / 0.7);
		font-size: 1.1rem;
	}
	.sentinel {
		height: 1px;
	}
	.empty {
		padding: 3rem;
		text-align: center;
		color: var(--text-dim);
	}
</style>
