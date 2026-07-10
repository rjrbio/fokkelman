<script lang="ts">
	import { enhance } from '$app/forms';
	let { form } = $props();
</script>

<svelte:head><title>Sign in · Fokkelman Photo Vault</title></svelte:head>

<main>
	<form method="POST" use:enhance>
		<h1>Fokkelman Photo Vault</h1>
		<p>Enter the family password to continue.</p>
		<input
			type="password"
			name="password"
			placeholder="Family password"
			autocomplete="current-password"
			required
		/>
		<button type="submit">Sign in</button>
		{#if form?.incorrect}<p class="error" role="alert">Incorrect password.</p>{/if}
	</form>
</main>

<style>
	main {
		min-height: 100vh;
		display: grid;
		place-items: center;
		background: var(--surface);
	}
	form {
		background: var(--bg);
		padding: 2.5rem;
		border-radius: var(--radius);
		box-shadow: 0 1px 4px rgb(0 0 0 / 0.15);
		display: grid;
		gap: 1rem;
		width: min(90vw, 380px);
	}
	h1 {
		margin: 0;
		font-size: 1.4rem;
	}
	p {
		margin: 0;
		color: var(--text-dim);
	}
	input {
		font: inherit;
		padding: 0.75rem;
		border: 1px solid var(--text-dim);
		border-radius: var(--radius);
	}
	button {
		padding: 0.75rem;
		border: none;
		border-radius: var(--radius);
		background: var(--accent);
		color: white;
		font-weight: 600;
	}
	.error {
		color: var(--danger);
	}
</style>
