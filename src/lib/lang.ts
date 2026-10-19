export type Lang = 'es' | 'en';

/** The family area is in Spanish; the public landing and demo are in English. */
const SPANISH_PREFIXES = ['/app', '/login'];

/** Language of a page, from its (decoded) path. */
export function langForPath(pathname: string): Lang {
	const spanish = SPANISH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
	return spanish ? 'es' : 'en';
}
