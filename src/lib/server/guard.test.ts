import { describe, expect, it } from 'vitest';
import { decodePathname, isPrivatePath, resolveSafeNext } from './guard';

describe('isPrivatePath', () => {
	it('protects the app and the api', () => {
		expect(isPrivatePath('/app')).toBe(true);
		expect(isPrivatePath('/app/photo/family_uploads/x')).toBe(true);
		expect(isPrivatePath('/api/favorite')).toBe(true);
	});

	it('leaves public routes open', () => {
		expect(isPrivatePath('/')).toBe(false);
		expect(isPrivatePath('/demo')).toBe(false);
		expect(isPrivatePath('/login')).toBe(false);
		expect(isPrivatePath('/apple')).toBe(false);
	});
});

describe('decodePathname', () => {
	it('decodes unreserved percent-escapes the way SvelteKit does before routing', () => {
		expect(decodePathname('/%61pp')).toBe('/app');
		expect(decodePathname('/%61pi/favorite')).toBe('/api/favorite');
		expect(decodePathname('/%61pp/photo/x')).toBe('/app/photo/x');
	});

	it('leaves an escaped percent sign alone, so a double-encoded path does not decode twice', () => {
		expect(decodePathname('/%2561pp')).toBe('/%2561pp');
	});

	it('leaves reserved escapes such as %2F alone, like decodeURI', () => {
		expect(decodePathname('/app%2Fphoto')).toBe('/app%2Fphoto');
	});

	it('returns plain paths unchanged', () => {
		for (const path of ['/', '/app', '/app/photo/family_uploads/x', '/login']) {
			expect(decodePathname(path)).toBe(path);
		}
	});

	it('returns null for a malformed escape sequence', () => {
		expect(decodePathname('/%E0%A4%A')).toBeNull();
	});
});

describe('resolveSafeNext', () => {
	const origin = 'https://example.com';

	it('allows a legitimate same-origin path', () => {
		expect(resolveSafeNext('/app/photo/x', origin)).toBe('/app/photo/x');
	});

	it('preserves the query string on a legitimate path', () => {
		expect(resolveSafeNext('/app?tab=favorites', origin)).toBe('/app?tab=favorites');
	});

	it('falls back to /app when there is no next param', () => {
		expect(resolveSafeNext(null, origin)).toBe('/app');
	});

	it('rejects a protocol-relative URL (round 1 bypass)', () => {
		expect(resolveSafeNext('//evil.com', origin)).toBe('/app');
	});

	it('rejects a backslash-normalized off-site URL (round 2 bypass)', () => {
		// In a JS/TS string literal, '/\\evil.com' is the two-character-prefixed
		// string "/\evil.com" — browsers/URL parsers normalize backslashes to
		// forward slashes, which a naive prefix check misses.
		expect(resolveSafeNext('/\\evil.com', origin)).toBe('/app');
	});

	it('rejects a dot-segment-normalized leading-// pathname (round 3 bypass)', () => {
		// `/.//evil.com` resolves to a URL whose pathname is `//evil.com`, which
		// passes an origin check (still same-origin) but is itself dangerous
		// once handed verbatim to redirect()'s Location header.
		expect(resolveSafeNext('/.//evil.com', origin)).toBe('/app');
	});

	it('rejects a userinfo trick pointing at a different origin', () => {
		expect(resolveSafeNext('https://trusted.com@evil.com', origin)).toBe('/app');
	});

	it('never throws and never produces an off-site target for garbage input', () => {
		let result = '';
		expect(() => {
			result = resolveSafeNext('not a valid url at all §§§', origin);
		}).not.toThrow();
		expect(result.startsWith('//')).toBe(false);
	});
});
