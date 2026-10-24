// Takes the pictures of the landing page from the PUBLIC demo (`/demo`, sample photos only) and writes
// them under `static/`. Run it with `npm run screenshots`; `SCREENSHOT_BASE_URL` points it at another
// deploy (a Netlify preview, for example). The sizes are the ones in `src/lib/screens.ts`, which a unit
// test keeps in agreement with the files.
import { statSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from '@playwright/test';

const BASE = (process.env.SCREENSHOT_BASE_URL ?? 'https://fokkelman.netlify.app').replace(/\/+$/, '');
const QUALITY = 82;
const MIN_PHOTOS = 6;

const staticPath = (relative) => fileURLToPath(new URL(`../static/${relative}`, import.meta.url));
const projectPath = (relative) => fileURLToPath(new URL(`../${relative}`, import.meta.url));
const appearance = { colorScheme: 'dark', reducedMotion: 'reduce' };

/** Opens the demo and refuses to go on unless it really is the public demo with photos on screen. */
async function openDemo(page) {
	await page.goto(`${BASE}/demo`, { waitUntil: 'networkidle' });
	// The only page this script may photograph: a redirect to the sign-in (or anywhere else) stops it.
	if (new URL(page.url()).pathname !== '/demo') throw new Error(`expected /demo, got ${page.url()}`);
	await page.getByRole('region', { name: 'Demo notice' }).waitFor({ timeout: 15_000 });
	const photos = page.getByRole('button', { name: /^Open / });
	await photos.first().waitFor({ timeout: 15_000 });
	const count = await photos.count();
	if (count < MIN_PHOTOS) throw new Error(`the demo shows ${count} photos, expected at least ${MIN_PHOTOS}`);
	await imagesLoaded(page);
	return photos;
}

/** Waits until every image on screen has loaded (the ones below the fold are lazy and do not count). */
async function imagesLoaded(page, root = 'body') {
	await page.waitForFunction(
		(selector) =>
			[...document.querySelector(selector).querySelectorAll('img')]
				.filter((img) => img.getBoundingClientRect().top < window.innerHeight)
				.every((img) => img.complete && img.naturalWidth > 0),
		root,
		{ timeout: 30_000 }
	);
}

/** The page reserves room for a scrollbar that a screenshot does not draw: without it the picture ends in a grey strip. */
async function dropScrollbarGutter(page) {
	await page.addStyleTag({ content: 'html { scrollbar-gutter: auto !important; }' });
	await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
	await imagesLoaded(page);
}

async function shoot(page, relative, options = {}) {
	const path = staticPath(relative);
	await page.screenshot({ path, type: 'jpeg', quality: QUALITY, ...options });
	return path;
}

/** Hex colours of the design tokens, read from app.css so the card cannot drift from the app. */
async function tokens() {
	const css = await readFile(projectPath('src/app.css'), 'utf8');
	const token = (name) => {
		const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`));
		if (!match) throw new Error(`token --${name} not found in app.css`);
		return match[1];
	};
	return { bg: token('bg'), fg: token('fg'), dim: token('dim'), accent: token('accent') };
}

/** The 1200×630 card link previews show: title and tagline beside the gallery screenshot. */
async function socialCard(browser) {
	const { bg, fg, dim, accent } = await tokens();
	const gallery = (await readFile(staticPath('screens/gallery.jpg'))).toString('base64');
	const font = (
		await readFile(projectPath('node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2'))
	).toString('base64');
	const html = `<!doctype html><html><head><style>
		@font-face { font-family: 'Inter Variable'; font-weight: 100 900; src: url(data:font/woff2;base64,${font}) format('woff2'); }
		* { box-sizing: border-box; margin: 0; }
		body { width: 1200px; height: 630px; overflow: hidden; position: relative; background: ${bg}; color: ${fg};
			font-family: 'Inter Variable', system-ui, sans-serif; }
		.text { position: absolute; left: 72px; top: 0; bottom: 0; width: 440px; display: flex; flex-direction: column; justify-content: center; gap: 24px; }
		.bar { width: 64px; height: 6px; border-radius: 3px; background: ${accent}; }
		h1 { font-size: 68px; line-height: 1.05; font-weight: 700; letter-spacing: -0.02em; }
		p { font-size: 28px; line-height: 1.35; color: ${dim}; }
		img { position: absolute; left: 560px; top: 96px; width: 760px; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.14); }
	</style></head><body>
		<div class="text"><div class="bar"></div><h1>Fokkelman Photo Vault</h1><p>A private family photo archive</p></div>
		<img src="data:image/jpeg;base64,${gallery}" alt="" />
	</body></html>`;
	const context = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
	const page = await context.newPage();
	await page.setContent(html, { waitUntil: 'load' });
	await page.evaluate(() => document.fonts.ready);
	const path = await shoot(page, 'og.jpg');
	await context.close();
	return path;
}

const browser = await chromium.launch();
try {
	await mkdir(staticPath('screens'), { recursive: true });
	const written = [];

	// Desktop: the gallery, then the viewer open on the first photo.
	const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, ...appearance });
	const page = await desktop.newPage();
	const photos = await openDemo(page);
	await dropScrollbarGutter(page);
	written.push(await shoot(page, 'screens/gallery.jpg'));
	// A landscape photo fills the stage better than a portrait one. `SCREENSHOT_VIEWER_PHOTO` (a piece of
	// the file name) picks which; if it is not in the demo any more, the first landscape photo is used.
	const wanted = process.env.SCREENSHOT_VIEWER_PHOTO ?? 'house';
	const chosen = await page.evaluate((name) => {
		const buttons = [...document.querySelectorAll('button[aria-label^="Open "]')];
		const named = buttons.findIndex((button) => button.getAttribute('aria-label').includes(name));
		if (named >= 0) return named;
		return buttons.findIndex((button) => {
			const img = button.querySelector('img');
			return img !== null && img.naturalWidth / img.naturalHeight > 1.3;
		});
	}, wanted);
	await photos.nth(Math.max(chosen, 0)).click();
	const viewer = page.getByRole('dialog', { name: 'Photo viewer' });
	await viewer.waitFor();
	// The viewer shows the thumbnail first and swaps in the large version: wait for the large one.
	await page.waitForFunction(
		() => {
			const images = [...document.querySelectorAll('[role="dialog"] img')];
			return images.length > 0 && images.every((img) => img.complete && img.naturalWidth >= 1200);
		},
		undefined,
		{ timeout: 30_000 }
	);
	await page.mouse.move(0, 0);
	written.push(await shoot(page, 'screens/viewer.jpg'));
	await desktop.close();

	// Phone: a Pixel 7 at 412×915 CSS pixels and double density, so the file is 824×1830.
	const phone = await browser.newContext({
		...devices['Pixel 7'],
		viewport: { width: 412, height: 915 },
		deviceScaleFactor: 2,
		...appearance
	});
	const phonePage = await phone.newPage();
	await openDemo(phonePage);
	await dropScrollbarGutter(phonePage);
	written.push(await shoot(phonePage, 'screens/phone.jpg'));
	await phone.close();

	written.push(await socialCard(browser));

	for (const path of written) {
		const { size } = statSync(path);
		console.log(`${path.replace(projectPath(''), '')}  ${(size / 1024).toFixed(0)} KB`);
	}
} catch (error) {
	console.error(`screenshots failed: ${error instanceof Error ? error.message : error}`);
	process.exitCode = 1;
} finally {
	await browser.close();
}
