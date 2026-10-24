<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import Icon from '$lib/components/Icon.svelte';
	import Lightbox from '$lib/components/Lightbox.svelte';
	import PhotoGrid from '$lib/components/PhotoGrid.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import { getDemoFavorites, toggleDemoFavorite } from '$lib/demoFavorites';
	import { filterPhotos, NO_FILTERS } from '$lib/filterPhotos';
	import { setMessages } from '$lib/i18n';
	import { en } from '$lib/messages';
	import { SCREENS } from '$lib/screens';
	import { pageSeo } from '$lib/seo';
	import type { Photo } from '$lib/types';

	let { data } = $props();

	// The public demo is in English; the family area is in Spanish.
	setMessages(en);
	const m = en.demo;
	const seo = $derived(
		pageSeo({
			origin: page.url.origin,
			path: '/demo',
			title: m.title,
			description: m.description,
			image: SCREENS.og
		})
	);

	let favorites = $state(browser ? getDemoFavorites() : new Set<string>());
	let query = $state('');
	let favoritesOnly = $state(false);
	let openId = $state<string | null>(null);

	const decorated = $derived(
		data.photos.map((p) => ({ ...p, favorite: favorites.has(p.publicId) }))
	);
	const filtered = $derived(filterPhotos(decorated, { ...NO_FILTERS, query, favoritesOnly }));
	const index = $derived(filtered.findIndex((p) => p.publicId === openId));
	const openPhoto = $derived(index >= 0 ? filtered[index] : undefined);
	const neighbours = $derived(
		[filtered[index - 1], filtered[index + 1]].filter((p): p is Photo => Boolean(p))
	);
</script>

<svelte:head><title>{m.title}</title></svelte:head>
<SeoHead {seo} />

<div class="banner" role="region" aria-label={m.noticeLabel}>
	<strong>{m.banner}</strong>
	{m.bannerRest}
	<a href="/">{m.about}</a>
</div>

<header class="bar">
	<a class="brand" href="/demo">Fokkelman</a>
	<div class="search">
		<Icon name="search" size={18} />
		<input
			type="search"
			placeholder={m.searchPlaceholder}
			aria-label={m.search}
			bind:value={query}
		/>
	</div>
	<button class="pill" aria-pressed={favoritesOnly} onclick={() => (favoritesOnly = !favoritesOnly)}>
		<Icon name="star" filled={favoritesOnly} size={16} />
		{m.favorites}
	</button>
	<span class="count" role="status">{m.photos(filtered.length)}</span>
</header>

<main>
	<h1 class="sr-only">{m.heading}</h1>
	<PhotoGrid
		photos={filtered}
		cloudName={data.cloudName}
		resetKey={`${query}|${favoritesOnly}`}
		onOpen={(publicId) => (openId = publicId)}
	/>
</main>

{#if openPhoto}
	<Lightbox
		photo={openPhoto}
		cloudName={data.cloudName}
		favorite={openPhoto.favorite}
		position={{ index: index + 1, total: filtered.length }}
		preload={neighbours}
		onClose={() => (openId = null)}
		onPrev={index > 0 ? () => (openId = filtered[index - 1].publicId) : undefined}
		onNext={index < filtered.length - 1 ? () => (openId = filtered[index + 1].publicId) : undefined}
		onToggleFavorite={() => (favorites = toggleDemoFavorite(openPhoto.publicId))}
	/>
{/if}

<style>
	.banner {
		padding: 0.6rem 1rem;
		background: color-mix(in srgb, var(--accent) 16%, var(--bg));
		color: var(--fg);
		font-size: 0.95rem;
	}
	.banner a {
		color: var(--accent);
	}
	.bar {
		position: sticky;
		top: 0;
		z-index: 10;
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.75rem;
		padding: 0.5rem 1rem;
		border-bottom: 1px solid var(--line);
		background: var(--bar);
	}
	.brand {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
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
		min-height: 44px;
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
		min-height: 44px;
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
	.count {
		margin-left: auto;
		color: var(--dim);
		font-size: 0.9rem;
	}
</style>
