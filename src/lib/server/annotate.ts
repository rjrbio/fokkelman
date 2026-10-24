import { applyPatch, sameAnnotation, type Annotation, type AnnotationPatch } from '$lib/annotations';
import type { Photo } from '$lib/types';
import { updateContext, type CloudinaryConfig } from './cloudinary';
import { contextEntries, serializeContext } from './context';

/** Cloudinary takes at most 100 photos in one context call. */
export const CONTEXT_BATCH = 100;
/**
 * The Admin and Search APIs share 500 requests an hour. Clearing a field takes two calls per group of
 * photos (see below), so one request is not allowed to spend more than this many writes (reading the
 * current context first costs one more call per 100 photos).
 */
export const MAX_CONTEXT_CALLS = 60;
/**
 * A serverless function is killed when it takes too long (about 10 s on Netlify). Writing stops starting
 * new groups of photos after this long, so that the function is not cut off between the two calls of a
 * `replace`, which would leave the photos with an empty context.
 */
export const WRITE_BUDGET_MS = 6000;
/**
 * How long a whole request to `/api/annotate` may take before it stops starting writes: the time spent
 * reading the current contexts counts, since a serverless function is cut off at about 10 s.
 */
export const REQUEST_BUDGET_MS = 8000;

type Entries = Record<string, string>;

/** What happens to one photo: how it was, how it will be, and the extra keys that go with it. */
export interface PhotoChange {
	publicId: string;
	before: Annotation;
	after: Annotation;
	/** The keys that are not ours, once the change is made. */
	extra: Entries;
}

/**
 * One group of photos that get exactly the same writes:
 * - `add` sets keys (the ones that changed, nothing else, so a key somebody else edited is not touched);
 * - `replace` is for when a field is cleared. Cloudinary cannot remove a single key, so the context is
 *   emptied and written again whole (`before` is kept to put it back if a step fails).
 */
export type Operation =
	| { kind: 'add'; publicIds: string[]; entries: Entries }
	| { kind: 'replace'; publicIds: string[]; before: Entries; after: Entries };

export type AnnotationPlan =
	| {
			ok: true;
			changes: PhotoChange[];
			unchanged: string[];
			/** Photos that are not written because a text that would be written has a backslash (see `writesBackslash`). */
			blocked: string[];
			operations: Operation[];
			calls: number;
	  }
	| { ok: false; problem: 'too-many-people'; publicId: string }
	| { ok: false; problem: 'too-many-calls' };

export const chunks = <T>(items: T[], size: number): T[][] =>
	Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));

/** `replace` is two calls (empty it, write it again), or one when there is nothing to write again. */
const callsPerGroup = (op: Operation): number =>
	op.kind === 'add' || Object.keys(op.after).length === 0 ? 1 : 2;

const callsFor = (operations: Operation[]): number =>
	operations.reduce((total, op) => total + chunks(op.publicIds, CONTEXT_BATCH).length * callsPerGroup(op), 0);

/**
 * Cloudinary's rule for a literal backslash in a context is not known (ours escapes `|` and `=` only), and a
 * text that ends in one would make the `|` after it read as escaped. A photo whose existing text has one is
 * not written rather than written back differently from how it was.
 */
const writesBackslash = (entries: Entries): boolean =>
	Object.entries(entries).some(([key, value]) => key.includes('\\') || value.includes('\\'));

/**
 * Works out what a patch does to each photo and how to write it, without touching Cloudinary.
 * Photos the patch leaves as they are come back in `unchanged` and are not written.
 */
export function planAnnotation(photos: Photo[], patch: AnnotationPatch): AnnotationPlan {
	const changes: PhotoChange[] = [];
	const unchanged: string[] = [];
	const blocked: string[] = [];
	const groups = new Map<string, Operation>();

	for (const photo of photos) {
		const before: Annotation = { caption: photo.caption, year: photo.year, people: photo.people };
		const applied = applyPatch(before, patch);
		if (!applied.ok) return { ok: false, problem: applied.problem, publicId: photo.publicId };
		const after = applied.annotation;
		if (sameAnnotation(before, after)) {
			unchanged.push(photo.publicId);
			continue;
		}

		const beforeExtra = photo.extraContext ?? {};
		// A year we could not read ("circa 1975") is replaced by the one that has just been set.
		const extra = { ...beforeExtra };
		if (after.year !== null) delete extra.year;

		const was = contextEntries(before, beforeExtra);
		const will = contextEntries(after, extra);
		const clears = Object.keys(was).some((key) => !(key in will));
		const changed = Object.fromEntries(Object.entries(will).filter(([key, value]) => was[key] !== value));
		// An add writes only what changes, a replace writes everything again.
		if (writesBackslash(clears ? will : changed)) {
			blocked.push(photo.publicId);
			continue;
		}
		changes.push({ publicId: photo.publicId, before, after, extra });
		const signature = clears
			? `replace\n${serializeContext(was)}\n${serializeContext(will)}`
			: `add\n${serializeContext(changed)}`;
		const group = groups.get(signature);
		if (group) group.publicIds.push(photo.publicId);
		else {
			groups.set(
				signature,
				clears
					? { kind: 'replace', publicIds: [photo.publicId], before: was, after: will }
					: { kind: 'add', publicIds: [photo.publicId], entries: changed }
			);
		}
	}

	const operations = [...groups.values()];
	const calls = callsFor(operations);
	if (calls > MAX_CONTEXT_CALLS) return { ok: false, problem: 'too-many-calls' };
	return { ok: true, changes, unchanged, blocked, operations, calls };
}

export interface WriteResult {
	/** Photos whose context now is what the plan said. */
	done: string[];
	/**
	 * Photos where something went wrong, or that were left alone because the time budget ran out. Their
	 * context may or may not have changed: reload it.
	 */
	failed: string[];
}

/**
 * Empties the context of the photos and writes it again. Any failure from the moment the first call is sent
 * is treated as one that may have emptied them (the call can be applied even if its answer is an error or
 * never comes), so the old context is logged first, then put back, and only then is the failure passed on.
 */
async function replaceContext(
	cfg: CloudinaryConfig,
	ids: string[],
	op: Extract<Operation, { kind: 'replace' }>
): Promise<void> {
	try {
		await updateContext(cfg, 'remove_all', ids);
		if (Object.keys(op.after).length > 0) await updateContext(cfg, 'add', ids, serializeContext(op.after));
	} catch (err) {
		const before = serializeContext(op.before);
		console.error(`[annotate] the context of ${ids.join(', ')} may now be empty, it was: ${before}`, err);
		await updateContext(cfg, 'add', ids, before).catch((restoreErr) => {
			console.error(
				`[annotate] the context of ${ids.join(', ')} is empty and the old one could not be put back, set it by hand: ${before}`,
				restoreErr
			);
		});
		throw err;
	}
}

/**
 * Carries the operations out one after another. A group that fails does not stop the others, and a
 * `replace` that fails writes the old context back before giving up (if that fails too, the old context
 * is logged so that it can be put back by hand).
 * Once `budgetMs` has gone by, the groups that have not started are reported as `failed` without calling
 * Cloudinary. The budget is only checked between groups: one that has started always finishes its calls.
 */
export async function writeOperations(
	cfg: CloudinaryConfig,
	operations: Operation[],
	budgetMs: number = WRITE_BUDGET_MS,
	now: () => number = Date.now
): Promise<WriteResult> {
	const result: WriteResult = { done: [], failed: [] };
	const started = now();
	for (const op of operations) {
		for (const ids of chunks(op.publicIds, CONTEXT_BATCH)) {
			if (now() - started >= budgetMs) {
				result.failed.push(...ids);
				continue;
			}
			try {
				if (op.kind === 'add') await updateContext(cfg, 'add', ids, serializeContext(op.entries));
				else await replaceContext(cfg, ids, op);
				result.done.push(...ids);
			} catch (err) {
				console.error(`[annotate] could not write the context of ${ids.join(', ')}`, err);
				result.failed.push(...ids);
			}
		}
	}
	return result;
}

/** The photo as it is once a change has been written. */
export function withChange(photo: Photo, change: PhotoChange): Photo {
	const next: Photo = { ...photo, ...change.after };
	if (Object.keys(change.extra).length > 0) next.extraContext = change.extra;
	else delete next.extraContext;
	return next;
}
