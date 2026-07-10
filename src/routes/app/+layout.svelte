<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import PhotoGrid from '$lib/components/PhotoGrid.svelte';
	import TopBar from '$lib/components/TopBar.svelte';
	import { filterPhotos, filtersFromSearchParams, uniqueFolders } from '$lib/filterPhotos';

	let { data, children } = $props();

	const filters = $derived(filtersFromSearchParams(page.url.searchParams));
	const filtered = $derived(filterPhotos(data.photos, filters));
</script>

<svelte:head><title>Fokkelman Photo Vault</title></svelte:head>

<TopBar
	folders={uniqueFolders(data.photos)}
	{filters}
	total={filtered.length}
	stale={data.stale}
/>

<PhotoGrid
	photos={filtered}
	cloudName={data.cloudName}
	onOpen={(publicId) => goto(`/app/photo/${publicId}${page.url.search}`)}
/>

{@render children()}
