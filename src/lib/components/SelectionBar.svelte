<script lang="ts">
	import { es } from '$lib/messages';

	let {
		count,
		total,
		onSelectAll,
		onClear
	}: {
		/** How many photos are picked. */
		count: number;
		/** How many photos the gallery shows now, for "pick them all". */
		total: number;
		onSelectAll: () => void;
		onClear: () => void;
	} = $props();

	const m = es.selection;

	function onkeydown(event: KeyboardEvent) {
		if (event.key !== 'Escape' || event.defaultPrevented) return;
		// A dialog opened from here has its own Esc: this one only ends the selection when nothing else is on top.
		if (document.querySelector('[role="dialog"]')) return;
		onClear();
	}
</script>

<svelte:window {onkeydown} />

<!-- A banner like the top bar it replaces, so that nothing on the page is outside a landmark. -->
<header class="bar">
	<div class="group" role="group" aria-label={m.bar}>
		<span class="count" role="status">{m.count(count)}</span>
		{#if count < total}
			<button class="pill" onclick={onSelectAll}>{m.selectAll(total)}</button>
		{/if}
		<button class="pill clear" onclick={onClear}>{m.clear}</button>
	</div>
</header>

<style>
	.bar {
		position: sticky;
		top: 0;
		z-index: 10;
		min-height: 56px;
		padding: calc(0.5rem + env(safe-area-inset-top)) 1rem 0.5rem;
		border-bottom: 1px solid var(--line);
		background: var(--bar);
	}
	.group {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.count {
		margin-right: 0.5rem;
		font-weight: 600;
	}
	.pill {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		padding: 0 1rem;
		border: 1px solid var(--line);
		border-radius: 999px;
		background: var(--chip);
		color: var(--fg);
	}
	.clear {
		margin-left: auto;
	}
</style>
