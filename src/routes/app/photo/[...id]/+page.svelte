<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Lightbox from '$lib/components/Lightbox.svelte';
	import { toggleFavorite, withFavoriteOverrides } from '$lib/favorites.svelte';
	import { filterPhotos, filtersFromSearchParams } from '$lib/filterPhotos';
	import type { Photo } from '$lib/types';

	const photos = $derived(withFavoriteOverrides(page.data.photos as Photo[]));
	const cloudName = $derived(page.data.cloudName as string);
	const list = $derived(filterPhotos(photos, filtersFromSearchParams(page.url.searchParams)));
	const index = $derived(list.findIndex((p) => p.publicId === page.params.id));
	const photo = $derived(index >= 0 ? list[index] : undefined);

	let error = $state('');

	function goTo(i: number) {
		goto(`/app/photo/${list[i].publicId}${page.url.search}`, {
			replaceState: true,
			noScroll: true
		});
	}

	async function onToggleFavorite() {
		if (!photo) return;
		error = '';
		const outcome = await toggleFavorite(photo, (publicId, favorite) =>
			fetch('/api/favorite', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ publicId, favorite })
			})
		);
		if (outcome === 'unauthorized') {
			await goto(`/login?next=${encodeURIComponent(page.url.pathname + page.url.search)}`);
		} else if (outcome === 'failed') {
			error = 'Could not update the favorite. Please try again.';
		}
	}
</script>

{#if photo}
	<Lightbox
		{photo}
		{cloudName}
		favorite={photo.favorite}
		onClose={() => goto(`/app${page.url.search}`, { noScroll: true })}
		onPrev={index > 0 ? () => goTo(index - 1) : undefined}
		onNext={index < list.length - 1 ? () => goTo(index + 1) : undefined}
		{onToggleFavorite}
	/>
{:else}
	<div class="missing">
		<p>Photo not found.</p>
		<a href="/app">Back to the gallery</a>
	</div>
{/if}

{#if error}
	<p class="toast" role="alert">{error}</p>
{/if}

<style>
	.missing {
		position: fixed;
		inset: 0;
		z-index: 100;
		background: rgb(0 0 0 / 0.92);
		color: white;
		display: grid;
		place-content: center;
		gap: 0.5rem;
		text-align: center;
	}
	.missing a {
		color: white;
	}
	.toast {
		position: fixed;
		left: 50%;
		bottom: 1.5rem;
		transform: translateX(-50%);
		z-index: 150;
		margin: 0;
		padding: 0.6rem 1rem;
		border-radius: 999px;
		background: var(--danger);
		color: white;
	}
</style>
