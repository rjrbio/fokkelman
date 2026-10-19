import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../app.css', import.meta.url), 'utf8');

/** Hex colour of a `--token: #rrggbb;` declaration in app.css. */
function token(name: string): string {
	const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`));
	if (!match) throw new Error(`token --${name} not found as a #rrggbb colour in app.css`);
	return match[1];
}

function luminance(hex: string): number {
	const [r, g, b] = [1, 3, 5]
		.map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
		.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
}

// WCAG AA for normal-size text. Every pair below is a text/background combination the UI uses.
const AA = 4.5;

describe('colour tokens', () => {
	it.each([
		['fg', 'bg'],
		['fg', 'bar'],
		['fg', 'chip'],
		['dim', 'bg'],
		['dim', 'bar'],
		['dim', 'chip'],
		['accent', 'bg'],
		['accent', 'bar'],
		['accent', 'chip'],
		['on-accent', 'accent'],
		['danger', 'bg'],
		['danger', 'bar'],
		['danger', 'chip']
	])('--%s on --%s reaches AA contrast', (foreground, background) => {
		expect(contrast(token(foreground), token(background))).toBeGreaterThanOrEqual(AA);
	});

	it('follows the design: near-black background with an amber accent', () => {
		expect(token('bg')).toBe('#0f0f10');
		expect(token('accent')).toBe('#f0b429');
	});
});

/** Every .svelte file under src/. */
function svelteFiles(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
		entry.isDirectory()
			? svelteFiles(join(dir, entry.name))
			: entry.name.endsWith('.svelte')
				? [join(dir, entry.name)]
				: []
	);
}

describe('design tokens in use', () => {
	const sources = svelteFiles(new URL('..', import.meta.url).pathname);

	it('only references tokens that app.css defines', () => {
		expect(sources.length, 'no .svelte files found under src/').toBeGreaterThan(0);
		const defined = new Set([...css.matchAll(/(--[a-z-]+)\s*:/g)].map((match) => match[1]));
		for (const file of sources) {
			const used = [...readFileSync(file, 'utf8').matchAll(/var\((--[a-z-]+)/g)].map((m) => m[1]);
			for (const name of used) expect(defined.has(name), `${name} in ${file}`).toBe(true);
		}
	});
});
