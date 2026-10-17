import type { LoginLimiter } from './attempts';
import { getAuthConfigProblem, type AuthSettings } from './authConfig';
import { createSessionToken, SESSION_TTL_S, verifyPassword } from './session';

export type LoginResult =
	| { ok: true; token: string }
	| { ok: false; reason: 'misconfigured' }
	| { ok: false; reason: 'locked'; retryAfterS: number }
	| { ok: false; reason: 'incorrect' };

export interface LoginRequest {
	password: string;
	clientKey: string;
	settings: AuthSettings;
	limiter: LoginLimiter;
	now?: number;
}

export async function attemptLogin({
	password,
	clientKey,
	settings,
	limiter,
	now
}: LoginRequest): Promise<LoginResult> {
	if (getAuthConfigProblem(settings)) return { ok: false, reason: 'misconfigured' };

	const status = await limiter.check(clientKey);
	if (!status.allowed) return { ok: false, reason: 'locked', retryAfterS: status.retryAfterS };

	// Phone keyboards love to append a space; the family password has none.
	if (!verifyPassword(password.trim(), settings.passwordHash)) {
		await limiter.recordFailure(clientKey);
		return { ok: false, reason: 'incorrect' };
	}

	await limiter.reset(clientKey);
	return { ok: true, token: createSessionToken(settings.sessionSecret, now) };
}

/** Limiter key for a request; one shared bucket when the platform cannot tell the client address. */
export function clientKeyFrom(getClientAddress: () => string): string {
	try {
		return getClientAddress() || 'unknown';
	} catch {
		return 'unknown';
	}
}

export function sessionCookieOptions(isHttps: boolean) {
	return {
		path: '/',
		httpOnly: true,
		secure: isHttps,
		sameSite: 'lax' as const,
		maxAge: SESSION_TTL_S
	};
}
