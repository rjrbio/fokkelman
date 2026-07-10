<script lang="ts">
	import { goto } from '$app/navigation';
	import type { GalleryFilters } from '$lib/filterPhotos';

	let {
		folders,
		filters,
		total,
		stale,
		onUpload
	}: {
		folders: string[];
		filters: GalleryFilters;
		total: number;
		stale: boolean;
		onUpload?: () => void;
	} = $props();

	function apply(patch: Partial<GalleryFilters>) {
		const next = { ...filters, ...patch };
		const params = new URLSearchParams();
		if (next.folder) params.set('folder', next.folder);
		if (next.query) params.set('q', next.query);
		if (next.favoritesOnly) params.set('fav', '1');
		const qs = params.toString();
		goto(`/app${qs ? `?${qs}` : ''}`, { keepFocus: true, noScroll: false });
	}
</script>

<header>
	<a class="brand" href="/app">Fokkelman Photo Vault</a>

	<select
		aria-label="Collection"
		value={filters.folder}
		onchange={(e) => apply({ folder: e.currentTarget.value })}
	>
		<option value="">All collections</option>
		{#each folders as folder (folder)}
			<option value={folder}>{folder}</option>
		{/each}
	</select>

	<input
		type="search"
		placeholder="Search by file name…"
		aria-label="Search photos"
		value={filters.query}
		oninput={(e) => apply({ query: e.currentTarget.value })}
	/>

	<button
		class="chip"
		aria-pressed={filters.favoritesOnly}
		onclick={() => apply({ favoritesOnly: !filters.favoritesOnly })}
	>
		★ Favorites
	</button>

	<span class="count">{total.toLocaleString('en-US')} photos</span>
	{#if stale}<span class="stale" title="Showing a cached copy">offline copy</span>{/if}

	{#if onUpload}<button class="upload" onclick={onUpload}>Upload</button>{/if}

	<form method="POST" action="/logout">
		<button class="chip" type="submit">Log out</button>
	</form>
</header>

<style>
	header {
		position: sticky;
		top: 0;
		z-index: 10;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
		padding: 0.6rem 1rem;
		background: var(--bg);
		border-bottom: 1px solid var(--surface);
	}
	.brand {
		font-weight: 700;
		color: var(--text);
		text-decoration: none;
		margin-right: 0.5rem;
	}
	select,
	input {
		font: inherit;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--surface);
		border-radius: var(--radius);
		background: var(--surface);
	}
	input {
		flex: 1;
		min-width: 160px;
	}
	.chip {
		padding: 0.5rem 0.9rem;
		border: 1px solid var(--surface);
		border-radius: 999px;
		background: var(--bg);
	}
	.chip[aria-pressed='true'] {
		background: var(--accent);
		color: white;
		border-color: var(--accent);
	}
	.upload {
		padding: 0.5rem 1.1rem;
		border: none;
		border-radius: 999px;
		background: var(--accent);
		color: white;
		font-weight: 600;
	}
	.count {
		color: var(--text-dim);
		font-size: 0.9rem;
	}
	.stale {
		color: var(--danger);
		font-size: 0.85rem;
	}
</style>
