import { SvelteMap } from 'svelte/reactivity';
import {
	applyAnnotationOverrides,
	applyPatch,
	MAX_PHOTOS_PER_REQUEST,
	sameAnnotation,
	type Annotation,
	type AnnotationPatch
} from './annotations';
import type { Photo } from './types';

// Browser only: never call from server code (module state is shared across requests).

/** What the family wrote in this session that the server-rendered index may not reflect yet. */
const overrides = new SvelteMap<string, Annotation>();
const inFlight = new Set<string>();

/** How long the "could not save" message stays up before it dismisses itself. */
export const ANNOTATION_FAILURE_MS = 5000;

export type AnnotationProblem = 'failed' | 'too-many-people' | 'too-many-calls' | 'rate-limited';

/** The last save that did not work, or `problem: null`. Read it inside a template/`$derived`. */
export const annotationFailure = $state<{ problem: AnnotationProblem | null; count: number }>({
	problem: null,
	count: 0
});
let failureTimer: ReturnType<typeof setTimeout> | undefined;

export function dismissAnnotationFailure(): void {
	clearTimeout(failureTimer);
	failureTimer = undefined;
	annotationFailure.problem = null;
	annotationFailure.count = 0;
}

function reportAnnotationFailure(problem: AnnotationProblem, count: number): void {
	dismissAnnotationFailure();
	annotationFailure.problem = problem;
	annotationFailure.count = count;
	failureTimer = setTimeout(dismissAnnotationFailure, ANNOTATION_FAILURE_MS);
}

/** Call inside a `$derived`/template: it tracks the overrides, so the list updates on every save. */
export const withAnnotationOverrides = (photos: Photo[]): Photo[] =>
	applyAnnotationOverrides(photos, overrides);

/** Drop the overrides once fresh server data has arrived. */
export const clearAnnotationOverrides = (): void => overrides.clear();

export type SaveOutcome = 'done' | 'failed' | 'unauthorized' | 'busy';

export type SendAnnotation = (publicIds: string[], patch: AnnotationPatch) => Promise<Response>;

interface ServerAnswer {
	updated?: { publicId?: unknown; annotation?: Annotation }[];
	failed?: unknown[];
	problem?: unknown;
}

/** The reasons the server can give for a refusal that the app has words for; any other is just "failed". */
const knownProblem = (problem: unknown): AnnotationProblem =>
	problem === 'too-many-people' || problem === 'too-many-calls' || problem === 'rate-limited' ? problem : 'failed';

interface Attempt {
	outcome: SaveOutcome;
	/** On `'failed'`: how many photos did not get saved, and why. */
	count: number;
	problem: AnnotationProblem;
}

/**
 * Shows the change right away and takes it back if the server says no, for one request. It does not tell
 * the person about a failure: the caller does, once, whatever the number of requests it made.
 */
async function attempt(
	photos: Pick<Photo, 'publicId' | keyof Annotation>[],
	patch: AnnotationPatch,
	send: SendAnnotation
): Promise<Attempt> {
	const result = (outcome: SaveOutcome, count = 0, problem: AnnotationProblem = 'failed'): Attempt => ({
		outcome,
		count,
		problem
	});

	const next = new Map<string, Annotation>();
	for (const photo of photos) {
		const applied = applyPatch(photo, patch);
		if (!applied.ok) return result('failed', 1, applied.problem);
		if (!sameAnnotation(photo, applied.annotation)) next.set(photo.publicId, applied.annotation);
	}
	if (next.size === 0) return result('done');

	const ids = [...next.keys()];
	const previous = new Map(ids.map((id) => [id, overrides.get(id)]));
	const revert = (publicIds: string[]) => {
		for (const id of publicIds) {
			const before = previous.get(id);
			if (before === undefined) overrides.delete(id);
			else overrides.set(id, before);
		}
	};
	const fail = (publicIds: string[], problem: AnnotationProblem = 'failed'): Attempt => {
		revert(publicIds);
		return result('failed', publicIds.length, problem);
	};

	for (const [id, annotation] of next) {
		inFlight.add(id);
		overrides.set(id, annotation);
	}
	try {
		const response = await send(ids, patch);
		if (response.status === 401) {
			revert(ids);
			return result('unauthorized');
		}
		const answer = (await response.json().catch(() => null)) as ServerAnswer | null;
		if (!response.ok) {
			return fail(ids, knownProblem(answer?.problem));
		}
		for (const item of answer?.updated ?? []) {
			if (typeof item.publicId === 'string' && item.annotation && next.has(item.publicId)) {
				overrides.set(item.publicId, item.annotation);
			}
		}
		const failed = (answer?.failed ?? []).filter((id): id is string => typeof id === 'string');
		return failed.length > 0 ? fail(failed) : result('done');
	} catch {
		return fail(ids);
	} finally {
		for (const id of ids) inFlight.delete(id);
	}
}

/**
 * Shows the change right away and takes it back if the server says no. A photo has at most one save
 * in flight (`'busy'` for the rest). On success the annotation the server answers with replaces the
 * guess, since the server merges the patch with what it knows of each photo. A failure is also
 * published in `annotationFailure` so the app can say so wherever the person is.
 */
export async function saveAnnotation(
	photos: Pick<Photo, 'publicId' | keyof Annotation>[],
	patch: AnnotationPatch,
	send: SendAnnotation
): Promise<SaveOutcome> {
	if (photos.some((photo) => inFlight.has(photo.publicId))) return 'busy';
	dismissAnnotationFailure();
	const result = await attempt(photos, patch, send);
	if (result.outcome === 'failed') reportAnnotationFailure(result.problem, result.count);
	return result.outcome;
}

/**
 * The same for any number of photos: the server takes `MAX_PHOTOS_PER_REQUEST` at a time, so they go in
 * groups, one after the other. Each group is saved (or taken back) on its own; the failures of all of them
 * are told once at the end. An expired session stops it, and what was saved before stays saved.
 * `onProgress` hears how many photos have been dealt with.
 */
export async function saveAnnotationInBatches(
	photos: Pick<Photo, 'publicId' | keyof Annotation>[],
	patch: AnnotationPatch,
	send: SendAnnotation,
	onProgress?: (done: number, total: number) => void
): Promise<SaveOutcome> {
	if (photos.some((photo) => inFlight.has(photo.publicId))) return 'busy';
	dismissAnnotationFailure();

	let outcome: SaveOutcome = 'done';
	let failedPhotos = 0;
	let problem: AnnotationProblem | null = null;
	for (let start = 0; start < photos.length; start += MAX_PHOTOS_PER_REQUEST) {
		const group = photos.slice(start, start + MAX_PHOTOS_PER_REQUEST);
		const result = await attempt(group, patch, send);
		if (result.outcome === 'unauthorized') return 'unauthorized';
		if (result.outcome === 'failed') {
			outcome = 'failed';
			failedPhotos += result.count;
			problem ??= result.problem;
		}
		onProgress?.(start + group.length, photos.length);
	}
	if (outcome === 'failed') reportAnnotationFailure(problem ?? 'failed', failedPhotos);
	return outcome;
}
