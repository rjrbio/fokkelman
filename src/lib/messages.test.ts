import { describe, expect, it } from 'vitest';
import { en, es } from './messages';

/** Calls every function in `value` with plausible arguments and collects the strings. */
function strings(value: unknown, path = ''): { path: string; text: string }[] {
	if (typeof value === 'string') return [{ path, text: value }];
	if (typeof value === 'function') {
		const text = (value as (...args: unknown[]) => unknown)(3, 4);
		return [{ path: `${path}()`, text: String(text) }];
	}
	return Object.entries(value as object).flatMap(([key, child]) =>
		strings(child, path ? `${path}.${key}` : key)
	);
}

describe('messages', () => {
	it('has no empty or placeholder strings, in either language', () => {
		for (const { path, text } of [...strings(es), ...strings(en)]) {
			expect(text.trim(), path).not.toBe('');
			expect(text, path).not.toMatch(/undefined|NaN|\[object/);
		}
	});

	it('gives the shared parts the same keys in Spanish and English', () => {
		for (const section of ['error', 'grid', 'viewer'] as const) {
			expect(Object.keys(en[section]).sort(), section).toEqual(Object.keys(es[section]).sort());
		}
	});

	it('counts photos with the right plural, in each language', () => {
		expect(es.topbar.photos(1)).toBe('1 foto');
		expect(es.topbar.photos(0)).toBe('0 fotos');
		expect(es.topbar.photos(80)).toBe('80 fotos');
		expect(en.demo.photos(1)).toBe('1 photo');
		expect(en.demo.photos(3)).toBe('3 photos');
	});

	it('pluralises the skipped files notice', () => {
		expect(es.upload.skipped(1)).toBe('1 archivo omitido (repetido o no es una imagen).');
		expect(es.upload.skipped(2)).toBe('2 archivos omitidos (repetido o no es una imagen).');
	});
});
