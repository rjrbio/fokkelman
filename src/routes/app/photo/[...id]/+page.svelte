<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Lightbox from '$lib/components/Lightbox.svelte';
	import PhotoNotes from '$lib/components/PhotoNotes.svelte';
	import { saveAnnotation, withAnnotationOverrides } from '$lib/annotate.svelte';
	import { knownPeople, type AnnotationPatch } from '$lib/annotations';
	import { toggleFavorite, withFavoriteOverrides } from '$lib/favorites.svelte';
	import { filterPhotos, filtersFromSearchParams, sortPhotos } from '$lib/filterPhotos';
	import { es } from '$lib/messages';
	import type { Photo } from '$lib/types';

	const m = es.viewer;

	const cloudName = $derived(page.data.cloudName as string);
	// Who belongs to the list is decided from the server data plus the overrides as they stood
	// when it was computed, and is NOT re-evaluated on every change (hence the `untrack`): with
	// the favorites filter on, un-starring the open photo must not make it vanish from under the
	// viewer, and giving it a year must not move it to another place in the list while it is open.
	// (The server data alone would be wrong too: a photo starred earlier in this session
	// is not a favorite there yet, but the grid behind did offer it.) The live overrides are
	// laid over that membership and order in `list`, which is what the star, the details and the
	// next/prev links show.
	const withOverrides = (photos: Photo[]) => withAnnotationOverrides(withFavoriteOverrides(photos));
	const base = $derived.by(() => {
		const photos = page.data.photos as Photo[];
		const filters = filtersFromSearchParams(page.url.searchParams);
		return sortPhotos(filterPhotos(untrack(() => withOverrides(photos)), filters));
	});
	const list = $derived(withOverrides(base));
	const index = $derived(list.findIndex((p) => p.publicId === page.params.id));
	const photo = $derived(index >= 0 ? list[index] : undefined);
	const neighbours = $derived([list[index - 1], list[index + 1]].filter((p): p is Photo => Boolean(p)));

	// Names already used anywhere in the library, to suggest them in the editor.
	const people = $derived(knownPeople(withOverrides(page.data.photos as Photo[])));

	// keepFocus everywhere: after a navigation SvelteKit moves the focus to the page, which would
	// pull it out of the viewer (or off the photo the viewer must hand it back to).
	function goTo(i: number) {
		goto(`/app/photo/${list[i].publicId}${page.url.search}`, {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		});
	}

	async function onSaveNotes(patch: AnnotationPatch) {
		if (!photo) return 'failed' as const;
		const outcome = await saveAnnotation([photo], patch, (publicIds, body) =>
			fetch('/api/annotate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ publicIds, patch: body }),
				// Clearing a field takes two calls to Cloudinary: give it longer than a favorite.
				signal: AbortSignal.timeout(30000)
			})
		);
		if (outcome === 'unauthorized') {
			await goto(`/login?next=${encodeURIComponent(page.url.pathname + page.url.search)}`);
		}
		return outcome;
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
		position={{ index: index + 1, total: list.length }}
		preload={neighbours}
		onClose={() => goto(`/app${page.url.search}`, { noScroll: true, keepFocus: true })}
		onPrev={index > 0 ? () => goTo(index - 1) : undefined}
		onNext={index < list.length - 1 ? () => goTo(index + 1) : undefined}
		{onToggleFavorite}
	>
		{#snippet notes()}
			<!-- Keyed: another photo starts with its own, closed, editor. -->
			{#key photo.publicId}
				<PhotoNotes {photo} suggestions={people} onSave={onSaveNotes} />
			{/key}
		{/snippet}
	</Lightbox>
{:else}
	<div class="missing">
		<p>{m.notFound}</p>
		<a href={`/app${page.url.search}`}>{m.backToGallery}</a>
	</div>
{/if}

<style>
	.missing {
		position: fixed;
		inset: 0;
		z-index: 100;
		display: grid;
		place-content: center;
		gap: 0.5rem;
		background: var(--bg);
		text-align: center;
	}
	.missing p {
		margin: 0;
	}
	.missing a {
		color: var(--accent);
	}
</style>
