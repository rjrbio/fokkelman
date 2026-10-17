import { fail, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { createLoginLimiter, createMemoryAttemptStore } from '$lib/server/attempts';
import { getAuthConfigProblem, readAuthSettings } from '$lib/server/authConfig';
import { resolveSafeNext } from '$lib/server/guard';
import { attemptLogin, clientKeyFrom, sessionCookieOptions } from '$lib/server/login';
import { SESSION_COOKIE } from '$lib/server/session';
import type { Actions, PageServerLoad } from './$types';

// In memory per server instance. Swap the store for a persistent one (e.g. Netlify Blobs)
// to make the limit hold across serverless instances.
const limiter = createLoginLimiter(createMemoryAttemptStore());

export const load: PageServerLoad = ({ locals }) => {
	if (locals.authed) redirect(303, '/app');
	return { misconfigured: getAuthConfigProblem(readAuthSettings(env)) !== null };
};

export const actions: Actions = {
	default: async ({ request, cookies, getClientAddress, url, setHeaders }) => {
		const form = await request.formData();
		const result = await attemptLogin({
			password: String(form.get('password') ?? ''),
			clientKey: clientKeyFrom(getClientAddress),
			settings: readAuthSettings(env),
			limiter
		});

		if (!result.ok) {
			if (result.reason === 'misconfigured') {
				console.error('[auth] sign-in attempted while the auth configuration is invalid');
				return fail(503, { misconfigured: true });
			}
			if (result.reason === 'locked') {
				setHeaders({ 'Retry-After': String(result.retryAfterS) });
				return fail(429, { locked: true, retryAfterMin: Math.max(1, Math.ceil(result.retryAfterS / 60)) });
			}
			return fail(400, { incorrect: true });
		}

		cookies.set(SESSION_COOKIE, result.token, sessionCookieOptions(url.protocol === 'https:'));
		redirect(303, resolveSafeNext(url.searchParams.get('next'), url.origin));
	}
};
