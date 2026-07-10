import { describe, expect, it } from 'vitest';
import {
	createSessionToken,
	hashPassword,
	SESSION_TTL_S,
	verifyPassword,
	verifySessionToken
} from './session';

const SECRET = 'unit-test-secret';

describe('session tokens', () => {
	it('accepts a freshly created token', () => {
		const token = createSessionToken(SECRET);
		expect(verifySessionToken(token, SECRET)).toBe(true);
	});

	it('rejects a tampered token', () => {
		const token = createSessionToken(SECRET);
		const [exp] = token.split('.');
		const forged = `${Number(exp) + 9999}.${token.split('.')[1]}`;
		expect(verifySessionToken(forged, SECRET)).toBe(false);
	});

	it('rejects a token signed with another secret', () => {
		const token = createSessionToken('other-secret');
		expect(verifySessionToken(token, SECRET)).toBe(false);
	});

	it('rejects an expired token', () => {
		const past = Date.now() - (SESSION_TTL_S + 60) * 1000;
		const token = createSessionToken(SECRET, past);
		expect(verifySessionToken(token, SECRET)).toBe(false);
	});

	it('rejects undefined and malformed tokens', () => {
		expect(verifySessionToken(undefined, SECRET)).toBe(false);
		expect(verifySessionToken('garbage', SECRET)).toBe(false);
		expect(verifySessionToken('123.', SECRET)).toBe(false);
	});
});

describe('password hashing', () => {
	it('verifies the correct password against its hash', () => {
		const stored = hashPassword('correct horse');
		expect(verifyPassword('correct horse', stored)).toBe(true);
	});

	it('rejects a wrong password', () => {
		const stored = hashPassword('correct horse');
		expect(verifyPassword('wrong pony', stored)).toBe(false);
	});

	it('rejects a malformed stored hash without throwing', () => {
		expect(verifyPassword('anything', 'not-a-valid-hash')).toBe(false);
		expect(verifyPassword('anything', '')).toBe(false);
	});
});
