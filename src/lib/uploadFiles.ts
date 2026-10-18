export const fileKey = (file: { name: string; size: number }): string => `${file.name}:${file.size}`;

export interface SelectionSplit<T> {
	accepted: T[];
	duplicates: T[];
	rejected: T[];
}

/** Splits a file selection into new images, duplicates (of the queue or of each other) and non-images. */
export function splitSelection<T extends { name: string; size: number; type: string }>(
	files: T[],
	queuedKeys: Set<string>
): SelectionSplit<T> {
	const seen = new Set(queuedKeys);
	const result: SelectionSplit<T> = { accepted: [], duplicates: [], rejected: [] };
	for (const file of files) {
		if (!file.type.startsWith('image/')) {
			result.rejected.push(file);
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
