<script lang="ts">
	import '@fontsource-variable/inter';
	import '../app.css';
	import { page } from '$app/state';
	import { langForPath } from '$lib/lang';
	let { children } = $props();

	// The server writes <html lang> for the page it renders (hooks.server.ts); this keeps it right
	// when the user moves between the areas without a full page load.
	$effect(() => {
		document.documentElement.lang = langForPath(page.url.pathname);
	});
</script>

{@render children()}
