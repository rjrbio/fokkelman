<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import {
		annotationFailure,
		clearAnnotationOverrides,
		saveAnnotationInBatches,
		type SaveOutcome,
		withAnnotationOverrides
	} from '$lib/annotate.svelte';
	import { postAnnotation } from '$lib/annotateApi';
	import BulkEditDialog from '$lib/components/BulkEditDialog.svelte';
	import PhotoGrid from '$lib/components/PhotoGrid.svelte';
	import SelectionBar from '$lib/components/SelectionBar.svelte';
	import TopBar from '$lib/components/TopBar.svelte';
	import UploadModal from '$lib/components/UploadModal.svelte';
	import { postFavorites } from '$lib/favoritesApi';
	import {
		clearFavoriteOverrides,
		favoriteFailure,
		setFavorites,
		withFavoriteOverrides
	} from '$lib/favorites.svelte';
	import { knownPeople, type AnnotationPatch } from '$lib/annotations';
	import {
		decadesOf,
		filterPhotos,
		filtersFromSearchParams,
		sortPhotos,
		uniqueFolders
	} from '$lib/filterPhotos';
	import { es } from '$lib/messages';
	import { clearSelection, selectMany, selected, toggleSelected } from '$lib/selection.svelte';

	let { data, children } = $props();

	const photos = $derived(withAnnotationOverrides(withFavoriteOverrides(data.photos)));
	const filters = $derived(filtersFromSearchParams(page.url.searchParams));
	const filtered = $derived(sortPhotos(filterPhotos(photos, filters)));

	// Fresh server data supersedes whatever was pending locally.
	$effect(() => {
		void data.fetchedAt;
		clearFavoriteOverrides();
		clearAnnotationOverrides();
	});

	// What is picked belongs to the view it was picked in: another search or filter starts with nothing picked.
	$effect(() => {
		void page.url.search;
		clearSelection();
	});

	// keepFocus: SvelteKit would otherwise blur the photo that was clicked, and the viewer could
	// not hand the focus back to it when it closes.
	function openPhoto(publicId: string) {
		return goto(`/app/photo/${publicId}${page.url.search}`, { noScroll: true, keepFocus: true });
	}

	let showUpload = $state(false);

	// The bulk edit: what is picked, with what each photo has now, and the dialog that sets the same thing for all.
	let bulkMode = $state<'year' | 'caption' | 'people' | null>(null);
	const pickedPhotos = $derived(photos.filter((p) => selected.has(p.publicId)));

	const allPickedAreFavorite = $derived(pickedPhotos.length > 0 && pickedPhotos.every((p) => p.favorite));

	async function favoritePicked() {
		const outcome = await setFavorites(pickedPhotos, !allPickedAreFavorite, postFavorites);
		if (outcome === 'unauthorized') {
			await goto(`/login?next=${encodeURIComponent(page.url.pathname + page.url.search)}`);
		}
	}

	async function applyBulk(
		patch: AnnotationPatch,
		onProgress: (done: number, total: number) => void
	): Promise<SaveOutcome> {
		const outcome = await saveAnnotationInBatches(pickedPhotos, patch, postAnnotation, onProgress);
		if (outcome === 'unauthorized') {
			await goto(`/login?next=${encodeURIComponent(page.url.pathname + page.url.search)}`);
		}
		return outcome;
	}

	async function onUploadClosed(uploadedCount: number) {
		showUpload = false;
		if (uploadedCount > 0) await invalidate('app:photos');
	}
</script>

<svelte:head><title>{es.app.title}</title></svelte:head>

{#if selected.size > 0}
	<SelectionBar
		count={selected.size}
		total={filtered.length}
		onSelectAll={() => selectMany(filtered.map((p) => p.publicId))}
		onClear={clearSelection}
		onBulk={(mode) => (bulkMode = mode)}
		allFavorite={allPickedAreFavorite}
		onFavorite={favoritePicked}
	/>
{:else}
	<TopBar
		folders={uniqueFolders(photos)}
		people={knownPeople(photos)}
		decades={decadesOf(photos)}
		{filters}
		total={filtered.length}
		stale={data.stale}
		onUpload={() => (showUpload = true)}
	/>
{/if}

<main>
	<h1 class="sr-only">{es.app.heading}</h1>
	{#if filters.unidentified && filtered.length > 0 && selected.size === 0}
		<div class="shortcut">
			<button onclick={() => selectMany(filtered.map((p) => p.publicId))}>
				{es.selection.selectUnidentified(filtered.length)}
			</button>
		</div>
	{/if}
	<PhotoGrid
		photos={filtered}
		cloudName={data.cloudName}
		resetKey={page.url.search}
		onOpen={openPhoto}
		{selected}
		onToggleSelect={toggleSelected}
	/>
</main>

{#if bulkMode}
	<BulkEditDialog
		mode={bulkMode}
		photos={pickedPhotos}
		suggestions={knownPeople(photos)}
		onApply={applyBulk}
		onClose={(applied) => {
			bulkMode = null;
			if (applied) clearSelection();
		}}
	/>
{/if}

{#if showUpload}
	<UploadModal
		folder={filters.folder}
		folders={uniqueFolders(photos)}
		suggestions={knownPeople(photos)}
		onClose={onUploadClosed}
	/>
{/if}

{@render children()}

<!-- Lives here, not in the viewer: it must survive the viewer closing or changing photo. -->
<div class="toasts">
	{#if favoriteFailure.publicId}
		<p class="toast" role="alert">
			{favoriteFailure.count > 1
				? es.app.favoritesFailed(favoriteFailure.count)
				: es.app.favoriteFailed(favoriteFailure.publicId)}
		</p>
	{/if}
	{#if annotationFailure.problem}
		<p class="toast" role="alert">
			{annotationFailure.problem === 'too-many-people'
				? es.app.annotateTooManyPeople
				: annotationFailure.problem === 'too-many-calls'
					? es.app.annotateTooManyChanges
					: es.app.annotateFailed(annotationFailure.count)}
		</p>
	{/if}
</div>

<style>
	@media (max-width: 720px) {
		/* Room for the tab bar fixed to the bottom of the screen. */
		main {
			padding-bottom: calc(56px + env(safe-area-inset-bottom));
		}
	}
	.shortcut {
		padding: 0.5rem 1rem;
	}
	.shortcut button {
		min-height: 44px;
		padding: 0 1rem;
		border: 1px solid var(--line);
		border-radius: 999px;
		background: var(--chip);
		color: var(--fg);
	}
	.toasts {
		position: fixed;
		left: 50%;
		bottom: 1.5rem;
		transform: translateX(-50%);
		z-index: 250; /* above the viewer overlay (100) and the dialogs (200): a failure must be seen, not dimmed behind the scrim */
		display: grid;
		gap: 0.5rem;
		justify-items: center;
		width: max-content;
		max-width: calc(100vw - 2rem);
	}
	.toast {
		margin: 0;
		padding: 0.6rem 1rem;
		border-radius: 999px;
		background: var(--danger);
		color: var(--on-accent);
	}
</style>
