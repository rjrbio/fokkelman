import { error, redirect, type Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { getAuthConfigProblem, readAuthSettings } from '$lib/server/authConfig';
import { langForPath } from '$lib/lang';
import { decodePathname, isPrivatePath } from '$lib/server/guard';
import { securityHeaders } from '$lib/server/securityHeaders';
import { SESSION_COOKIE, verifySessionToken } from '$lib/server/session';

let loggedProblem: string | null = null;

export const handle: Handle = async ({ event, resolve }) => {
	// Match on the path SvelteKit will route (decoded), never on the raw one: `/%61pp` is `/app`.
	const pathname = decodePathname(event.url.pathname);
	if (pathname === null) error(400, 'Malformed URI');

	const settings = readAuthSettings(env);
	const problem = getAuthConfigProblem(settings);
	if (problem && problem !== loggedProblem) {
		loggedProblem = problem;
		console.error(`[auth] sign-in disabled: ${problem}`);
	}

	// Fail closed: with a broken configuration no session is ever valid.
	event.locals.authed =
		!problem && verifySessionToken(event.cookies.get(SESSION_COOKIE), settings.sessionSecret);

	if (!event.locals.authed && isPrivatePath(pathname)) {
		if (pathname.startsWith('/api/')) error(401, 'Unauthorized');
		redirect(303, `/login?next=${encodeURIComponent(pathname + event.url.search)}`);
	}
	const lang = langForPath(pathname);
	const response = await resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%lang%', lang)
	});
	for (const [name, value] of Object.entries(securityHeaders(pathname))) {
		response.headers.set(name, value);
	}
	return response;
};
