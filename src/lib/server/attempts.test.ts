import { describe, expect, it } from 'vitest';
import { createLoginLimiter, createMemoryAttemptStore } from './attempts';

const WINDOW = 15 * 60_000;

function setup() {
	let now = 1_000_000;
	const limiter = createLoginLimiter(createMemoryAttemptStore(), { now: () => now });
	return { limiter, advance: (ms: number) => (now += ms) };
}

async function fail(limiter: ReturnType<typeof setup>['limiter'], key: string, times: number) {
	for (let i = 0; i < times; i++) await limiter.recordFailure(key);
}

describe('createLoginLimiter', () => {
	it('allows attempts until the 5th failure and then blocks', async () => {
		const { limiter } = setup();
		await fail(limiter, 'ip', 4);
		expect((await limiter.check('ip')).allowed).toBe(true);
		await limiter.recordFailure('ip');
		const status = await limiter.check('ip');
		expect(status.allowed).toBe(false);
		expect(status.retryAfterS).toBe(WINDOW / 1000);
	});

	it('reports the remaining wait, which shrinks as time passes', async () => {
		const { limiter, advance } = setup();
		await fail(limiter, 'ip', 5);
		advance(5 * 60_000);
		expect((await limiter.check('ip')).retryAfterS).toBe(10 * 60);
	});

	it('forgets the failures once the window has elapsed', async () => {
		const { limiter, advance } = setup();
		await fail(limiter, 'ip', 5);
		advance(WINDOW);
		expect((await limiter.check('ip')).allowed).toBe(true);
		await limiter.recordFailure('ip');
		advance(1000);
		expect((await limiter.check('ip')).allowed).toBe(true); // counter restarted at 1
	});

	it('reset() clears the counter', async () => {
		const { limiter } = setup();
		await fail(limiter, 'ip', 5);
		await limiter.reset('ip');
		expect((await limiter.check('ip')).allowed).toBe(true);
	});

	it('tracks each key independently', async () => {
		const { limiter } = setup();
		await fail(limiter, 'a', 5);
		expect((await limiter.check('a')).allowed).toBe(false);
		expect((await limiter.check('b')).allowed).toBe(true);
	});
});
