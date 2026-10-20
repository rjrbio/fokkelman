import { applyPatch, sameAnnotation, type Annotation, type AnnotationPatch } from '$lib/annotations';
import type { Photo } from '$lib/types';
import { updateContext, type CloudinaryConfig } from './cloudinary';
import { contextEntries, serializeContext } from './context';

/** Cloudinary takes at most 100 photos in one context call. */
export const CONTEXT_BATCH = 100;
/**
 * The Admin and Search APIs share 500 requests an hour. Clearing a field takes two calls per group of
 * photos (see below), so one request is not allowed to spend more than this many.
 */
export const MAX_CONTEXT_CALLS = 60;

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
 *   emptied and written again whole (`before` is kept to put it back if the second step fails).
 */
export type Operation =
	| { kind: 'add'; publicIds: string[]; entries: Entries }
	| { kind: 'replace'; publicIds: string[]; before: Entries; after: Entries };

export type AnnotationPlan =
	| { ok: true; changes: PhotoChange[]; unchanged: string[]; operations: Operation[]; calls: number }
	| { ok: false; problem: 'too-many-people'; publicId: string }
	| { ok: false; problem: 'too-many-calls' };

const chunks = <T>(items: T[], size: number): T[][] =>
	Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));

/** `replace` is two calls (empty it, write it again), or one when there is nothing to write again. */
const callsPerGroup = (op: Operation): number =>
	op.kind === 'add' || Object.keys(op.after).length === 0 ? 1 : 2;

const callsFor = (operations: Operation[]): number =>
	operations.reduce((total, op) => total + chunks(op.publicIds, CONTEXT_BATCH).length * callsPerGroup(op), 0);

/**
 * Works out what a patch does to each photo and how to write it, without touching Cloudinary.
 * Photos the patch leaves as they are come back in `unchanged` and are not written.
 */
export function planAnnotation(photos: Photo[], patch: AnnotationPatch): AnnotationPlan {
	const changes: PhotoChange[] = [];
	const unchanged: string[] = [];
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
		changes.push({ publicId: photo.publicId, before, after, extra });

		const was = contextEntries(before, beforeExtra);
		const will = contextEntries(after, extra);
		const clears = Object.keys(was).some((key) => !(key in will));
		const changed = Object.fromEntries(Object.entries(will).filter(([key, value]) => was[key] !== value));
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
	return { ok: true, changes, unchanged, operations, calls };
}

export interface WriteResult {
	/** Photos whose context now is what the plan said. */
	done: string[];
	/** Photos where something went wrong. Their context may or may not have changed: reload it. */
	failed: string[];
}

/**
 * Carries the operations out one after another. A group that fails does not stop the others, and a
 * `replace` that fails after emptying the context writes the old context back before giving up.
 */
export async function writeOperations(cfg: CloudinaryConfig, operations: Operation[]): Promise<WriteResult> {
	const result: WriteResult = { done: [], failed: [] };
	for (const op of operations) {
		for (const ids of chunks(op.publicIds, CONTEXT_BATCH)) {
			try {
				if (op.kind === 'add') {
					await updateContext(cfg, 'add', ids, serializeContext(op.entries));
				} else {
					await updateContext(cfg, 'remove_all', ids);
					if (Object.keys(op.after).length > 0) {
						try {
							await updateContext(cfg, 'add', ids, serializeContext(op.after));
						} catch (err) {
							await updateContext(cfg, 'add', ids, serializeContext(op.before)).catch(() => undefined);
							throw err;
						}
					}
				}
				result.done.push(...ids);
			} catch {
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
