import { describe, expect, it } from 'vitest';
import { problemText } from './problemText';

describe('problemText', () => {
	it('says what is wrong, with the limits that apply', () => {
		expect(problemText('caption-too-long')).toContain('255');
		expect(problemText('person-too-long')).toContain('40');
		expect(problemText('year-out-of-range', 2026)).toContain('entre 1800 y 2026');
		expect(problemText('has-backslash')).toContain('barra invertida');
		expect(problemText('too-many-people')).toContain('demasiadas personas');
	});

	it('has something to say about any other problem too', () => {
		for (const problem of ['bad-shape', 'nothing-to-change', 'person-has-comma'] as const) {
			expect(problemText(problem)).not.toBe('');
		}
	});
});
