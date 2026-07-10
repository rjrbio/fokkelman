import { error, redirect, type Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { isPrivatePath } from '$lib/server/guard';
import { SESSION_COOKIE, verifySessionToken } from '$lib/server/session';

export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get(SESSION_COOKIE);
	event.locals.authed = verifySessionToken(token, env.SESSION_SECRET ?? '');

	if (!event.locals.authed && isPrivatePath(event.url.pathname)) {
		if (event.url.pathname.startsWith('/api/')) error(401, 'Unauthorized');
		redirect(303, `/login?next=${encodeURIComponent(event.url.pathname + event.url.search)}`);
	}
	return resolve(event);
};
