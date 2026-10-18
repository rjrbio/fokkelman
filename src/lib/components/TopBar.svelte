<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { filtersToSearch, type GalleryFilters } from '$lib/filterPhotos';
	import { es } from '$lib/messages';
	import BottomNav from './BottomNav.svelte';
	import Icon from './Icon.svelte';
	import OptionsSheet from './OptionsSheet.svelte';

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
		onUpload: () => void;
	} = $props();

	const m = es.topbar;
	const SEARCH_DEBOUNCE_MS = 250;
	let searchTimer: ReturnType<typeof setTimeout> | undefined;
	let pendingQuery: string | undefined;

	let searchInput = $state<HTMLInputElement>();
	// On a phone the search field is folded away until asked for; it starts open if a search is active.
	let searchOpen = $state(untrack(() => filters.query !== ''));
	let optionsOpen = $state(false);

	const filtering = $derived(Boolean(filters.folder || filters.query || filters.favoritesOnly));

	$effect(() => () => clearTimeout(searchTimer));

	function apply(patch: Partial<GalleryFilters>, { replace = false } = {}) {
		clearTimeout(searchTimer);
		const query = pendingQuery ?? filters.query; // flush what was typed but not applied yet
		pendingQuery = undefined;
		goto(`/app${filtersToSearch({ ...filters, query, ...patch })}`, {
			keepFocus: true,
			replaceState: replace
		});
	}

	function onSearchInput(value: string) {
		pendingQuery = value;
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => apply({}, { replace: true }), SEARCH_DEBOUNCE_MS);
	}

	async function openSearch() {
		searchOpen = true;
		await tick();
		searchInput?.focus();
	}

	const toggleFavorites = () => apply({ favoritesOnly: !filters.favoritesOnly });
</script>

<header class="bar">
	<a class="brand" href="/app">{es.brand}</a>

	<div class="search" class:open={searchOpen}>
		<Icon name="search" size={18} />
		<input
			bind:this={searchInput}
			type="search"
			placeholder={m.searchPlaceholder}
			aria-label={m.search}
			value={filters.query}
			oninput={(e) => onSearchInput(e.currentTarget.value)}
		/>
	</div>

	<select
		class="pill wide-only"
		aria-label={m.collection}
		value={filters.folder}
		onchange={(e) => apply({ folder: e.currentTarget.value })}
	>
		<option value="">{m.allCollections}</option>
		{#each folders as folder (folder)}
			<option value={folder}>{folder}</option>
		{/each}
	</select>

	<button class="pill wide-only" aria-pressed={filters.favoritesOnly} onclick={toggleFavorites}>
		<Icon name="star" filled={filters.favoritesOnly} size={16} />
		{m.favorites}
	</button>

	<span class="count" role="status">{m.photos(total)}</span>
	{#if stale}<span class="stale" title={m.staleHint}>{m.stale}</span>{/if}

	<button class="primary wide-only" onclick={onUpload}>{m.upload}</button>
	<form class="wide-only" method="POST" action="/logout">
		<button class="pill" type="submit">{m.logout}</button>
	</form>

	<button
		class="icon narrow-only"
		aria-label={m.search}
		aria-expanded={searchOpen}
		onclick={() => (searchOpen ? (searchOpen = false) : openSearch())}
	>
		<Icon name="search" />
	</button>
	<button class="icon narrow-only" aria-label={m.options} onclick={() => (optionsOpen = true)}>
		<Icon name="more" />
	</button>
</header>

<BottomNav
	favoritesOnly={filters.favoritesOnly}
	{filtering}
	onSearch={openSearch}
	onFavorites={toggleFavorites}
	{onUpload}
/>

{#if optionsOpen}
	<OptionsSheet
		{folders}
		folder={filters.folder}
		onChange={(folder) => {
			apply({ folder });
			optionsOpen = false;
		}}
		onClose={() => (optionsOpen = false)}
	/>
{/if}

<style>
	.bar {
		position: sticky;
		top: 0;
		z-index: 10;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
		min-height: 56px;
		padding: calc(0.5rem + env(safe-area-inset-top)) 1rem 0.5rem;
		border-bottom: 1px solid var(--line);
		background: var(--bar);
	}
	.brand {
		margin-right: 0.5rem;
		color: var(--fg);
		font-weight: 700;
		letter-spacing: -0.01em;
		text-decoration: none;
	}
	.search {
		display: flex;
		align-items: center;
		flex: 1 1 240px;
		max-width: 520px;
		gap: 0.5rem;
		padding: 0 0.9rem;
		border-radius: 999px;
		background: var(--chip);
		color: var(--dim);
	}
	.search:focus-within {
		outline: 2px solid var(--accent);
	}
	.search input {
		flex: 1;
		min-width: 0;
		min-height: 40px;
		border: none;
		outline: none;
		background: none;
		color: var(--fg);
	}
	.search input::placeholder {
		color: var(--dim);
	}
	.pill {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		min-height: 40px;
		padding: 0 1rem;
		border: 1px solid var(--line);
		border-radius: 999px;
		background: var(--chip);
		color: var(--fg);
	}
	.pill[aria-pressed='true'] {
		border-color: transparent;
		background: var(--accent);
		color: var(--on-accent);
	}
	.primary {
		min-height: 40px;
		padding: 0 1.25rem;
		border: none;
		border-radius: 999px;
		background: var(--accent);
		color: var(--on-accent);
		font-weight: 600;
	}
	.count {
		margin-left: auto;
		color: var(--dim);
		font-size: 0.9rem;
	}
	.stale {
		color: var(--danger);
		font-size: 0.85rem;
	}
	.icon {
		display: none;
		place-items: center;
		width: 44px;
		height: 44px;
		border: none;
		border-radius: 999px;
		background: var(--chip);
	}

	@media (max-width: 720px) {
		.bar {
			gap: 0.5rem;
		}
		.wide-only {
			display: none;
		}
		.icon {
			display: grid;
		}
		.search {
			display: none;
			order: 10;
			flex-basis: 100%;
			max-width: none;
		}
		.search.open {
			display: flex;
		}
		.search input {
			min-height: 44px;
		}
	}
</style>
