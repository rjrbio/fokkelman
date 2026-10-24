/**
 * Cloudinary's Admin and Search APIs share a budget of calls per hour (500 on the free plan). Every answer says
 * how much is left in `X-FeatureRateLimit-*` headers, and once it is spent they answer "too many requests".
 * This turns that into something the app can act on: a warning in the log while there is still some left, and a
 * clear error, instead of a mystery, when there is none.
 */

export interface Quota {
	limit: number;
	remaining: number;
	/** When the budget starts over, if the answer said. */
	resetsAt: Date | null;
}

/** What the headers of an answer say about the budget, or `null` when they say nothing. */
export function readQuota(headers: Headers): Quota | null {
	const limit = Number(headers.get('x-featureratelimit-limit'));
	const remaining = Number(headers.get('x-featureratelimit-remaining'));
	if (!headers.has('x-featureratelimit-remaining') || !Number.isFinite(limit) || !Number.isFinite(remaining)) return null;
	const reset = new Date(headers.get('x-featureratelimit-reset') ?? '');
	return { limit, remaining, resetsAt: Number.isNaN(reset.getTime()) ? null : reset };
}

/** The Admin API's answer once the budget is spent is 420; some endpoints say 429. */
export const isRateLimited = (response: Pick<Response, 'status'>): boolean =>
	response.status === 420 || response.status === 429;

export class CloudinaryRateLimitError extends Error {
	readonly resetsAt: Date | null;

	constructor(what: string, resetsAt: Date | null) {
		super(`Cloudinary rate limit reached (${what})${resetsAt ? `, it starts over at ${resetsAt.toISOString()}` : ''}`);
		this.name = 'CloudinaryRateLimitError';
		this.resetsAt = resetsAt;
	}
}

/** Fewer calls than this left in the hour is worth a line in the log. */
export const LOW_QUOTA = 50;
/** The log is told once a minute, not on every one of the calls that follow. */
export const WARN_EVERY_MS = 60_000;
let lastWarning = -Infinity;

/** For the tests: forget when the last warning was. */
export const resetQuotaWarnings = (): void => {
	lastWarning = -Infinity;
};

/**
 * Looks at the answer of an Admin or Search API call. Throws `CloudinaryRateLimitError` when the budget is
 * spent; otherwise warns in the log (at most once a minute) when it is running low.
 */
export function noteQuota(response: Response, what: string, now: number = Date.now()): void {
	const quota = readQuota(response.headers);
	if (isRateLimited(response)) throw new CloudinaryRateLimitError(what, quota?.resetsAt ?? null);
	if (quota && quota.remaining <= LOW_QUOTA && now - lastWarning >= WARN_EVERY_MS) {
		lastWarning = now;
		const when = quota.resetsAt ? `, it starts over at ${quota.resetsAt.toISOString()}` : '';
		console.warn(`[cloudinary] ${what}: ${quota.remaining} of ${quota.limit} Admin API calls left this hour${when}`);
	}
}
