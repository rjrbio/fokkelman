import { fail, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import {
	createSessionToken,
	SESSION_COOKIE,
	SESSION_TTL_S,
	verifyPassword
} from '$lib/server/session';
import type { Actions, PageServerLoad } from './$types';

const failedAttempts = new Map<string, number>();

export const load: PageServerLoad = ({ locals }) => {
	if (locals.authed) redirect(303, '/app');
};

export const actions: Actions = {
	default: async ({ request, cookies, getClientAddress, url }) => {
		const form = await request.formData();
		const password = String(form.get('password') ?? '');
		const ip = getClientAddress();

		const failed = failedAttempts.get(ip) ?? 0;
		if (failed > 0) await new Promise((r) => setTimeout(r, Math.min(failed, 6) * 500));

		if (!verifyPassword(password, env.FAMILY_PASSWORD_HASH ?? '')) {
			failedAttempts.set(ip, failed + 1);
			return fail(400, { incorrect: true });
		}

		failedAttempts.delete(ip);
		cookies.set(SESSION_COOKIE, createSessionToken(env.SESSION_SECRET ?? ''), {
			path: '/',
			httpOnly: true,
			secure: true,
			sameSite: 'lax',
			maxAge: SESSION_TTL_S
		});

		const next = url.searchParams.get('next');
		redirect(303, next && next.startsWith('/') ? next : '/app');
	}
};
