import {
	applyPatch,
	noAnnotation,
	parsePatch,
	type AnnotationPatch,
	type PatchProblem
} from '$lib/annotations';
import { contextEntries, serializeContext } from './context';

export type UploadContext =
	| { ok: true; /** `undefined` when the photos are uploaded with no data. */ context: string | undefined }
	| { ok: false; problem: PatchProblem };

/**
 * The context new photos get when they are uploaded with a description, a year and people: what a client
 * asks for goes through the same checks as an edit (`parsePatch`), and the context is built here, never taken
 * from the client, so that what is signed is what the rules allow.
 */
export function uploadContextFrom(input: { caption?: unknown; year?: unknown; people?: unknown }): UploadContext {
	const raw: Record<string, unknown> = {};
	if (input.caption !== undefined && input.caption !== null && input.caption !== '') raw.caption = input.caption;
	if (input.year !== undefined && input.year !== null && input.year !== '') raw.year = input.year;
	if (input.people !== undefined && input.people !== null) {
		if (!Array.isArray(input.people)) return { ok: false, problem: 'bad-shape' };
		raw.addPeople = input.people;
	}
	if (Object.keys(raw).length === 0) return { ok: true, context: undefined };

	const parsed = parsePatch(raw);
	// Names that are all blanks leave nothing to say: it is not a mistake, there is just no data.
	if (!parsed.ok) {
		return parsed.problem === 'nothing-to-change'
			? { ok: true, context: undefined }
			: { ok: false, problem: parsed.problem };
	}
	const applied = applyPatch(noAnnotation(), parsed.value as AnnotationPatch);
	if (!applied.ok) return { ok: false, problem: applied.problem };
	const entries = contextEntries(applied.annotation);
	return { ok: true, context: Object.keys(entries).length > 0 ? serializeContext(entries) : undefined };
}
