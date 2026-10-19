import { describe, expect, it } from 'vitest';
import { langForPath } from './lang';

describe('langForPath', () => {
	it('is Spanish in the family area and on the sign-in page', () => {
		for (const path of ['/app', '/app/photo/Sample_001', '/login']) {
			expect(langForPath(path)).toBe('es');
		}
	});

	it('is English on the public pages', () => {
		for (const path of ['/', '/demo', '/demo/x']) {
			expect(langForPath(path)).toBe('en');
		}
	});

	it('does not mistake a longer path for the family area', () => {
		expect(langForPath('/apple')).toBe('en');
		expect(langForPath('/login-help')).toBe('en');
	});
});
