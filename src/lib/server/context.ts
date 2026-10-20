import { cleanText, fold, MIN_YEAR, noAnnotation, type Annotation } from '$lib/annotations';

/** The context keys this app owns. Anything else on a photo is somebody else's and is left alone. */
export const MANAGED_KEYS = ['caption', 'year', 'people'] as const;

export interface ParsedContext {
	annotation: Annotation;
	/** The keys that are not ours, as they were. */
	extra: Record<string, string>;
}

/**
 * Cloudinary's answer for a photo's context is either the keys themselves or `{ custom: { …keys } }`
 * depending on where it comes from; both are read the same way.
 */
function keysOf(raw: unknown): Record<string, unknown> {
	if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
	const custom = (raw as { custom?: unknown }).custom;
	return typeof custom === 'object' && custom !== null && !Array.isArray(custom)
		? (custom as Record<string, unknown>)
		: (raw as Record<string, unknown>);
}

const asText = (value: unknown): string =>
	typeof value === 'string' ? value : typeof value === 'number' || typeof value === 'boolean' ? String(value) : '';

export function parsePeople(text: string): string[] {
	const seen = new Set<string>();
	const people: string[] = [];
	for (const piece of text.split(',')) {
		const name = cleanText(piece);
		if (!name || seen.has(fold(name))) continue;
		seen.add(fold(name));
		people.push(name);
	}
	return people;
}

/**
 * Reads the context of a photo as the family's annotation. It never throws: the context can be edited
 * by hand in Cloudinary, so a missing key, an empty one or a year like "circa 1975" is just "not set".
 */
export function parseContext(raw: unknown, currentYear: number = new Date().getFullYear()): ParsedContext {
	const annotation = noAnnotation();
	const extra: Record<string, string> = {};
	for (const [key, value] of Object.entries(keysOf(raw))) {
		const text = asText(value);
		if (key === 'caption') annotation.caption = cleanText(text);
		else if (key === 'year') {
			const year = /^\d{4}$/.test(text.trim()) ? Number(text.trim()) : Number.NaN;
			if (year >= MIN_YEAR && year <= currentYear) annotation.year = year;
			// "circa 1975" is not a year we can show, but somebody wrote it: it travels with the extras.
			else if (text.trim() !== '') extra.year = text;
		} else if (key === 'people') annotation.people = parsePeople(text);
		else if (text !== '') extra[key] = text;
	}
	return { annotation, extra };
}

/** `|` and `=` are the separators of the context string; inside a value they need a backslash. */
export const escapeContextText = (text: string): string => text.replace(/[|=]/g, (char) => `\\${char}`);

/** `key=value|key=value`, keys in alphabetical order so that equal contexts give equal strings. */
export function serializeContext(entries: Record<string, string>): string {
	return Object.keys(entries)
		.sort()
		.map((key) => `${escapeContextText(key)}=${escapeContextText(entries[key])}`)
		.join('|');
}

/** The keys a photo should have: ours only when they have something in them, plus the ones that are not ours. */
export function contextEntries(annotation: Annotation, extra: Record<string, string> = {}): Record<string, string> {
	const entries: Record<string, string> = { ...extra };
	if (annotation.caption) entries.caption = annotation.caption;
	if (annotation.year !== null) entries.year = String(annotation.year);
	if (annotation.people.length > 0) entries.people = annotation.people.join(', ');
	return entries;
}
