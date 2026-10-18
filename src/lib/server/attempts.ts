export interface AttemptRecord {
	count: number;
	firstAt: number;
}

/** Where failed-login counters live. Swap the in-memory store for a persistent one (e.g. Netlify Blobs) without touching callers. */
export interface AttemptStore {
	get(key: string): Promise<AttemptRecord | null>;
	set(key: string, record: AttemptRecord): Promise<void>;
	delete(key: string): Promise<void>;
}

export function createMemoryAttemptStore(): AttemptStore {
	const records = new Map<string, AttemptRecord>();
	return {
		async get(key) {
			return records.get(key) ?? null;
		},
		async set(key, record) {
			records.set(key, record);
		},
		async delete(key) {
			records.delete(key);
		}
	};
}

export interface LimiterOptions {
	maxFailures?: number;
	windowMs?: number;
	now?: () => number;
}

export interface LoginLimiter {
	check(key: string): Promise<{ allowed: boolean; retryAfterS: number }>;
	recordFailure(key: string): Promise<void>;
	reset(key: string): Promise<void>;
}

export function createLoginLimiter(store: AttemptStore, options: LimiterOptions = {}): LoginLimiter {
	const maxFailures = options.maxFailures ?? 5;
	const windowMs = options.windowMs ?? 15 * 60_000;
	const now = options.now ?? Date.now;

	return {
		async check(key) {
			const record = await store.get(key);
			if (!record) return { allowed: true, retryAfterS: 0 };
			const elapsed = now() - record.firstAt;
			if (elapsed >= windowMs) {
				await store.delete(key);
				return { allowed: true, retryAfterS: 0 };
			}
			if (record.count < maxFailures) return { allowed: true, retryAfterS: 0 };
			return { allowed: false, retryAfterS: Math.ceil((windowMs - elapsed) / 1000) };
		},
		async recordFailure(key) {
			const record = await store.get(key);
			const t = now();
			if (!record || t - record.firstAt >= windowMs) {
				await store.set(key, { count: 1, firstAt: t });
				return;
			}
			await store.set(key, { count: record.count + 1, firstAt: record.firstAt });
		},
		async reset(key) {
			await store.delete(key);
		}
	};
}
