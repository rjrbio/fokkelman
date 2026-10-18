<script lang="ts">
	import { thumbUrl } from '$lib/cdn';
	import { getMessages } from '$lib/i18n';
	import { layoutRows } from '$lib/justifiedRows';
	import type { Photo } from '$lib/types';

	let {
		photos,
		cloudName,
		resetKey = '',
		onOpen
	}: {
		photos: Photo[];
		cloudName: string;
		/** The visible rows go back to the first batch only when this key changes (i.e. the filters), not on every data refresh. */
		resetKey?: string;
		onOpen: (publicId: string) => void;
	} = $props();

	const m = getMessages().grid;

	/** Rows drawn at first, and added each time the end of the page comes near. */
	const ROW_BATCH = 12;
	/** Space between photos, in px, horizontally and between rows. */
	const GAP = 3;
	/** Rows aim for this height on a computer, and for the smaller one when the container is phone-sized. */
	const TARGET_HEIGHT = 180;
	const COMPACT_TARGET_HEIGHT = 120;
	const COMPACT_BELOW = 640;

	let width = $state(0);
	let visibleRows = $state(ROW_BATCH);
	let sentinel = $state<HTMLElement>();

	// Zero until the browser has measured the container, which gives no rows.
	const rows = $derived(
		layoutRows(photos, {
			containerWidth: width,
			targetHeight: width < COMPACT_BELOW ? COMPACT_TARGET_HEIGHT : TARGET_HEIGHT,
			gap: GAP
		})
	);

	// A $derived compares by value: a prop that is re-evaluated (e.g. `page.url.search` on every
	// navigation) but yields the same string does not reset the visible rows.
	const key = $derived(resetKey);

	// When the filters change, back to the first batch.
	$effect(() => {
		void key;
		visibleRows = ROW_BATCH;
	});

	$effect(() => {
		// Depending on `visibleRows` re-creates the observer after each batch, and a new observer
		// reports the current state at once: a tall screen keeps loading until the sentinel is far.
		void visibleRows;
		if (!sentinel) return;
		const io = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting) {
					visibleRows = Math.min(visibleRows + ROW_BATCH, rows.length);
				}
			},
			{ rootMargin: '600px' }
		);
		io.observe(sentinel);
		return () => io.disconnect();
	});
</script>

<div class="grid" data-testid="photo-grid" style:gap="{GAP}px" bind:clientWidth={width}>
	{#if photos.length === 0}
		<p class="empty">{m.empty}</p>
	{:else}
		{#each rows.slice(0, visibleRows) as row (row.items[0].item.publicId)}
			<div class="row" data-testid="photo-row" style:height="{row.height}px" style:gap="{GAP}px">
				{#each row.items as placed (placed.item.publicId)}
					<button
						class="cell"
						style:width="{placed.width}px"
						aria-label={m.open(placed.item.publicId)}
						onclick={() => onOpen(placed.item.publicId)}
					>
						<img src={thumbUrl(cloudName, placed.item)} alt="" loading="lazy" />
						{#if placed.item.favorite}<span class="star" aria-hidden="true">★</span>{/if}
					</button>
				{/each}
			</div>
		{/each}
		{#if visibleRows < rows.length}
			<div bind:this={sentinel} class="sentinel" data-testid="grid-sentinel"></div>
		{/if}
	{/if}
</div>

<style>
	.grid {
		display: flex;
		flex-direction: column;
	}
	.row {
		display: flex;
	}
	.cell {
		position: relative;
		flex: none;
		display: block;
		height: 100%;
		padding: 0;
		border: none;
		border-radius: 2px;
		/* Shown while the thumbnail loads. */
		background: var(--chip);
		overflow: hidden;
	}
	.cell img {
		display: block;
		width: 100%;
		height: 100%;
		/* The cell already has the photo's shape; this only trims panoramas and very tall photos. */
		object-fit: cover;
	}
	.cell:focus-visible {
		outline-offset: -3px;
	}
	.star {
		position: absolute;
		bottom: 6px;
		left: 8px;
		color: var(--accent);
		font-size: 1.1rem;
		line-height: 1;
		text-shadow: 0 1px 3px rgb(0 0 0 / 0.8);
	}
	.sentinel {
		height: 1px;
	}
	.empty {
		margin: 0;
		padding: 3rem 1rem;
		text-align: center;
		color: var(--dim);
	}
</style>
