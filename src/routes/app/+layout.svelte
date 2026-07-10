<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import PhotoGrid from '$lib/components/PhotoGrid.svelte';
	import TopBar from '$lib/components/TopBar.svelte';
	import UploadModal from '$lib/components/UploadModal.svelte';
	import { filterPhotos, filtersFromSearchParams, uniqueFolders } from '$lib/filterPhotos';

	let { data, children } = $props();

	const filters = $derived(filtersFromSearchParams(page.url.searchParams));
	const filtered = $derived(filterPhotos(data.photos, filters));

	let showUpload = $state(false);

	async function onUploadClosed(uploadedCount: number) {
		showUpload = false;
		if (uploadedCount > 0) await invalidate('app:photos');
	}
</script>

<svelte:head><title>Fokkelman Photo Vault</title></svelte:head>

<TopBar
	folders={uniqueFolders(data.photos)}
	{filters}
	total={filtered.length}
	stale={data.stale}
	onUpload={() => (showUpload = true)}
/>

<PhotoGrid
	photos={filtered}
	cloudName={data.cloudName}
	onOpen={(publicId) => goto(`/app/photo/${publicId}${page.url.search}`)}
/>

{#if showUpload}
	<UploadModal folder={filters.folder} onClose={onUploadClosed} />
{/if}

{@render children()}
