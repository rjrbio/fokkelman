import { describe, expect, it } from 'vitest';
import { getAuthConfigProblem, readAuthSettings } from './authConfig';
import { hashPassword } from './session';

const SECRET = 'a-session-secret-that-is-long-enough-123'; // 40 chars
const HASH = hashPassword('whatever');

describe('getAuthConfigProblem', () => {
	it('accepts a complete, well-formed configuration', () => {
		expect(getAuthConfigProblem({ sessionSecret: SECRET, passwordHash: HASH })).toBeNull();
	});

	it('flags a missing session secret', () => {
		expect(getAuthConfigProblem({ sessionSecret: '', passwordHash: HASH })).toBe(
			'missing-session-secret'
		);
	});

	it('flags a session secret shorter than 32 characters', () => {
		expect(getAuthConfigProblem({ sessionSecret: 'x'.repeat(31), passwordHash: HASH })).toBe(
			'weak-session-secret'
		);
		expect(getAuthConfigProblem({ sessionSecret: 'x'.repeat(32), passwordHash: HASH })).toBeNull();
	});

	it('flags a missing password hash', () => {
		expect(getAuthConfigProblem({ sessionSecret: SECRET, passwordHash: '' })).toBe(
			'missing-password-hash'
		);
	});

	it('flags a malformed password hash instead of silently rejecting every password', () => {
		for (const bad of ['not-a-valid-hash', 'abc:def', `${HASH}:extra`, HASH.replace(':', '')]) {
			expect(getAuthConfigProblem({ sessionSecret: SECRET, passwordHash: bad })).toBe(
				'malformed-password-hash'
			);
		}
	});
});

describe('readAuthSettings', () => {
	it('trims whitespace and newlines pasted around the values', () => {
		const settings = readAuthSettings({
			SESSION_SECRET: `  ${SECRET}\n`,
			FAMILY_PASSWORD_HASH: `${HASH}\r\n`
		});
		expect(settings).toEqual({ sessionSecret: SECRET, passwordHash: HASH });
		expect(getAuthConfigProblem(settings)).toBeNull();
	});

	it('treats undefined variables as empty', () => {
		expect(readAuthSettings({})).toEqual({ sessionSecret: '', passwordHash: '' });
	});
});
