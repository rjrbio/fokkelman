<script lang="ts">
	import { es } from '$lib/messages';
	import Icon from './Icon.svelte';

	let {
		favoritesOnly,
		filtering,
		onSearch,
		onFavorites,
		onUpload
	}: {
		favoritesOnly: boolean;
		/** Some filter or search is active, so "Fotos" (everything) is not where the user is. */
		filtering: boolean;
		onSearch: () => void;
		onFavorites: () => void;
		onUpload: () => void;
	} = $props();

	const m = es.topbar;
</script>

<nav class="tabs" aria-label={m.nav}>
	<a href="/app" aria-current={filtering ? undefined : 'page'}>
		<Icon name="photos" size={22} />
		{m.tabHome}
	</a>
	<button onclick={onSearch}>
		<Icon name="search" size={22} />
		{m.tabSearch}
	</button>
	<button aria-pressed={favoritesOnly} onclick={onFavorites}>
		<Icon name="star" filled={favoritesOnly} size={22} />
		{m.tabFavorites}
	</button>
	<button onclick={onUpload}>
		<Icon name="upload" size={22} />
		{m.tabUpload}
	</button>
</nav>

<style>
	.tabs {
		position: fixed;
		inset: auto 0 0 0;
		z-index: 20;
		display: none;
		grid-template-columns: repeat(4, 1fr);
		padding-bottom: env(safe-area-inset-bottom);
		border-top: 1px solid var(--line);
		background: var(--bar);
	}
	.tabs a,
	.tabs button {
		display: grid;
		justify-items: center;
		align-content: center;
		gap: 2px;
		min-height: 56px;
		border: none;
		background: none;
		color: var(--dim);
		font-size: 0.75rem;
		text-decoration: none;
	}
	.tabs a[aria-current='page'],
	.tabs button[aria-pressed='true'] {
		color: var(--accent);
	}

	@media (max-width: 720px) {
		.tabs {
			display: grid;
		}
	}
</style>
