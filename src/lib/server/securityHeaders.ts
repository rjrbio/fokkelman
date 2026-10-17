const SENSITIVE_PREFIXES = ['/app', '/api', '/login', '/logout'];

export function isSensitivePath(pathname: string): boolean {
	return SENSITIVE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function securityHeaders(pathname: string): Record<string, string> {
	const headers: Record<string, string> = {
		'X-Frame-Options': 'DENY',
		'Referrer-Policy': 'strict-origin-when-cross-origin',
		'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()'
	};
	if (isSensitivePath(pathname)) {
		headers['X-Robots-Tag'] = 'noindex, nofollow';
		headers['Cache-Control'] = 'private, no-store';
	}
	return headers;
}
