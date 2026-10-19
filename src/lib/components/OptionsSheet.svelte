<script lang="ts">
	import { focusTrap } from '$lib/dom';
	import { es } from '$lib/messages';
	import Icon from './Icon.svelte';

	let {
		folders,
		folder,
		onChange,
		onClose
	}: {
		folders: string[];
		folder: string;
		onChange: (folder: string) => void;
		onClose: () => void;
	} = $props();

	const m = es.topbar;

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
	}
</script>

<svelte:window {onkeydown} />

<div class="backdrop" role="presentation" onclick={onClose}></div>
<div class="sheet" role="dialog" aria-modal="true" aria-label={m.options} tabindex="-1" use:focusTrap>
	<div class="head">
		<h2>{m.options}</h2>
		<button class="icon" aria-label={m.closeOptions} onclick={onClose}><Icon name="close" /></button>
	</div>

	<label>
		{m.collection}
		<select value={folder} onchange={(e) => onChange(e.currentTarget.value)}>
			<option value="">{m.allCollections}</option>
			{#each folders as name (name)}
				<option value={name}>{name}</option>
			{/each}
		</select>
	</label>

	<form method="POST" action="/logout">
		<button class="logout" type="submit">{m.logout}</button>
	</form>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 60;
		background: rgb(0 0 0 / 0.6);
	}
	.sheet {
		position: fixed;
		inset: auto 0 0 0;
		z-index: 61;
		display: grid;
		gap: 1rem;
		padding: 1rem 1rem calc(1rem + env(safe-area-inset-bottom));
		border-radius: 16px 16px 0 0;
		border-top: 1px solid var(--line);
		background: var(--bar);
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	h2 {
		margin: 0;
		font-size: 1.1rem;
	}
	.icon {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border: none;
		border-radius: 999px;
		background: var(--chip);
	}
	label {
		display: grid;
		gap: 0.4rem;
		color: var(--dim);
		font-size: 0.9rem;
	}
	select,
	.logout {
		min-height: 48px;
		padding: 0 1rem;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--chip);
		color: var(--fg);
	}
	.logout {
		width: 100%;
	}
</style>
