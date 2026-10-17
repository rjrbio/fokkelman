import { describe, expect, it } from 'vitest';
import { isSensitivePath, securityHeaders } from './securityHeaders';

describe('isSensitivePath', () => {
	it('covers the gallery, the API and the sign-in routes', () => {
		for (const path of ['/app', '/app/photo/x', '/api/favorite', '/login', '/logout']) {
			expect(isSensitivePath(path)).toBe(true);
		}
	});

	it('leaves the public zone alone and does not match look-alike prefixes', () => {
		for (const path of ['/', '/demo', '/apple', '/application', '/loginx']) {
			expect(isSensitivePath(path)).toBe(false);
		}
	});
});

describe('securityHeaders', () => {
	it('always forbids framing and limits the referrer and browser features', () => {
		const headers = securityHeaders('/demo');
		expect(headers['X-Frame-Options']).toBe('DENY');
		expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
		expect(headers['Permissions-Policy']).toContain('camera=()');
		expect(headers['X-Robots-Tag']).toBeUndefined();
		expect(headers['Cache-Control']).toBeUndefined();
	});

	it('keeps sensitive pages out of search engines and shared caches', () => {
		const headers = securityHeaders('/app/photo/x');
		expect(headers['X-Robots-Tag']).toBe('noindex, nofollow');
		expect(headers['Cache-Control']).toBe('private, no-store');
	});
});
