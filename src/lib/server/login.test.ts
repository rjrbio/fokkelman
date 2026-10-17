import { describe, expect, it, vi } from 'vitest';
import { createLoginLimiter, createMemoryAttemptStore } from './attempts';
import { attemptLogin, clientKeyFrom, sessionCookieOptions } from './login';
import { hashPassword, SESSION_TTL_S, verifySessionToken } from './session';

const SECRET = 'a-session-secret-that-is-long-enough-123';
const settings = { sessionSecret: SECRET, passwordHash: hashPassword('TheTest') };

const newLimiter = () => createLoginLimiter(createMemoryAttemptStore());
const login = (password: string, limiter = newLimiter(), clientKey = 'ip') =>
	attemptLogin({ password, clientKey, settings, limiter });

describe('attemptLogin', () => {
	it('returns a valid session token for the right password', async () => {
		const result = await login('TheTest');
		expect(result.ok).toBe(true);
		if (result.ok) expect(verifySessionToken(result.token, SECRET)).toBe(true);
	});

	it('ignores spaces and newlines around the password (phone keyboards add them)', async () => {
		expect((await login('  TheTest \n')).ok).toBe(true);
	});

	it('rejects a wrong or empty password', async () => {
		expect(await login('nope')).toEqual({ ok: false, reason: 'incorrect' });
		expect(await login('')).toEqual({ ok: false, reason: 'incorrect' });
	});

	it('locks out after 5 failures even for the right password', async () => {
		const limiter = newLimiter();
		for (let i = 0; i < 5; i++) await login('nope', limiter);
		const result = await login('TheTest', limiter);
		expect(result).toMatchObject({ ok: false, reason: 'locked' });
		if (!result.ok && result.reason === 'locked') expect(result.retryAfterS).toBeGreaterThan(0);
	});

	it('a successful sign-in resets the failure counter', async () => {
		const limiter = newLimiter();
		for (let i = 0; i < 4; i++) await login('nope', limiter);
		expect((await login('TheTest', limiter)).ok).toBe(true);
		for (let i = 0; i < 4; i++) await login('nope', limiter);
		expect((await login('TheTest', limiter)).ok).toBe(true);
	});

	it('does not touch the limiter when the configuration is broken', async () => {
		const limiter = { check: vi.fn(), recordFailure: vi.fn(), reset: vi.fn() };
		const result = await attemptLogin({
			password: 'TheTest',
			clientKey: 'ip',
			settings: { sessionSecret: '', passwordHash: settings.passwordHash },
			limiter
		});
		expect(result).toEqual({ ok: false, reason: 'misconfigured' });
		expect(limiter.check).not.toHaveBeenCalled();
	});
});

describe('clientKeyFrom', () => {
	it('uses the client address when available', () => {
		expect(clientKeyFrom(() => '203.0.113.7')).toBe('203.0.113.7');
	});

	it('falls back to a shared key when the address cannot be determined', () => {
		expect(
			clientKeyFrom(() => {
				throw new Error('Could not determine clientAddress');
			})
		).toBe('unknown');
		expect(clientKeyFrom(() => '')).toBe('unknown');
	});
});

describe('sessionCookieOptions', () => {
	it('marks the cookie secure only over https', () => {
		expect(sessionCookieOptions(true)).toMatchObject({ secure: true, httpOnly: true, sameSite: 'lax' });
		expect(sessionCookieOptions(false).secure).toBe(false);
	});

	it('lasts as long as the session', () => {
		expect(sessionCookieOptions(true).maxAge).toBe(SESSION_TTL_S);
	});
});
