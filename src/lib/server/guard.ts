import { error } from '@sveltejs/kit';

/**
 * The pathname SvelteKit routes on: `decodeURI` applied between the `%25`
 * separators, exactly as `respond.js` does. Matching the guard against the raw
 * `url.pathname` would let `/%61pp` reach the `/app` route unchecked.
 * Returns `null` for a malformed escape sequence.
 *
 * Must stay identical to SvelteKit's `decode_pathname` (kit/src/utils/url.js). It also
 * assumes the project has no `reroute` hook and no remote functions: either could set
 * `url.pathname` through the `x-sveltekit-pathname` header, so if one is ever adopted this
 * guard must be revisited.
 */
export function decodePathname(pathname: string): string | null {
	try {
		return pathname.split('%25').map(decodeURI).join('%25');
	} catch {
		return null;
	}
}

/** Defense in depth for API handlers: refuse before reading the body or touching Cloudinary. */
export function requireAuthed(locals: App.Locals): void {
	if (!locals.authed) error(401, 'Unauthorized');
}

export function isPrivatePath(pathname: string): boolean {
	return pathname === '/app' || pathname.startsWith('/app/') || pathname.startsWith('/api/');
}

/**
 * Resolves a post-login redirect target from an untrusted `next` query param,
 * guaranteeing the returned string is always same-origin and never a value
 * that a browser would interpret as a network-path reference (i.e. it never
 * starts with `//`, regardless of how it got there — dot-segment
 * normalization, backslash normalization, userinfo tricks, etc).
 */
export function resolveSafeNext(next: string | null, origin: string): string {
	if (!next) return '/app';
	let target: string;
	try {
		const resolved = new URL(next, origin);
		if (resolved.origin !== origin) return '/app';
		target = resolved.pathname + resolved.search + resolved.hash;
	} catch {
		return '/app';
	}
	return target.startsWith('//') ? '/app' : target;
}
