<script lang="ts">
	import type { Seo } from '$lib/seo';

	let { seo }: { seo: Seo } = $props();
</script>

<!-- The title is each page's own; this is the canonical address and the link-preview tags. -->
<svelte:head>
	<link rel="canonical" href={seo.canonical} />
	{#each seo.tags as tag (tag.property ?? tag.name)}
		<meta name={tag.name} property={tag.property} content={tag.content} />
	{/each}
</svelte:head>
