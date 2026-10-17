<script lang="ts">
	import { enhance } from '$app/forms';
	let { data, form } = $props();

	let showPassword = $state(false);
	const unavailable = $derived(Boolean(data.misconfigured || form?.misconfigured));
</script>

<svelte:head><title>Sign in · Fokkelman Photo Vault</title></svelte:head>

<main>
	<form method="POST" use:enhance>
		<h1>Fokkelman Photo Vault</h1>
		<p>Enter the family password to continue.</p>

		<!-- Hidden username so password managers can save and fill the credential. -->
		<input
			class="sr-only"
			type="text"
			name="username"
			value="family"
			autocomplete="username"
			tabindex="-1"
			aria-hidden="true"
			readonly
		/>

		<div class="field">
			<input
				type={showPassword ? 'text' : 'password'}
				name="password"
				placeholder="Family password"
				autocomplete="current-password"
				autocapitalize="off"
				autocorrect="off"
				spellcheck="false"
				required
			/>
			<button
				type="button"
				class="toggle"
				aria-label={showPassword ? 'Hide password' : 'Show password'}
				onclick={() => (showPassword = !showPassword)}
			>
				{showPassword ? 'Hide' : 'Show'}
			</button>
		</div>

		<button type="submit" disabled={unavailable}>Sign in</button>

		{#if unavailable}
			<p class="error" role="alert">Sign-in is unavailable: the server is not configured yet.</p>
		{:else if form?.locked}
			<p class="error" role="alert">
				Too many attempts. Try again in {form.retryAfterMin} min.
			</p>
		{:else if form?.incorrect}
			<p class="error" role="alert">Incorrect password.</p>
		{/if}
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
	.field {
		position: relative;
		display: grid;
	}
	.field input {
		font: inherit;
		padding: 0.75rem 4.5rem 0.75rem 0.75rem;
		border: 1px solid var(--text-dim);
		border-radius: var(--radius);
	}
	.toggle {
		position: absolute;
		right: 0.4rem;
		top: 50%;
		transform: translateY(-50%);
		padding: 0.4rem 0.6rem;
		border: none;
		background: none;
		color: var(--text-dim);
	}
	button[type='submit'] {
		padding: 0.75rem;
		border: none;
		border-radius: var(--radius);
		background: var(--accent);
		color: white;
		font-weight: 600;
	}
	button[type='submit']:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.error {
		color: var(--danger);
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
</style>
