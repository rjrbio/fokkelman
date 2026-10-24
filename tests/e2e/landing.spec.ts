import { expect, test, type Page } from '@playwright/test';
import { en } from '../../src/lib/messages';
import { SCREENS } from '../../src/lib/screens';

const ORIGIN = 'http://localhost:5199';

/** Attributes of every `<meta>` or `<link>` in raw HTML: what a crawler sees, before any JavaScript runs. */
function elements(html: string, tag: 'meta' | 'link'): Record<string, string>[] {
	return [...html.matchAll(new RegExp(`<${tag}\\b([^>]*)>`, 'g'))].map(([, attributes]) =>
		Object.fromEntries([...attributes.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, name, value]) => [name, value]))
	);
}

const titles = (html: string) => [...html.matchAll(/<title>([^<]*)<\/title>/g)].map((match) => match[1]);

/** What the server sends for `path`: the one title, the canonical address and a reader of the preview tags. */
async function serverHtml(request: { get(url: string): Promise<{ text(): Promise<string> }> }, path: string) {
	const html = await (await request.get(path)).text();
	const metas = elements(html, 'meta');
	return {
		titles: titles(html),
		canonical: elements(html, 'link').find((link) => link.rel === 'canonical')?.href,
		tag: (key: string) => metas.find((meta) => meta.property === key || meta.name === key)?.content
	};
}

const screenshots = (page: Page) => page.locator('main img');

test('the landing page carries its preview tags in the HTML the server sends', async ({ request }) => {
	const page = await serverHtml(request, '/');

	// A second, generic <title> in app.html would come first and be the one that is read.
	expect(page.titles).toHaveLength(1);
	expect(page.canonical).toBe(`${ORIGIN}/`);
	expect(page.tag('og:url')).toBe(`${ORIGIN}/`);
	expect(page.tag('og:title')).toBe(page.titles[0]);
	expect(page.tag('og:image')).toBe(`${ORIGIN}/og.jpg`);
	expect(page.tag('og:image:width')).toBe('1200');
	expect(page.tag('og:image:height')).toBe('630');
	expect(page.tag('twitter:card')).toBe('summary_large_image');

	const image = await request.get('/og.jpg');
	expect(image.status()).toBe(200);
	expect(image.headers()['content-type']).toBe('image/jpeg');
});

test('the demo has its own preview tags', async ({ request }) => {
	const page = await serverHtml(request, '/demo');

	expect(page.titles).toEqual([en.demo.title]);
	expect(page.canonical).toBe(`${ORIGIN}/demo`);
	expect(page.tag('og:url')).toBe(`${ORIGIN}/demo`);
	expect(page.tag('og:title')).toBe(en.demo.title);
	expect(page.tag('og:description')).toBe(en.demo.description);
	expect(page.tag('og:image')).toBe(`${ORIGIN}/og.jpg`);
});

test('the screenshots are sized and prioritized so the page does not jump', async ({ page }) => {
	await page.goto('/');
	const images = screenshots(page);
	await expect(images).toHaveCount(3);

	const expected = [SCREENS.gallery, SCREENS.viewer, SCREENS.phone];
	for (const [index, screen] of expected.entries()) {
		const image = images.nth(index);
		await expect(image).toHaveAttribute('src', screen.src);
		await expect(image).toHaveAttribute('width', String(screen.width));
		await expect(image).toHaveAttribute('height', String(screen.height));
		await expect(image).toHaveAttribute('alt', screen.alt);
	}

	// The picture at the top is the one the page is judged on: first in the queue, never deferred.
	await expect(images.nth(0)).toHaveAttribute('fetchpriority', 'high');
	expect(await images.nth(0).getAttribute('loading')).toBeNull();
	// The others are below the fold: deferred, at normal priority.
	for (const index of [1, 2]) {
		await expect(images.nth(index)).toHaveAttribute('loading', 'lazy');
		expect(await images.nth(index).getAttribute('fetchpriority')).toBeNull();
	}
});

test('every screenshot loads', async ({ page }) => {
	await page.goto('/');
	const images = screenshots(page);
	await expect(images).toHaveCount(3);
	for (let index = 0; index < 3; index++) {
		const image = images.nth(index);
		await image.scrollIntoViewIfNeeded();
		await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
	}
});

test('nothing overflows sideways on a small phone', async ({ page }) => {
	await page.setViewportSize({ width: 360, height: 740 });
	await page.goto('/');
	// With the screenshots in place: the old, text-only page never overflowed, so this must wait for them.
	await expect(screenshots(page)).toHaveCount(3);
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(overflow).toBeLessThanOrEqual(0);
});

test('the landing says which features are private', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'In the public demo' })).toBeVisible();
	const family = page.locator('article', {
		has: page.getByRole('heading', { name: 'In the family area' })
	});
	await expect(family).toContainText('private photos, so not in the demo');
});
