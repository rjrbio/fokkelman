<script lang="ts">
	import { browser } from '$app/environment';
	import Lightbox from '$lib/components/Lightbox.svelte';
	import PhotoGrid from '$lib/components/PhotoGrid.svelte';
	import { getDemoFavorites, toggleDemoFavorite } from '$lib/demoFavorites';
	import { filterPhotos } from '$lib/filterPhotos';

	let { data } = $props();

	let favorites = $state(browser ? getDemoFavorites() : new Set<string>());
	let query = $state('');
	let favoritesOnly = $state(false);
	let openId = $state<string | null>(null);

	const decorated = $derived(
		data.photos.map((p) => ({ ...p, favorite: favorites.has(p.publicId) }))
	);
	const filtered = $derived(filterPhotos(decorated, { folder: '', query, favoritesOnly }));
	const index = $derived(filtered.findIndex((p) => p.publicId === openId));
	const openPhoto = $derived(index >= 0 ? filtered[index] : undefined);
</script>

<svelte:head><title>Demo · Fokkelman Photo Vault</title></svelte:head>

<div class="banner">
	<strong>Demo mode.</strong> These are public sample photos — favorites are stored only in your
	browser. <a href="/">About this project</a>
</div>

<header>
	<input type="search" placeholder="Search by file name…" aria-label="Search photos" bind:value={query} />
	<button class="chip" aria-pressed={favoritesOnly} onclick={() => (favoritesOnly = !favoritesOnly)}>
		★ Favorites
	</button>
	<span class="count">{filtered.length} photos</span>
</header>

<PhotoGrid photos={filtered} cloudName={data.cloudName} onOpen={(publicId) => (openId = publicId)} />

{#if openPhoto}
	<Lightbox
		photo={openPhoto}
		cloudName={data.cloudName}
		favorite={openPhoto.favorite}
		onClose={() => (openId = null)}
		onPrev={index > 0 ? () => (openId = filtered[index - 1].publicId) : undefined}
		onNext={index < filtered.length - 1 ? () => (openId = filtered[index + 1].publicId) : undefined}
		onToggleFavorite={() => (favorites = toggleDemoFavorite(openPhoto.publicId))}
	/>
{/if}

<style>
	.banner {
		padding: 0.6rem 1rem;
		background: #fef7e0;
		color: #5f4b00;
		font-size: 0.95rem;
	}
	.banner a {
		color: inherit;
	}
	header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.6rem 1rem;
		border-bottom: 1px solid var(--surface);
	}
	input {
		flex: 1;
		min-width: 160px;
		font: inherit;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--surface);
		border-radius: var(--radius);
		background: var(--surface);
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
	.count {
		color: var(--text-dim);
		font-size: 0.9rem;
	}
</style>
