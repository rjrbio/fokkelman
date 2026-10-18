export const MIN_SESSION_SECRET_LENGTH = 32;

export interface AuthSettings {
	sessionSecret: string;
	passwordHash: string;
}

export type AuthConfigProblem =
	| 'missing-session-secret'
	| 'weak-session-secret'
	| 'missing-password-hash'
	| 'malformed-password-hash';

// salt (16 bytes) : scrypt key (32 bytes), both hex — see hashPassword() in session.ts
const PASSWORD_HASH_PATTERN = /^[0-9a-f]{32}:[0-9a-f]{64}$/i;

/** Reads the auth variables, trimming the stray whitespace/newlines that creep in when pasting. */
export function readAuthSettings(env: {
	SESSION_SECRET?: string;
	FAMILY_PASSWORD_HASH?: string;
	// lets the whole `$env/dynamic/private` object be passed (otherwise TS rejects it as a "weak type")
	[key: string]: string | undefined;
}): AuthSettings {
	return {
		sessionSecret: (env.SESSION_SECRET ?? '').trim(),
		passwordHash: (env.FAMILY_PASSWORD_HASH ?? '').trim()
	};
}

/** Why sign-in cannot work safely, or null when the configuration is usable. */
export function getAuthConfigProblem(settings: AuthSettings): AuthConfigProblem | null {
	if (settings.sessionSecret === '') return 'missing-session-secret';
	if (settings.sessionSecret.length < MIN_SESSION_SECRET_LENGTH) return 'weak-session-secret';
	if (settings.passwordHash === '') return 'missing-password-hash';
	if (!PASSWORD_HASH_PATTERN.test(settings.passwordHash)) return 'malformed-password-hash';
	return null;
}
