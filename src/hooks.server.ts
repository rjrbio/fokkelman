import { error, redirect, type Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { getAuthConfigProblem, readAuthSettings } from '$lib/server/authConfig';
import { isPrivatePath } from '$lib/server/guard';
import { securityHeaders } from '$lib/server/securityHeaders';
import { SESSION_COOKIE, verifySessionToken } from '$lib/server/session';

let loggedProblem: string | null = null;

export const handle: Handle = async ({ event, resolve }) => {
	const settings = readAuthSettings(env);
	const problem = getAuthConfigProblem(settings);
	if (problem && problem !== loggedProblem) {
		loggedProblem = problem;
		console.error(`[auth] sign-in disabled: ${problem}`);
	}

	// Fail closed: with a broken configuration no session is ever valid.
	event.locals.authed =
		!problem && verifySessionToken(event.cookies.get(SESSION_COOKIE), settings.sessionSecret);

	if (!event.locals.authed && isPrivatePath(event.url.pathname)) {
		if (event.url.pathname.startsWith('/api/')) error(401, 'Unauthorized');
		redirect(303, `/login?next=${encodeURIComponent(event.url.pathname + event.url.search)}`);
	}
	const response = await resolve(event);
	for (const [name, value] of Object.entries(securityHeaders(event.url.pathname))) {
		response.headers.set(name, value);
	}
	return response;
};
