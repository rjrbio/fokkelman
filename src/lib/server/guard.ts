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
