<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Lightbox from '$lib/components/Lightbox.svelte';
	import { toggleFavorite, withFavoriteOverrides } from '$lib/favorites.svelte';
	import { filterPhotos, filtersFromSearchParams } from '$lib/filterPhotos';
	import type { Photo } from '$lib/types';

	const cloudName = $derived(page.data.cloudName as string);
	// Who belongs to the list is decided from the server data plus the overrides as they stood
	// when it was computed, and is NOT re-evaluated on every toggle (hence the `untrack`): with
	// the favorites filter on, un-starring the open photo must not make it vanish from under the
	// viewer. (The server data alone would be wrong too: a photo starred earlier in this session
	// is not a favorite there yet, but the grid behind did offer it.) The live overrides are
	// laid over that membership in `list`, which is what the star and the next/prev links show.
	const base = $derived.by(() => {
		const photos = page.data.photos as Photo[];
		const filters = filtersFromSearchParams(page.url.searchParams);
		return filterPhotos(
			untrack(() => withFavoriteOverrides(photos)),
			filters
		);
	});
	const list = $derived(withFavoriteOverrides(base));
	const index = $derived(list.findIndex((p) => p.publicId === page.params.id));
	const photo = $derived(index >= 0 ? list[index] : undefined);

	function goTo(i: number) {
		goto(`/app/photo/${list[i].publicId}${page.url.search}`, {
			replaceState: true,
			noScroll: true
		});
	}

	async function onToggleFavorite() {
		if (!photo) return;
		const outcome = await toggleFavorite(photo, (publicId, favorite) =>
			fetch('/api/favorite', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ publicId, favorite }),
				// Do not leave the star pending for a minute on a stalled connection.
				signal: AbortSignal.timeout(15000)
			})
		);
		if (outcome === 'unauthorized') {
			await goto(`/login?next=${encodeURIComponent(page.url.pathname + page.url.search)}`);
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
		<a href={`/app${page.url.search}`}>Back to the gallery</a>
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
