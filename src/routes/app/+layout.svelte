<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import PhotoGrid from '$lib/components/PhotoGrid.svelte';
	import TopBar from '$lib/components/TopBar.svelte';
	import UploadModal from '$lib/components/UploadModal.svelte';
	import {
		clearFavoriteOverrides,
		favoriteFailure,
		withFavoriteOverrides
	} from '$lib/favorites.svelte';
	import { filterPhotos, filtersFromSearchParams, uniqueFolders } from '$lib/filterPhotos';

	let { data, children } = $props();

	const photos = $derived(withFavoriteOverrides(data.photos));
	const filters = $derived(filtersFromSearchParams(page.url.searchParams));
	const filtered = $derived(filterPhotos(photos, filters));

	// Fresh server data supersedes whatever was pending locally.
	$effect(() => {
		void data.fetchedAt;
		clearFavoriteOverrides();
	});

	let showUpload = $state(false);

	async function onUploadClosed(uploadedCount: number) {
		showUpload = false;
		if (uploadedCount > 0) await invalidate('app:photos');
	}
</script>

<svelte:head><title>Fokkelman Photo Vault</title></svelte:head>

<TopBar
	folders={uniqueFolders(photos)}
	{filters}
	total={filtered.length}
	stale={data.stale}
	onUpload={() => (showUpload = true)}
/>

<PhotoGrid
	photos={filtered}
	cloudName={data.cloudName}
	resetKey={page.url.search}
	onOpen={(publicId) => goto(`/app/photo/${publicId}${page.url.search}`, { noScroll: true })}
/>

{#if showUpload}
	<UploadModal folder={filters.folder} onClose={onUploadClosed} />
{/if}

{@render children()}

<!-- Lives here, not in the viewer: it must survive the viewer closing or changing photo. -->
{#if favoriteFailure.publicId}
	<p class="toast" role="alert">
		Could not update the favorite for {favoriteFailure.publicId}. Please try again.
	</p>
{/if}

<style>
	.toast {
		position: fixed;
		left: 50%;
		bottom: 1.5rem;
		transform: translateX(-50%);
		z-index: 150; /* above the viewer overlay */
		margin: 0;
		padding: 0.6rem 1rem;
		border-radius: 999px;
		background: var(--danger);
		color: white;
	}
</style>
