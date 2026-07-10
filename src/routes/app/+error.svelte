<script lang="ts">
	import { page } from '$app/state';
</script>

<main>
	<h1>Something went wrong</h1>
	<p>{page.error?.message ?? 'The photo library is unavailable right now. Please try again in a few minutes.'}</p>
	<a href="/app">Try again</a>
</main>

<style>
	main {
		min-height: 60vh;
		display: grid;
		place-content: center;
		gap: 0.5rem;
		text-align: center;
	}
</style>
