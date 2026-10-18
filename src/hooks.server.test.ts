import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSessionToken, hashPassword, SESSION_COOKIE } from '$lib/server/session';

const mockEnv = vi.hoisted(() => ({ env: {} as Record<string, string | undefined> }));
vi.mock('$env/dynamic/private', () => mockEnv);

import { handle } from './hooks.server';

const SECRET = 'a-session-secret-that-is-long-enough-123';
const HASH = hashPassword('whatever');

function setEnv(values: Record<string, string | undefined>) {
	for (const key of Object.keys(mockEnv.env)) delete mockEnv.env[key];
	Object.assign(mockEnv.env, values);
}

function run(path: string, token?: string) {
	const event = {
		url: new URL(`https://app.test${path}`),
		cookies: { get: (name: string) => (name === SESSION_COOKIE ? token : undefined) },
		locals: {} as App.Locals
	};
	const resolve = vi.fn(async () => new Response('ok'));
	return { event, resolve, result: handle({ event, resolve } as never) };
}

beforeEach(() => {
	setEnv({ SESSION_SECRET: SECRET, FAMILY_PASSWORD_HASH: HASH });
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('handle: authentication', () => {
	it('lets a valid session through to a private page', async () => {
		const { event, resolve, result } = run('/app', createSessionToken(SECRET));
		await result;
		expect(event.locals.authed).toBe(true);
		expect(resolve).toHaveBeenCalled();
	});

	it('redirects an anonymous visitor from a private page to the login, keeping the query', async () => {
		await expect(run('/app?fav=1').result).rejects.toMatchObject({
			status: 303,
			location: '/login?next=%2Fapp%3Ffav%3D1'
		});
	});

	it('answers 401 to an anonymous API call', async () => {
		await expect(run('/api/favorite').result).rejects.toMatchObject({ status: 401 });
	});

	it('leaves public pages open', async () => {
		const { event, result } = run('/demo');
		await result;
		expect(event.locals.authed).toBe(false);
	});
});

describe('handle: fails closed on a broken configuration', () => {
	it('rejects a token forged with an empty secret when SESSION_SECRET is missing', async () => {
		setEnv({ FAMILY_PASSWORD_HASH: HASH });
		const exp = Math.floor(Date.now() / 1000) + 3600;
		const forged = `${exp}.${createHmac('sha256', '').update(String(exp)).digest('hex')}`;
		await expect(run('/app', forged).result).rejects.toMatchObject({ status: 303 });
	});

	it('rejects a correctly signed token when the secret is shorter than 32 characters', async () => {
		const short = 'short-secret';
		setEnv({ SESSION_SECRET: short, FAMILY_PASSWORD_HASH: HASH });
		await expect(run('/app', createSessionToken(short)).result).rejects.toMatchObject({
			status: 303
		});
	});

	it('rejects a valid session while the password hash is malformed', async () => {
		setEnv({ SESSION_SECRET: SECRET, FAMILY_PASSWORD_HASH: 'garbage' });
		await expect(run('/app', createSessionToken(SECRET)).result).rejects.toMatchObject({
			status: 303
		});
	});

	it('tolerates stray whitespace around the variables', async () => {
		setEnv({ SESSION_SECRET: `${SECRET}\n`, FAMILY_PASSWORD_HASH: `  ${HASH} ` });
		const { event, result } = run('/app', createSessionToken(SECRET));
		await result;
		expect(event.locals.authed).toBe(true);
	});
});

describe('handle: security headers', () => {
	it('adds the baseline headers to public pages', async () => {
		const response = await run('/demo').result;
		expect(response.headers.get('X-Frame-Options')).toBe('DENY');
		expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
		expect(response.headers.get('X-Robots-Tag')).toBeNull();
	});

	it('marks private pages non-indexable and non-cacheable', async () => {
		const response = await run('/app', createSessionToken(SECRET)).result;
		expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
		expect(response.headers.get('Cache-Control')).toBe('private, no-store');
	});
});

describe('handle: percent-encoded paths cannot dodge the guard', () => {
	it('redirects an anonymous visitor from /%61pp, which SvelteKit routes as /app', async () => {
		await expect(run('/%61pp').result).rejects.toMatchObject({
			status: 303,
			location: '/login?next=%2Fapp'
		});
	});

	it('redirects an anonymous visitor from a nested encoded private page, keeping the query', async () => {
		await expect(run('/%61pp/photo/x?fav=1').result).rejects.toMatchObject({
			status: 303,
			location: '/login?next=%2Fapp%2Fphoto%2Fx%3Ffav%3D1'
		});
	});

	it('answers 401 to an anonymous call to an encoded API path', async () => {
		await expect(run('/%61pi/favorite').result).rejects.toMatchObject({ status: 401 });
	});

	it('answers 400 to a malformed path, like SvelteKit does', async () => {
		await expect(run('/%E0%A4%A').result).rejects.toMatchObject({ status: 400 });
	});

	it('marks an encoded private page non-indexable and non-cacheable', async () => {
		const response = await run('/%61pp', createSessionToken(SECRET)).result;
		expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
		expect(response.headers.get('Cache-Control')).toBe('private, no-store');
	});

	it('marks an encoded sign-in path non-indexable too', async () => {
		const response = await run('/%6Cogin').result;
		expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
	});
});
