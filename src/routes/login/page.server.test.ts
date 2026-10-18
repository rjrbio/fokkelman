import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hashPassword, SESSION_COOKIE, verifySessionToken } from '$lib/server/session';

const mockEnv = vi.hoisted(() => ({ env: {} as Record<string, string | undefined> }));
vi.mock('$env/dynamic/private', () => mockEnv);

import { actions, load } from './+page.server';

const SECRET = 'a-session-secret-that-is-long-enough-123';
const HASH = hashPassword('TheTest');

function setEnv(values: Record<string, string | undefined>) {
	for (const key of Object.keys(mockEnv.env)) delete mockEnv.env[key];
	Object.assign(mockEnv.env, values);
}

let n = 0;
/** Each test gets its own client address so the module-level limiter never leaks between tests. */
function makeEvent(password: string, options: { url?: string; address?: () => string } = {}) {
	const ip = `10.0.0.${++n}`;
	const body = new FormData();
	body.set('password', password);
	const cookies = { set: vi.fn() };
	const setHeaders = vi.fn();
	const event = {
		request: new Request('https://app.test/login', { method: 'POST', body }),
		cookies,
		getClientAddress: options.address ?? (() => ip),
		url: new URL(options.url ?? 'https://app.test/login'),
		setHeaders
	} as unknown as Parameters<typeof actions.default>[0];
	return { event, cookies, setHeaders };
}

beforeEach(() => {
	setEnv({ SESSION_SECRET: SECRET, FAMILY_PASSWORD_HASH: HASH });
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

/** SvelteKit's redirect() throws a plain object (not an Error); capture whatever is thrown. */
function thrown(fn: () => unknown): unknown {
	try {
		fn();
	} catch (value) {
		return value;
	}
	return undefined;
}

describe('login load', () => {
	it('sends an already signed-in visitor to the gallery', () => {
		expect(thrown(() => load({ locals: { authed: true } } as never))).toMatchObject({
			status: 303,
			location: '/app'
		});
	});

	it('reports a usable configuration', () => {
		expect(load({ locals: { authed: false } } as never)).toEqual({ misconfigured: false });
	});

	it('reports a broken configuration', () => {
		setEnv({ SESSION_SECRET: SECRET });
		expect(load({ locals: { authed: false } } as never)).toEqual({ misconfigured: true });
	});
});

describe('login action', () => {
	it('rejects a wrong password with 400', async () => {
		const { event, cookies } = makeEvent('nope');
		const result = await actions.default(event);
		expect(result).toMatchObject({ status: 400, data: { incorrect: true } });
		expect(cookies.set).not.toHaveBeenCalled();
	});

	it('sets a secure session cookie over https and redirects to the gallery', async () => {
		const { event, cookies } = makeEvent('TheTest');
		await expect(actions.default(event)).rejects.toMatchObject({ status: 303, location: '/app' });
		const [name, token, options] = cookies.set.mock.calls[0];
		expect(name).toBe(SESSION_COOKIE);
		expect(verifySessionToken(token, SECRET)).toBe(true);
		expect(options).toMatchObject({ secure: true, httpOnly: true });
	});

	it('does not mark the cookie secure over plain http (local Safari)', async () => {
		const { event, cookies } = makeEvent('TheTest', { url: 'http://localhost:5173/login' });
		await expect(actions.default(event)).rejects.toMatchObject({ status: 303 });
		expect(cookies.set.mock.calls[0][2]).toMatchObject({ secure: false });
	});

	it('honors a same-origin next target and ignores an off-site one', async () => {
		const ok = makeEvent('TheTest', { url: 'https://app.test/login?next=%2Fapp%2Fphoto%2Fx' });
		await expect(actions.default(ok.event)).rejects.toMatchObject({ location: '/app/photo/x' });
		const evil = makeEvent('TheTest', { url: 'https://app.test/login?next=%2F%2Fevil.com' });
		await expect(actions.default(evil.event)).rejects.toMatchObject({ location: '/app' });
	});

	it('answers 429 with Retry-After after five wrong passwords', async () => {
		const address = () => '198.51.100.9';
		for (let i = 0; i < 5; i++) await actions.default(makeEvent('nope', { address }).event);
		const { event, setHeaders, cookies } = makeEvent('TheTest', { address });
		const result = await actions.default(event);
		expect(result).toMatchObject({ status: 429, data: { locked: true } });
		expect(setHeaders).toHaveBeenCalledWith({ 'Retry-After': expect.stringMatching(/^\d+$/) });
		expect(cookies.set).not.toHaveBeenCalled();
	});

	it('does not crash when the client address is unavailable', async () => {
		const address = () => {
			throw new Error('Could not determine clientAddress');
		};
		const { event } = makeEvent('nope', { address });
		await expect(actions.default(event)).resolves.toMatchObject({ status: 400 });
	});

	it('answers 503 and logs when the server configuration is broken', async () => {
		setEnv({ FAMILY_PASSWORD_HASH: HASH });
		const { event } = makeEvent('TheTest');
		const result = await actions.default(event);
		expect(result).toMatchObject({ status: 503, data: { misconfigured: true } });
		expect(console.error).toHaveBeenCalled();
	});
});
