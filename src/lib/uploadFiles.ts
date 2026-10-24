/** The folder photos go to when no other collection is chosen. (The server keeps its own copy: see `photos.test.ts`.) */
export const DEFAULT_UPLOAD_FOLDER = 'family_uploads';

/** Cloudinary's free plan takes images of up to 10 MB: a bigger one would only fail after being sent. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** How many photos go up at the same time: enough to use the connection, few enough not to starve each one. */
export const UPLOAD_CONCURRENCY = 2;

export const fileKey = (file: { name: string; size: number }): string => `${file.name}:${file.size}`;

export interface SelectionSplit<T> {
	accepted: T[];
	duplicates: T[];
	/** Not an image. */
	rejected: T[];
	/** An image, but bigger than `MAX_UPLOAD_BYTES`. */
	tooBig: T[];
}

/** Splits a file selection into new images, duplicates (of the queue or of each other), non-images and images that are too big. */
export function splitSelection<T extends { name: string; size: number; type: string }>(
	files: T[],
	queuedKeys: Set<string>
): SelectionSplit<T> {
	const seen = new Set(queuedKeys);
	const result: SelectionSplit<T> = { accepted: [], duplicates: [], rejected: [], tooBig: [] };
	for (const file of files) {
		if (!file.type.startsWith('image/')) {
			result.rejected.push(file);
			continue;
		}
		if (file.size > MAX_UPLOAD_BYTES) {
			result.tooBig.push(file);
			continue;
		}
		const key = fileKey(file);
		if (seen.has(key)) {
			result.duplicates.push(file);
			continue;
		}
		seen.add(key);
		result.accepted.push(file);
	}
	return result;
}

/**
 * Runs `worker` on every item, at most `limit` at a time, starting them in order. The worker is expected to
 * deal with its own failures: one that throws stops its lane.
 */
export async function runWithLimit<T>(
	items: T[],
	limit: number,
	worker: (item: T) => Promise<void>
): Promise<void> {
	let next = 0;
	const lane = async () => {
		while (next < items.length) await worker(items[next++]);
	};
	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane));
}
