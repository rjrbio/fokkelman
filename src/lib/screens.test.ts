import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SCREENS } from './screens';

/** Width and height of a JPEG, read from its first start-of-frame marker. */
function jpegSize(file: Buffer): { width: number; height: number } {
	if (file[0] !== 0xff || file[1] !== 0xd8) throw new Error('not a JPEG');
	let at = 2;
	while (at + 9 < file.length) {
		if (file[at] !== 0xff) throw new Error(`bad marker at ${at}`);
		const marker = file[at + 1];
		const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
		if (isFrame) return { height: file.readUInt16BE(at + 5), width: file.readUInt16BE(at + 7) };
		at += 2 + file.readUInt16BE(at + 2);
	}
	throw new Error('no frame found');
}

const BUDGET_BYTES = 300_000;

describe('the landing screenshots', () => {
	it.each(Object.entries(SCREENS))(
		'%s exists, is a JPEG of the declared size and fits the budget',
		(_name, screen) => {
			const path = new URL(`../../static${screen.src}`, import.meta.url);
			expect(existsSync(path), `${screen.src} is missing: run npm run screenshots`).toBe(true);
			expect(jpegSize(readFileSync(path))).toEqual({ width: screen.width, height: screen.height });
			expect(statSync(path).size).toBeLessThanOrEqual(BUDGET_BYTES);
		}
	);

	it('describes every screenshot with alt text of a sensible length', () => {
		for (const [name, screen] of Object.entries(SCREENS)) {
			expect(screen.alt.length, name).toBeGreaterThanOrEqual(20);
			expect(screen.alt.length, name).toBeLessThanOrEqual(125);
		}
	});

	it('keeps the social preview at the size the networks expect', () => {
		expect(SCREENS.og).toMatchObject({ src: '/og.jpg', width: 1200, height: 630 });
	});
});
