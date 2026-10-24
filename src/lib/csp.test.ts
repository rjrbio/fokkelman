import { afterEach, describe, expect, it, vi } from 'vitest';

// Pins the Content-Security-Policy declared in svelte.config.js. The dev relaxations must
// only apply to `vite dev`; any other NODE_ENV (production, staging, unset) gets the strict policy.

type Directives = Record<string, string[] | undefined>;

async function loadDirectives(nodeEnv: string | undefined): Promise<Directives> {
	vi.stubEnv('NODE_ENV', nodeEnv);
	vi.resetModules();
	const { default: config } = await import('../../svelte.config.js');
	return (config.kit?.csp?.directives ?? {}) as Directives;
}

afterEach(() => {
	vi.unstubAllEnvs();
	vi.resetModules();
});

// The CDN is there so that the page can read a photo to share it as a file (see `share.ts`).
const STRICT_CONNECT_SRC = ['self', 'https://api.cloudinary.com', 'https://res.cloudinary.com'];

describe.each([
	{ label: 'production', nodeEnv: 'production' as string | undefined, connectSrc: STRICT_CONNECT_SRC },
	{ label: 'staging (any other value)', nodeEnv: 'staging', connectSrc: STRICT_CONNECT_SRC },
	{ label: 'unset', nodeEnv: undefined, connectSrc: STRICT_CONNECT_SRC },
	{ label: 'development', nodeEnv: 'development', connectSrc: [...STRICT_CONNECT_SRC, 'ws:'] }
])('CSP with NODE_ENV $label', ({ nodeEnv, connectSrc }) => {
	it('never allows inline or eval scripts', async () => {
		const directives = await loadDirectives(nodeEnv);
		expect(directives['script-src']).toEqual(['self']);
	});

	it('limits connect-src to the app, the Cloudinary API and CDN and, only under vite dev, websockets', async () => {
		const directives = await loadDirectives(nodeEnv);
		expect(directives['connect-src']).toEqual(connectSrc);
	});

	it('allows the Cloudinary CDN for images and forbids framing and plugins', async () => {
		const directives = await loadDirectives(nodeEnv);
		expect(directives['img-src']).toEqual(
			expect.arrayContaining(['self', 'data:', 'https://res.cloudinary.com'])
		);
		expect(directives['frame-ancestors']).toEqual(['none']);
		expect(directives['object-src']).toEqual(['none']);
	});
});
