import { describe, expect, it } from 'vitest';
import { pageSeo, type Seo, type SeoInput } from './seo';

const input: SeoInput = {
	origin: 'https://fokkelman.netlify.app',
	path: '/demo',
	title: 'Demo · Fokkelman Photo Vault',
	description: 'Try the real gallery and viewer on public sample photos.',
	image: { src: '/og.jpg', width: 1200, height: 630, alt: 'The Fokkelman Photo Vault gallery' }
};

/** Content of the tag called `key` (an `og:*` property or a `name`). */
const tag = (seo: Seo, key: string) => seo.tags.find((t) => (t.property ?? t.name) === key)?.content;

describe('pageSeo', () => {
	it('builds the canonical address from the origin and the path', () => {
		expect(pageSeo(input).canonical).toBe('https://fokkelman.netlify.app/demo');
	});

	it('strips the trailing slash of the origin and keeps the root as a single slash', () => {
		expect(pageSeo({ ...input, origin: 'http://localhost:5199/', path: '/' }).canonical).toBe(
			'http://localhost:5199/'
		);
	});

	it('adds the leading slash a path lacks', () => {
		expect(pageSeo({ ...input, path: 'demo' }).canonical).toBe('https://fokkelman.netlify.app/demo');
	});

	it('makes the preview image an absolute address on the same origin', () => {
		const seo = pageSeo({ ...input, origin: 'https://deploy-preview-7--fokkelman.netlify.app' });
		expect(tag(seo, 'og:image')).toBe('https://deploy-preview-7--fokkelman.netlify.app/og.jpg');
		expect(tag(seo, 'twitter:image')).toBe('https://deploy-preview-7--fokkelman.netlify.app/og.jpg');
	});

	it('declares the image size as text and asks for a large-image card', () => {
		const seo = pageSeo(input);
		expect(tag(seo, 'og:image:width')).toBe('1200');
		expect(tag(seo, 'og:image:height')).toBe('630');
		expect(tag(seo, 'twitter:card')).toBe('summary_large_image');
	});

	it('says the same thing to Open Graph and to Twitter', () => {
		const seo = pageSeo(input);
		expect(tag(seo, 'og:title')).toBe(input.title);
		expect(tag(seo, 'twitter:title')).toBe(input.title);
		expect(tag(seo, 'description')).toBe(input.description);
		expect(tag(seo, 'og:description')).toBe(input.description);
		expect(tag(seo, 'twitter:description')).toBe(input.description);
		expect(tag(seo, 'og:url')).toBe(seo.canonical);
	});

	it('uses property for og:* and name for everything else, never both, and repeats no tag', () => {
		const seo = pageSeo(input);
		for (const t of seo.tags) {
			expect(Boolean(t.property) !== Boolean(t.name), JSON.stringify(t)).toBe(true);
			if (t.property) expect(t.property.startsWith('og:')).toBe(true);
			else expect(t.name === 'description' || t.name!.startsWith('twitter:')).toBe(true);
		}
		const keys = seo.tags.map((t) => t.property ?? t.name);
		expect(new Set(keys).size).toBe(keys.length);
	});
});
