import { describe, expect, it } from 'vitest';
import { contextEntries, escapeContextText, parseContext, parsePeople, serializeContext } from './context';

const NOW = 2026;

/** A reader for the string format, to prove that what we write can be read back unchanged. */
function readBack(serialized: string): Record<string, string> {
	const out: Record<string, string> = {};
	let key = '';
	let value = '';
	let inValue = false;
	let escaped = false;
	const flush = () => {
		if (key) out[key] = value;
		key = '';
		value = '';
		inValue = false;
	};
	for (const char of serialized) {
		if (escaped) {
			if (inValue) value += char;
			else key += char;
			escaped = false;
		} else if (char === '\\') escaped = true;
		else if (char === '|') flush();
		else if (char === '=' && !inValue) inValue = true;
		else if (inValue) value += char;
		else key += char;
	}
	flush();
	return out;
}

describe('parseContext', () => {
	it('reads the three keys when they are given as { custom: { … } }', () => {
		const { annotation, extra } = parseContext({ custom: { caption: 'Playa de Sitges', year: '1975', people: 'Ana, Luis' } }, NOW);
		expect(annotation).toEqual({ caption: 'Playa de Sitges', year: 1975, people: ['Ana', 'Luis'] });
		expect(extra).toEqual({});
	});

	it('reads them when they are given flat', () => {
		expect(parseContext({ caption: 'Boda', year: '1980', people: 'Ana' }, NOW).annotation).toEqual({
			caption: 'Boda',
			year: 1980,
			people: ['Ana']
		});
	});

	it('is just empty for a photo with no context, whatever form that takes', () => {
		for (const raw of [undefined, null, {}, { custom: {} }, 'x', 5, [], { custom: [] }]) {
			expect(parseContext(raw, NOW)).toEqual({ annotation: { caption: '', year: null, people: [] }, extra: {} });
		}
	});

	it('takes a year only when it is four digits and between 1800 and this year', () => {
		const yearOf = (year: unknown) => parseContext({ year }, NOW).annotation.year;
		expect(yearOf('1800')).toBe(1800);
		expect(yearOf(' 2026 ')).toBe(2026);
		expect(yearOf(1975)).toBe(1975);
		for (const bad of ['1799', '2027', 'circa 1975', '75', '1975.5', '', 'abcd', null, {}]) {
			expect(yearOf(bad)).toBeNull();
		}
	});

	it('cleans the caption and the names, and never repeats a person', () => {
		const { annotation } = parseContext({ caption: '  Cumple \n de Ana  ', people: ' Ana ,Luis,, ana,  María  José ' }, NOW);
		expect(annotation.caption).toBe('Cumple de Ana');
		expect(annotation.people).toEqual(['Ana', 'Luis', 'María José']);
	});

	it('keeps the keys that are not ours, and drops the empty ones', () => {
		const { annotation, extra } = parseContext({ custom: { caption: 'x', alt: 'texto alternativo', source: 'álbum 3', empty: '' } }, NOW);
		expect(annotation.caption).toBe('x');
		expect(extra).toEqual({ alt: 'texto alternativo', source: 'álbum 3' });
	});

	it('uses the clock for this year when it is not given', () => {
		const next = String(new Date().getFullYear() + 1);
		expect(parseContext({ year: next }).annotation.year).toBeNull();
	});
});

describe('parsePeople', () => {
	it('splits on commas', () => {
		expect(parsePeople('Ana, Luis')).toEqual(['Ana', 'Luis']);
		expect(parsePeople('')).toEqual([]);
	});
});

describe('serializing a context', () => {
	it('escapes | and = inside values', () => {
		expect(escapeContextText('a|b=c')).toBe('a\\|b\\=c');
		expect(escapeContextText('sin nada')).toBe('sin nada');
	});

	it('joins the keys in alphabetical order, so that equal contexts give equal strings', () => {
		expect(serializeContext({ year: '1975', caption: 'Playa', people: 'Ana, Luis' })).toBe(
			'caption=Playa|people=Ana, Luis|year=1975'
		);
	});

	it('can be read back exactly, whatever the text', () => {
		const entries = {
			caption: 'a|b=c "comillas" \'simples\' ñ é 日本 😀 — fin',
			people: 'Ana, Luis',
			year: '1975'
		};
		expect(readBack(serializeContext(entries))).toEqual(entries);
	});
});

describe('contextEntries', () => {
	it('has only the keys that have something in them', () => {
		expect(contextEntries({ caption: '', year: null, people: [] })).toEqual({});
		expect(contextEntries({ caption: 'Playa', year: 1975, people: ['Ana', 'Luis'] })).toEqual({
			caption: 'Playa',
			year: '1975',
			people: 'Ana, Luis'
		});
		expect(contextEntries({ caption: '', year: 1975, people: [] })).toEqual({ year: '1975' });
	});

	it('carries along the keys that are not ours, and ours win', () => {
		expect(contextEntries({ caption: 'Nueva', year: null, people: [] }, { alt: 'x', caption: 'vieja' })).toEqual({
			alt: 'x',
			caption: 'Nueva'
		});
	});

	it('round-trips with parseContext', () => {
		const annotation = { caption: 'Boda de Ana y Luis', year: 1980, people: ['Ana', 'Luis'] };
		const entries = contextEntries(annotation, { alt: 'x' });
		expect(parseContext(readBack(serializeContext(entries)), NOW)).toEqual({ annotation, extra: { alt: 'x' } });
	});
});
