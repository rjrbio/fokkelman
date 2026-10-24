<script lang="ts">
	import { thumbUrl } from '$lib/cdn';
	import { getMessages } from '$lib/i18n';
	import { layoutRows } from '$lib/justifiedRows';
	import type { Photo } from '$lib/types';

	let {
		photos,
		cloudName,
		resetKey = '',
		onOpen,
		selected,
		onToggleSelect
	}: {
		photos: Photo[];
		cloudName: string;
		/** The visible rows go back to the first batch only when this key changes (i.e. the filters), not on every data refresh. */
		resetKey?: string;
		onOpen: (publicId: string) => void;
		/** The photos that are picked. The demo passes neither this nor `onToggleSelect`: it has no selection. */
		selected?: ReadonlySet<string>;
		/** Picks or lets go of a photo. With it, every photo has a check box and a long press on a touch screen picks it. */
		onToggleSelect?: (publicId: string) => void;
	} = $props();

	const m = getMessages().grid;

	/** What a screen reader is told about a photo besides its name: the caption and the year, when there are any. */
	const describe = ({ caption, year }: Photo): string =>
		[caption, year].filter((part) => part !== '' && part !== null).join(', ');

	/** Rows drawn at first, and added each time the end of the page comes near. */
	const ROW_BATCH = 12;
	/** Space between photos, in px, horizontally and between rows. */
	const GAP = 3;
	/** Rows aim for this height on a computer, and for the smaller one when the container is phone-sized. */
	const TARGET_HEIGHT = 180;
	const COMPACT_TARGET_HEIGHT = 120;
	const COMPACT_BELOW = 640;

	/** Something is picked: from then on a click or a tap on a photo picks it too, instead of opening it. */
	const selecting = $derived(Boolean(onToggleSelect && selected && selected.size > 0));

	/** How long a finger has to stay down to pick a photo, and how far it may drift meanwhile. */
	const LONG_PRESS_MS = 500;
	const LONG_PRESS_SLOP = 10;
	let pressTimer: ReturnType<typeof setTimeout> | undefined;
	let pressStart = { x: 0, y: 0 };
	/** The long press already picked the photo: the click that follows the lifted finger must do nothing. */
	let longPressed = false;
	/**
	 * A finger is down on a photo, or was a moment ago: the browser's own long press asks for its menu at about
	 * the same time as our timer fires (before it, on some phones), and may do so after the finger is lifted.
	 * So it is not tied to the timer, nor reset by the click or the end of the touch: only the next press ends it.
	 */
	let touchPress = false;

	function onPointerDown(event: PointerEvent, publicId: string) {
		// A new press starts: a long press that had no click after it (the browsers differ) is over.
		longPressed = false;
		// Only where photos can be picked: elsewhere (the demo) the browser's own long press is none of our business.
		touchPress = !!onToggleSelect && event.pointerType === 'touch';
		if (!onToggleSelect || event.pointerType === 'mouse') return;
		pressStart = { x: event.clientX, y: event.clientY };
		clearTimeout(pressTimer);
		pressTimer = setTimeout(() => {
			longPressed = true;
			onToggleSelect(publicId);
		}, LONG_PRESS_MS);
	}

	function onPointerMove(event: PointerEvent) {
		if (Math.hypot(event.clientX - pressStart.x, event.clientY - pressStart.y) > LONG_PRESS_SLOP) {
			clearTimeout(pressTimer);
		}
	}

	function activate(publicId: string) {
		if (longPressed) {
			longPressed = false;
			return;
		}
		if (selecting) onToggleSelect?.(publicId);
		else onOpen(publicId);
	}

	$effect(() => () => clearTimeout(pressTimer));

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
					{@const id = placed.item.publicId}
					{@const picked = selected?.has(id) ?? false}
					<div class="item" class:picked class:selecting style:width="{placed.width}px">
						<button
							class="cell"
							class:selectable={Boolean(onToggleSelect)}
							aria-label={selecting ? m.select(id) : m.open(id, describe(placed.item))}
							aria-pressed={selecting ? picked : undefined}
							onclick={() => activate(id)}
							onpointerdown={(event) => onPointerDown(event, id)}
							onpointermove={onPointerMove}
							onpointerup={() => clearTimeout(pressTimer)}
							onpointercancel={() => clearTimeout(pressTimer)}
							oncontextmenu={(event) => (touchPress || longPressed) && event.preventDefault()}
						>
							<img src={thumbUrl(cloudName, placed.item)} alt="" loading="lazy" />
							{#if placed.item.year !== null}<span class="year" aria-hidden="true">{placed.item.year}</span>{/if}
							{#if placed.item.favorite}<span class="star" aria-hidden="true">★</span>{/if}
						</button>
						{#if onToggleSelect}
							<label class="pick">
								<input
									class="sr-only"
									type="checkbox"
									aria-label={m.select(id)}
									checked={picked}
									onchange={() => onToggleSelect(id)}
								/>
								<span class="box" aria-hidden="true">{picked ? '✓' : ''}</span>
							</label>
						{/if}
					</div>
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
	.item {
		position: relative;
		flex: none;
		height: 100%;
	}
	.cell {
		position: relative;
		display: block;
		width: 100%;
		height: 100%;
		padding: 0;
		border: none;
		border-radius: 2px;
		/* Shown while the thumbnail loads. */
		background: var(--chip);
		overflow: hidden;
	}
	@media (pointer: coarse) {
		/* A finger would otherwise pop up the system's menu for the photo. Only where photos can be picked: the demo keeps the browser's own. */
		.cell.selectable {
			-webkit-touch-callout: none;
			-webkit-user-select: none;
			user-select: none;
		}
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
	/* The check box: a 44px target over a corner of the photo, with a smaller box drawn in it. */
	.pick {
		position: absolute;
		top: 0;
		left: 0;
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		opacity: 0;
		cursor: pointer;
	}
	.item:hover .pick,
	.pick:focus-within,
	.selecting .pick,
	.picked .pick {
		opacity: 1;
	}
	.box {
		display: grid;
		place-items: center;
		width: 22px;
		height: 22px;
		border: 2px solid #fff;
		border-radius: 50%;
		background: rgb(0 0 0 / 0.45);
		color: var(--on-accent);
		font-size: 0.8rem;
		font-weight: 700;
		line-height: 1;
	}
	.picked .box {
		border-color: var(--accent);
		background: var(--accent);
	}
	.pick:focus-within .box {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.picked .cell {
		outline: 3px solid var(--accent);
		outline-offset: -3px;
	}
	/* The rule above outranks the global focus ring, so a picked photo needs its own: otherwise it looks the same with or without the focus. */
	.picked .cell:focus-visible {
		outline-color: var(--fg);
	}
	@media (pointer: coarse) {
		/* A tap on a corner of the photo must not pick it by accident: a long press does, and the box only shows it. */
		.pick {
			pointer-events: none;
		}
	}
	.star {
		position: absolute;
		bottom: 6px;
		right: 8px;
		color: var(--accent);
		font-size: 1.1rem;
		line-height: 1;
		text-shadow: 0 1px 3px rgb(0 0 0 / 0.8);
	}
	.year {
		position: absolute;
		bottom: 6px;
		left: 6px;
		padding: 1px 6px;
		border-radius: 999px;
		background: rgb(0 0 0 / 0.6);
		color: #fff;
		font-size: 0.75rem;
		line-height: 1.3;
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
