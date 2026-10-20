/**
 * What the family writes about a photo, and the rules for it. Shared by the browser (the editor,
 * the optimistic update) and the server (validation, what gets written to Cloudinary), so that both
 * compute exactly the same result from the same patch.
 */

export const MAX_CAPTION_LENGTH = 255;
export const MAX_PERSON_LENGTH = 40;
/** The people of a photo are stored as one `A, B, C` value, which has to stay within this. */
export const MAX_PEOPLE_LENGTH = 255;
export const MIN_YEAR = 1800;
export const MAX_PHOTOS_PER_REQUEST = 200;

export interface Annotation {
	/** `''` when there is none. */
	caption: string;
	year: number | null;
	people: string[];
}

export const noAnnotation = (): Annotation => ({ caption: '', year: null, people: [] });

export const annotationOf = ({ caption, year, people }: Annotation): Annotation => ({
	caption,
	year,
	people: [...people]
});

export function sameAnnotation(a: Annotation, b: Annotation): boolean {
	return (
		a.caption === b.caption &&
		a.year === b.year &&
		a.people.length === b.people.length &&
		a.people.every((name, i) => name === b.people[i])
	);
}

/** A change to one or more photos. A missing field is left alone; `''` / `null` clears it. */
export interface AnnotationPatch {
	caption?: string;
	year?: number | null;
	addPeople?: string[];
	removePeople?: string[];
}

export type PatchProblem =
	| 'bad-shape'
	| 'nothing-to-change'
	| 'caption-too-long'
	| 'has-backslash'
	| 'year-out-of-range'
	| 'person-too-long'
	| 'person-has-comma'
	| 'too-many-people';

/** One line, no control characters, no leading, trailing or repeated spaces. */
export function cleanText(text: string): string {
	return text.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Lower case without accents, for comparing and searching names and words. */
export function fold(text: string): string {
	return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

type Parsed<T> = { ok: true; value: T } | { ok: false; problem: PatchProblem };

/** `limitLength` is for names being added: one that is already there and too long can still be taken off. */
function parseNames(value: unknown, limitLength: boolean): Parsed<string[]> {
	if (!Array.isArray(value) || value.some((name) => typeof name !== 'string')) {
		return { ok: false, problem: 'bad-shape' };
	}
	const seen = new Set<string>();
	const names: string[] = [];
	for (const raw of value as string[]) {
		const name = cleanText(raw);
		if (!name) continue;
		if (limitLength && name.length > MAX_PERSON_LENGTH) return { ok: false, problem: 'person-too-long' };
		if (name.includes('\\')) return { ok: false, problem: 'has-backslash' };
		if (name.includes(',')) return { ok: false, problem: 'person-has-comma' };
		if (seen.has(fold(name))) continue;
		seen.add(fold(name));
		names.push(name);
	}
	return { ok: true, value: names };
}

/**
 * Checks and cleans what a client sent as a patch. The result is what `applyPatch` expects;
 * anything the editor lets through that is not valid ends up here as a named problem.
 */
export function parsePatch(
	input: unknown,
	currentYear: number = new Date().getFullYear()
): Parsed<AnnotationPatch> {
	if (!isRecord(input)) return { ok: false, problem: 'bad-shape' };
	const patch: AnnotationPatch = {};

	if (input.caption !== undefined) {
		if (input.caption !== null && typeof input.caption !== 'string') return { ok: false, problem: 'bad-shape' };
		const caption = cleanText(input.caption ?? '');
		if (caption.length > MAX_CAPTION_LENGTH) return { ok: false, problem: 'caption-too-long' };
		if (caption.includes('\\')) return { ok: false, problem: 'has-backslash' };
		patch.caption = caption;
	}

	if (input.year !== undefined) {
		if (input.year === null) patch.year = null;
		else if (typeof input.year !== 'number' || !Number.isInteger(input.year)) return { ok: false, problem: 'bad-shape' };
		else if (input.year < MIN_YEAR || input.year > currentYear) return { ok: false, problem: 'year-out-of-range' };
		else patch.year = input.year;
	}

	for (const field of ['addPeople', 'removePeople'] as const) {
		if (input[field] === undefined) continue;
		const names = parseNames(input[field], field === 'addPeople');
		if (!names.ok) return names;
		if (names.value.length > 0) patch[field] = names.value;
	}

	return Object.keys(patch).length === 0 ? { ok: false, problem: 'nothing-to-change' } : { ok: true, value: patch };
}

export const peopleToText = (people: string[]): string => people.join(', ');

/**
 * `current` with the patch applied. People are merged, not replaced: the ones to remove go first,
 * then the new ones are added at the end, skipping any that are already there (whatever the case or accents).
 */
export function applyPatch(
	current: Annotation,
	patch: AnnotationPatch
): { ok: true; annotation: Annotation } | { ok: false; problem: 'too-many-people' } {
	const removed = new Set((patch.removePeople ?? []).map(fold));
	const people = current.people.filter((name) => !removed.has(fold(name)));
	const present = new Set(people.map(fold));
	for (const name of patch.addPeople ?? []) {
		if (present.has(fold(name))) continue;
		present.add(fold(name));
		people.push(name);
	}
	if (peopleToText(people).length > MAX_PEOPLE_LENGTH) return { ok: false, problem: 'too-many-people' };

	return {
		ok: true,
		annotation: {
			caption: patch.caption ?? current.caption,
			year: patch.year === undefined ? current.year : patch.year,
			people
		}
	};
}

/** The photos with the given annotations laid over them (the same array when there is nothing to lay). */
export function applyAnnotationOverrides<T extends Annotation & { publicId: string }>(
	photos: T[],
	overrides: ReadonlyMap<string, Annotation>
): T[] {
	if (overrides.size === 0) return photos;
	return photos.map((photo) => {
		const override = overrides.get(photo.publicId);
		return override === undefined || sameAnnotation(override, photo) ? photo : { ...photo, ...override };
	});
}

/** Every name used in the library, the most used first, for suggestions. */
export function knownPeople(photos: Pick<Annotation, 'people'>[]): string[] {
	const counts = new Map<string, { name: string; count: number }>();
	for (const { people } of photos) {
		for (const name of people) {
			const entry = counts.get(fold(name));
			if (entry) entry.count++;
			else counts.set(fold(name), { name, count: 1 });
		}
	}
	return [...counts.values()]
		.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'es'))
		.map((entry) => entry.name);
}
