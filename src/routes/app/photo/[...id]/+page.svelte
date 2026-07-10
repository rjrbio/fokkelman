<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import Lightbox from '$lib/components/Lightbox.svelte';
	import { filterPhotos, filtersFromSearchParams } from '$lib/filterPhotos';
	import type { Photo } from '$lib/types';

	const photos = $derived(page.data.photos as Photo[]);
	const cloudName = $derived(page.data.cloudName as string);
	const list = $derived(filterPhotos(photos, filtersFromSearchParams(page.url.searchParams)));
	const index = $derived(list.findIndex((p) => p.publicId === page.params.id));
	const photo = $derived(index >= 0 ? list[index] : undefined);

	function goTo(i: number) {
		goto(`/app/photo/${list[i].publicId}${page.url.search}`, {
			replaceState: true,
			noScroll: true
		});
	}

	async function toggleFavorite() {
		if (!photo) return;
		const res = await fetch('/api/favorite', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ publicId: photo.publicId, favorite: !photo.favorite })
		});
		if (res.ok) await invalidate('app:photos');
		else alert('Could not update the favorite. Please try again.');
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
		onToggleFavorite={toggleFavorite}
	/>
{:else}
	<div class="missing">
		<p>Photo not found.</p>
		<a href="/app">Back to the gallery</a>
	</div>
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
</style>
