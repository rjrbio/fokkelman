<script lang="ts">
	import { page } from '$app/state';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import { SCREENS } from '$lib/screens';
	import { pageSeo } from '$lib/seo';

	const title = 'Fokkelman Photo Vault — a private family photo archive';
	const description =
		'A private family photo archive built with SvelteKit, TypeScript and Cloudinary. Try the public demo.';
	const seo = $derived(
		pageSeo({ origin: page.url.origin, path: '/', title, description, image: SCREENS.og })
	);
</script>

<svelte:head>
	<title>{title}</title>
</svelte:head>
<SeoHead {seo} />

<main>
	<section class="hero">
		<p class="kicker">A personal project by rjrbio</p>
		<h1>Fokkelman Photo Vault</h1>
		<p class="lede">
			A private archive for my family's 3,600+ digitized photographs: searchable, annotated by
			everyone in the family, and behind a secure login. The family photos stay private, but you
			can try the same gallery and viewer on public sample photos.
		</p>
		<nav class="cta">
			<a class="primary" href="/demo">Try the demo</a>
			<a class="secondary" href="https://github.com/rjrbio/fokkelman">GitHub</a>
			<a class="tertiary" href="/login">Family sign in</a>
		</nav>
		<figure class="hero-shot">
			<!-- The picture the page is judged on: first in the queue, never deferred. -->
			<img
				src={SCREENS.gallery.src}
				width={SCREENS.gallery.width}
				height={SCREENS.gallery.height}
				alt={SCREENS.gallery.alt}
				fetchpriority="high"
			/>
		</figure>
	</section>

	<section class="details">
		<article>
			<h2>In the public demo</h2>
			<ul>
				<li>Gallery in justified rows that keep every photo's real proportions</li>
				<li>Search, and favorites that stay in your browser</li>
				<li>Full-screen viewer with zoom and pan, pinch on touch, keyboard and swipe navigation</li>
				<li>Works on a phone</li>
			</ul>
		</article>
		<article>
			<h2>In the family area</h2>
			<p class="note">(private photos, so not in the demo)</p>
			<ul>
				<li>Describe photos with a caption, a year and the people in them, stored as Cloudinary metadata</li>
				<li>Find photos by person, decade or "not identified yet"; every view has its own address</li>
				<li>Select many photos and set a year, people or a description for all of them at once</li>
				<li>Upload new photos with that information attached, mark favorites in bulk, and share a photo straight from a phone</li>
			</ul>
		</article>
		<article>
			<h2>How it's built</h2>
			<ul>
				<li><strong>SvelteKit 2, Svelte 5 and TypeScript</strong> on Netlify</li>
				<li><strong>Cloudinary as the only data store</strong> (folders, tags and metadata through its Search API): no database to run</li>
				<li>The server validates every edit and signs every upload, metadata included</li>
				<li>Scrypt-hashed password, signed HttpOnly cookie, a limit on sign-in attempts and a strict Content-Security-Policy</li>
				<li>A server-side photo index that keeps serving a cached copy if Cloudinary is slow or out of calls</li>
				<li>Vitest and Playwright tests, including a phone-sized project and automated accessibility checks</li>
			</ul>
		</article>
	</section>

	<section class="closer">
		<h2>A closer look</h2>
		<div class="shots">
			<figure>
				<img
					src={SCREENS.viewer.src}
					width={SCREENS.viewer.width}
					height={SCREENS.viewer.height}
					alt={SCREENS.viewer.alt}
					loading="lazy"
					decoding="async"
				/>
				<figcaption>The viewer: zoom, pan, keyboard and swipe.</figcaption>
			</figure>
			<figure class="phone">
				<img
					src={SCREENS.phone.src}
					width={SCREENS.phone.width}
					height={SCREENS.phone.height}
					alt={SCREENS.phone.alt}
					loading="lazy"
					decoding="async"
				/>
				<figcaption>On a phone.</figcaption>
			</figure>
		</div>
	</section>

	<section class="why">
		<h2>Why it's interesting</h2>
		<p>
			This is a full rewrite of my first project (static HTML and vanilla JavaScript with
			client-side auth). Every secret now lives on the server, Firebase gave way to Cloudinary's
			own metadata, and a hand-generated JSON index became a live, cached one.
		</p>
	</section>
</main>

<style>
	main {
		max-width: 960px;
		margin: 0 auto;
		padding: 4rem 1.5rem;
	}
	.hero {
		text-align: center;
		margin-bottom: 4rem;
	}
	.kicker {
		text-transform: uppercase;
		letter-spacing: 0.12em;
		font-size: 0.8rem;
		color: var(--dim);
	}
	h1 {
		font-size: clamp(2.2rem, 6vw, 3.5rem);
		margin: 0.5rem 0 1rem;
	}
	.lede {
		max-width: 620px;
		margin: 0 auto 2rem;
		color: var(--dim);
		font-size: 1.15rem;
		line-height: 1.6;
	}
	.cta {
		display: flex;
		gap: 0.75rem;
		justify-content: center;
		flex-wrap: wrap;
	}
	.cta a {
		padding: 0.8rem 1.6rem;
		border-radius: 999px;
		text-decoration: none;
		font-weight: 600;
	}
	.primary {
		background: var(--accent);
		color: var(--on-accent);
	}
	.secondary {
		border: 1px solid var(--dim);
		color: var(--fg);
	}
	.tertiary {
		color: var(--dim);
	}
	figure {
		margin: 0;
	}
	/* `height: auto` keeps the proportions the width/height attributes declare, so nothing jumps while loading. */
	figure img {
		display: block;
		width: 100%;
		height: auto;
		border-radius: var(--radius);
		border: 1px solid var(--line);
	}
	figcaption {
		margin-top: 0.5rem;
		font-size: 0.9rem;
		color: var(--dim);
	}
	.hero-shot {
		margin-top: 2.5rem;
	}
	.details {
		display: grid;
		gap: 2rem;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		margin-bottom: 4rem;
	}
	article h2 {
		font-size: 1.1rem;
	}
	article ul {
		padding-left: 1.2rem;
		color: var(--dim);
		line-height: 1.7;
	}
	article p {
		color: var(--dim);
		line-height: 1.7;
	}
	.note {
		margin: -0.5rem 0 0.5rem;
		font-size: 0.9rem;
	}
	.closer {
		margin-bottom: 4rem;
	}
	.closer h2,
	.why h2 {
		font-size: 1.1rem;
	}
	.shots {
		display: grid;
		gap: 2rem;
		grid-template-columns: minmax(0, 1fr);
	}
	.phone {
		width: 100%;
		max-width: 260px;
		margin: 0 auto;
	}
	@media (min-width: 720px) {
		.shots {
			grid-template-columns: minmax(0, 1fr) 260px;
			align-items: start;
		}
		.phone {
			margin: 0;
		}
	}
	.why p {
		color: var(--dim);
		line-height: 1.7;
	}
</style>
