<script lang="ts">
	import { enhance } from '$app/forms';
	import { es } from '$lib/messages';

	const m = es.login;
	let { data, form } = $props();

	let showPassword = $state(false);
	const unavailable = $derived(Boolean(data.misconfigured || form?.misconfigured));
	const error = $derived(
		unavailable
			? m.unavailable
			: form?.locked
				? m.locked(form.retryAfterMin)
				: form?.incorrect
					? m.incorrect
					: ''
	);
</script>

<svelte:head><title>{m.title}</title></svelte:head>

<main>
	<form method="POST" use:enhance>
		<h1>{m.heading}</h1>
		<p class="lede">{m.lede}</p>

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
			<label for="password">{m.passwordLabel}</label>
			<div class="control">
				<input
					id="password"
					type={showPassword ? 'text' : 'password'}
					name="password"
					autocomplete="current-password"
					autocapitalize="off"
					autocorrect="off"
					spellcheck="false"
					required
					aria-invalid={form?.incorrect ? 'true' : undefined}
					aria-describedby={error ? 'login-error' : undefined}
				/>
				<button
					type="button"
					class="toggle"
					aria-controls="password"
					aria-label={showPassword ? m.hidePassword : m.showPassword}
					onclick={() => (showPassword = !showPassword)}
				>
					{showPassword ? m.hide : m.show}
				</button>
			</div>
		</div>

		<button type="submit" class="submit" disabled={unavailable}>{m.submit}</button>

		{#if error}
			<p id="login-error" class="error" role="alert">{error}</p>
		{/if}
	</form>
</main>

<style>
	main {
		min-height: 100vh;
		min-height: 100dvh;
		display: grid;
		place-items: center;
		padding: 1rem;
	}
	form {
		display: grid;
		gap: 1.25rem;
		width: min(100%, 380px);
		padding: 2.5rem 2rem;
		border: 1px solid var(--line);
		border-radius: 12px;
		background: var(--bar);
	}
	h1 {
		margin: 0;
		font-size: 1.5rem;
		letter-spacing: -0.01em;
	}
	.lede {
		margin: 0;
		color: var(--dim);
	}
	.field {
		display: grid;
		gap: 0.4rem;
	}
	label {
		font-size: 0.9rem;
		color: var(--dim);
	}
	.control {
		position: relative;
		display: grid;
	}
	.control input {
		min-height: 48px;
		padding: 0.75rem 5.5rem 0.75rem 0.85rem;
		border: 1px solid var(--dim);
		border-radius: var(--radius);
		background: var(--bg);
	}
	.control input[aria-invalid='true'] {
		border-color: var(--danger);
	}
	.toggle {
		position: absolute;
		top: 50%;
		right: 0.25rem;
		transform: translateY(-50%);
		min-width: 44px;
		min-height: 44px;
		padding: 0 0.75rem;
		border: none;
		border-radius: var(--radius);
		background: none;
		color: var(--dim);
	}
	.submit {
		min-height: 48px;
		border: none;
		border-radius: var(--radius);
		background: var(--accent);
		color: var(--on-accent);
		font-weight: 600;
	}
	.submit:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.error {
		margin: 0;
		color: var(--danger);
	}
</style>
