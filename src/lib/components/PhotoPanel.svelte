<script lang="ts">
	import type { Snippet } from 'svelte';
	import { downloadUrl } from '$lib/cdn';
	import { getMessages } from '$lib/i18n';
	import type { Photo } from '$lib/types';
	import Icon from './Icon.svelte';

	let {
		photo,
		cloudName,
		favorite,
		position,
		onClose,
		onToggleFavorite,
		onToggleFullscreen,
		onShare,
		shareReady = false,
		notes
	}: {
		photo: Photo;
		cloudName: string;
		favorite: boolean;
		position?: { index: number; total: number };
		onClose: () => void;
		onToggleFavorite: () => void;
		onToggleFullscreen: () => void;
		/** Shows a Share button. The public demo passes none: its photos have no page of their own to link to. */
		onShare?: () => void;
		/** The photo is ready to be shared as a file (no network needed when the button is pressed). */
		shareReady?: boolean;
		/** What the page wants to show about the photo besides its file data (the family area puts the caption, year and people here). */
		notes?: Snippet;
	} = $props();

	const m = getMessages().viewer;
</script>

<div class="panel" role="group" aria-labelledby="viewer-details">
	<div class="head">
		<div class="title">
			<h2 id="viewer-details">{m.details}</h2>
			{#if position}<span class="position">{m.position(position.index, position.total)}</span>{/if}
		</div>
		<button class="icon" aria-label={m.close} onclick={onClose}><Icon name="close" /></button>
	</div>

	<div class="actions">
		<button class="action" aria-pressed={favorite} onclick={onToggleFavorite}>
			<Icon name="star" filled={favorite} />
			{m.favorite}
		</button>
		<a class="action" href={downloadUrl(cloudName, photo)} download>
			<Icon name="download" />
			{m.download}
		</a>
		{#if onShare}
			<button class="action" data-action="share" data-ready={shareReady} onclick={onShare}>
				<Icon name="share" />
				{m.share}
			</button>
		{/if}
		<button class="action" data-action="fullscreen" onclick={onToggleFullscreen}>
			<Icon name="expand" />
			{m.enterFullscreen}
		</button>
	</div>

	{@render notes?.()}

	<dl>
		<dt>{m.file}</dt>
		<dd>{photo.publicId}</dd>
		<dt>{m.collection}</dt>
		<dd>{photo.folder || m.noCollection}</dd>
		<dt>{m.size}</dt>
		<dd>{m.dimensions(photo.width, photo.height)}</dd>
	</dl>
</div>

<style>
	.panel {
		display: grid;
		align-content: start;
		gap: 1.25rem;
		min-width: 0;
		padding: 1rem;
		overflow-y: auto;
		background: var(--bar);
		border-left: 1px solid var(--line);
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.title {
		display: grid;
	}
	h2 {
		margin: 0;
		font-size: 1rem;
	}
	.position {
		font-size: 0.85rem;
		color: var(--dim);
	}
	.icon {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border: none;
		border-radius: 999px;
		background: var(--chip);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.action {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 44px;
		padding: 0 1rem;
		border: 1px solid var(--line);
		border-radius: 999px;
		background: var(--chip);
		color: var(--fg);
		font-weight: 500;
		text-decoration: none;
	}
	.action[aria-pressed='true'] {
		border-color: transparent;
		background: var(--accent);
		color: var(--on-accent);
	}
	dl {
		display: grid;
		grid-template-columns: 5.5rem 1fr;
		gap: 0.5rem 1rem;
		margin: 0;
		font-size: 0.9rem;
	}
	dt {
		color: var(--dim);
	}
	dd {
		margin: 0;
		min-width: 0;
		overflow-wrap: anywhere;
	}

	@media (max-width: 720px) {
		.panel {
			gap: 0.75rem;
			border-left: none;
			border-top: 1px solid var(--line);
			padding-bottom: calc(1rem + env(safe-area-inset-bottom));
			max-height: 45dvh;
		}
	}
</style>
