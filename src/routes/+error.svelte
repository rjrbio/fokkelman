<script lang="ts">
	import { page } from '$app/state';
	import { RATE_LIMITED } from '$lib/errors';
	import { langForPath } from '$lib/lang';
	import { en, es } from '$lib/messages';

	const m = $derived((langForPath(page.url.pathname) === 'es' ? es : en).error);
	const notFound = $derived(page.status === 404);
	const rateLimited = $derived(page.error?.message === RATE_LIMITED);
	// A 404 goes to the start of the area it happened in; any other failure retries the page that failed.
	const home = $derived(langForPath(page.url.pathname) === 'es' ? '/app' : '/');
	const retry = $derived(page.url.pathname + page.url.search);
</script>

<svelte:head><title>{notFound ? m.notFoundTitle : m.title}</title></svelte:head>

<main>
	<h1>{notFound ? m.notFoundTitle : m.title}</h1>
	<p>{notFound ? m.notFoundBody : rateLimited ? m.rateLimited : m.body}</p>
	<!-- A full reload: an error in the family layout needs the load to run again. -->
	<a href={notFound ? home : retry} data-sveltekit-reload>{notFound ? m.home : m.retry}</a>
</main>

<style>
	main {
		min-height: 60vh;
		display: grid;
		place-content: center;
		gap: 0.75rem;
		padding: 1.5rem;
		text-align: center;
	}
	h1 {
		margin: 0;
	}
	p {
		margin: 0;
		color: var(--dim);
	}
	a {
		justify-self: center;
		padding: 0.7rem 1.4rem;
		border-radius: 999px;
		background: var(--accent);
		color: var(--on-accent);
		font-weight: 600;
		text-decoration: none;
	}
</style>
