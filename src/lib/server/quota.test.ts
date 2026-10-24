import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import {
	CloudinaryRateLimitError,
	LOW_QUOTA,
	noteQuota,
	readQuota,
	resetQuotaWarnings,
	WARN_EVERY_MS
} from './quota';

const answer = (status: number, headers: Record<string, string> = {}) => new Response('{}', { status, headers });
const withQuota = (remaining: number, extra: Record<string, string> = {}) => ({
	'X-FeatureRateLimit-Limit': '500',
	'X-FeatureRateLimit-Remaining': String(remaining),
	'X-FeatureRateLimit-Reset': 'Tue, 20 Oct 2026 21:00:00 GMT',
	...extra
});

let warn: MockInstance<typeof console.warn>;
beforeEach(() => {
	resetQuotaWarnings();
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => warn.mockRestore());

describe('readQuota', () => {
	it('reads the limit, what is left and when it starts over', () => {
		expect(readQuota(new Headers(withQuota(120)))).toEqual({
			limit: 500,
			remaining: 120,
			resetsAt: new Date('2026-10-20T21:00:00Z')
		});
	});

	it('says nothing when the answer does not say, or says nonsense', () => {
		expect(readQuota(new Headers())).toBeNull();
		expect(readQuota(new Headers({ 'X-FeatureRateLimit-Limit': 'x', 'X-FeatureRateLimit-Remaining': 'y' }))).toBeNull();
	});

	it('copes with a reset date it cannot read', () => {
		expect(readQuota(new Headers(withQuota(10, { 'X-FeatureRateLimit-Reset': 'soon' })))?.resetsAt).toBeNull();
	});
});

describe('noteQuota', () => {
	it('is silent while there is plenty left', () => {
		noteQuota(answer(200, withQuota(LOW_QUOTA + 1)), 'search');
		expect(warn).not.toHaveBeenCalled();
	});

	it('warns, with what is left and when it starts over, when it runs low', () => {
		noteQuota(answer(200, withQuota(LOW_QUOTA)), 'search');
		expect(warn).toHaveBeenCalledOnce();
		expect(warn.mock.calls[0][0]).toBe(
			'[cloudinary] search: 50 of 500 Admin API calls left this hour, it starts over at 2026-10-20T21:00:00.000Z'
		);
	});

	it('does not repeat the warning on every call, only once a minute', () => {
		noteQuota(answer(200, withQuota(10)), 'search', 1_000_000);
		noteQuota(answer(200, withQuota(9)), 'search', 1_000_000 + WARN_EVERY_MS - 1);
		expect(warn).toHaveBeenCalledOnce();
		noteQuota(answer(200, withQuota(8)), 'search', 1_000_000 + WARN_EVERY_MS);
		expect(warn).toHaveBeenCalledTimes(2);
	});

	it('is silent for an answer that says nothing about the budget', () => {
		noteQuota(answer(200), 'search');
		expect(warn).not.toHaveBeenCalled();
	});

	it.each([420, 429])('throws a clear error, with when it starts over, on a %i', (status) => {
		const attempt = () => noteQuota(answer(status, withQuota(0)), 'read the context');
		expect(attempt).toThrow(CloudinaryRateLimitError);
		try {
			attempt();
		} catch (error) {
			expect((error as CloudinaryRateLimitError).resetsAt).toEqual(new Date('2026-10-20T21:00:00Z'));
			expect((error as Error).message).toContain('read the context');
		}
	});

	it('throws even when the answer does not say when', () => {
		expect(() => noteQuota(answer(429), 'search')).toThrow(CloudinaryRateLimitError);
	});

	it('leaves any other failure to the caller', () => {
		expect(() => noteQuota(answer(500), 'search')).not.toThrow();
	});
});
