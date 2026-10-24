import { describe, expect, it } from 'vitest';
import { uploadContextFrom } from './uploadContext';

describe('uploadContextFrom', () => {
	it('gives no context when nothing was asked for, however it is spelled', () => {
		for (const input of [{}, { caption: '', year: null, people: [] }, { caption: '   ' }, { people: ['  '] }]) {
			expect(uploadContextFrom(input)).toEqual({ ok: true, context: undefined });
		}
	});

	it('builds the context from the three fields, clean and with the separators escaped', () => {
		expect(uploadContextFrom({ caption: '  Fiesta | 50 = años ', year: 1999, people: ['Ana', ' luis ', 'ANA'] })).toEqual({
			ok: true,
			context: 'caption=Fiesta \\| 50 \\= años|people=Ana, luis|year=1999'
		});
	});

	it('takes any one of them on its own', () => {
		expect(uploadContextFrom({ year: 1975 })).toEqual({ ok: true, context: 'year=1975' });
		expect(uploadContextFrom({ people: ['Ana'] })).toEqual({ ok: true, context: 'people=Ana' });
	});

	it('holds what is asked to the same rules as an edit', () => {
		const problemOf = (input: object) => {
			const result = uploadContextFrom(input);
			return result.ok ? 'ok' : result.problem;
		};
		expect(problemOf({ year: 1500 })).toBe('year-out-of-range');
		expect(problemOf({ year: '1975' })).toBe('bad-shape');
		expect(problemOf({ caption: 'x'.repeat(256) })).toBe('caption-too-long');
		expect(problemOf({ caption: 'a\\b' })).toBe('has-backslash');
		expect(problemOf({ people: ['Ana, Luis'] })).toBe('person-has-comma');
		expect(problemOf({ people: ['x'.repeat(41)] })).toBe('person-too-long');
		expect(problemOf({ people: 'Ana' })).toBe('bad-shape');
		expect(problemOf({ people: Array.from({ length: 8 }, (_, i) => `${'N'.repeat(30)}${i}`) })).toBe('too-many-people');
	});
});
