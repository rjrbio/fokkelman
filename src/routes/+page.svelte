<svelte:head>
	<title>Fokkelman Photo Vault — a private family photo archive</title>
	<meta
		name="description"
		content="A private family photo vault built with SvelteKit, TypeScript and Cloudinary. Try the interactive demo."
	/>
</svelte:head>

<main>
	<section class="hero">
		<p class="kicker">A personal project by rjrbio</p>
		<h1>Fokkelman Photo Vault</h1>
		<p class="lede">
			A private photo archive for my family: 3,600+ digitized photographs, searchable and
			organized, behind a secure login. The family photos are private — but you can try the real
			app with public sample photos.
		</p>
		<nav class="cta">
			<a class="primary" href="/demo">Try the demo</a>
			<a class="secondary" href="https://github.com/rjrbio/fokkelman">GitHub</a>
			<a class="tertiary" href="/login">Family sign in</a>
		</nav>
	</section>

	<section class="details">
		<article>
			<h2>What it does</h2>
			<ul>
				<li>Infinite-scroll gallery over 3,600+ photos, served through Cloudinary's CDN</li>
				<li>Full-screen viewer with keyboard, swipe, favorites and original download</li>
				<li>Signed direct-to-Cloudinary uploads with per-file progress</li>
				<li>Search and collection filters, shareable via URL</li>
			</ul>
		</article>
		<article>
			<h2>How it's built</h2>
			<ul>
				<li><strong>SvelteKit + TypeScript</strong> with server routes on Netlify</li>
				<li><strong>Cloudinary as the single source of truth</strong>: folders, tags and its Search API — no separate database</li>
				<li>Server-side session auth: scrypt-hashed password, HMAC-signed HttpOnly cookie</li>
				<li>Photo index cached server-side (5 min TTL) with stale-on-error fallback</li>
				<li>Tested with Vitest (unit) and Playwright (end-to-end against a Cloudinary mock)</li>
			</ul>
		</article>
		<article>
			<h2>Why it's interesting</h2>
			<p>
				This is a full rewrite of my first project (static HTML + vanilla JS with client-side
				auth). The redesign moves every secret server-side, replaces Firebase with Cloudinary's
				own metadata, and turns a hand-generated JSON index into a live, cached one.
			</p>
		</article>
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
	.details {
		display: grid;
		gap: 2rem;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
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
</style>
