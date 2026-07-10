import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'fokkelman_session';
export const SESSION_TTL_S = 60 * 60 * 24 * 30;

function sign(payload: string, secret: string): string {
	return createHmac('sha256', secret).update(payload).digest('hex');
}

export function createSessionToken(secret: string, now: number = Date.now()): string {
	const exp = Math.floor(now / 1000) + SESSION_TTL_S;
	return `${exp}.${sign(String(exp), secret)}`;
}

export function verifySessionToken(
	token: string | undefined,
	secret: string,
	now: number = Date.now()
): boolean {
	if (!token) return false;
	const [expStr, sig] = token.split('.');
	if (!expStr || !sig) return false;
	const expected = Buffer.from(sign(expStr, secret));
	const actual = Buffer.from(sig);
	if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;
	return Number(expStr) > Math.floor(now / 1000);
}

export function hashPassword(
	password: string,
	saltHex: string = randomBytes(16).toString('hex')
): string {
	const key = scryptSync(password.normalize(), saltHex, 32).toString('hex');
	return `${saltHex}:${key}`;
}

export function verifyPassword(password: string, stored: string): boolean {
	const [saltHex, keyHex] = stored.split(':');
	if (!saltHex || !keyHex) return false;
	const expected = Buffer.from(keyHex, 'hex');
	if (expected.length !== 32) return false;
	const actual = scryptSync(password.normalize(), saltHex, 32);
	return timingSafeEqual(actual, expected);
}
