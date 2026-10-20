import { env } from '$env/dynamic/private';
import type { Annotation, AnnotationPatch } from '$lib/annotations';
import type { Photo } from '$lib/types';
import { CONTEXT_BATCH, chunks, planAnnotation, withChange, writeOperations } from './annotate';
import { getContexts, searchAllPhotos, setFavorite, type CloudinaryConfig } from './cloudinary';
import { withContext } from './context';
import { createIndexCache, withFavorite } from './photoIndex';

export const DEMO_FOLDER = 'demo';
export const UPLOAD_FOLDER = 'family_uploads';

export function cloudinaryConfig(): CloudinaryConfig {
	return {
		cloudName: env.CLOUDINARY_CLOUD_NAME ?? '',
		apiKey: env.CLOUDINARY_API_KEY ?? '',
		apiSecret: env.CLOUDINARY_API_SECRET ?? '',
		apiBase: env.CLOUDINARY_API_BASE || 'https://api.cloudinary.com',
		fetchFn: fetch
	};
}

const familyCache = createIndexCache(() =>
	searchAllPhotos(cloudinaryConfig(), `resource_type:image AND -folder:${DEMO_FOLDER}`)
);
const demoCache = createIndexCache(() =>
	searchAllPhotos(cloudinaryConfig(), `resource_type:image AND folder:${DEMO_FOLDER}`)
);

export const getFamilyIndex = () => familyCache.get();
export const getDemoIndex = () => demoCache.get();
export const invalidateFamilyIndex = () => familyCache.invalidate();

/**
 * Sets the favorite tag on a family photo and patches the cached index so no refetch
 * is needed. Refuses photos outside the family index (the public demo folder in particular).
 */
export async function markFavorite(
	publicId: string,
	favorite: boolean
): Promise<'ok' | 'unknown-photo'> {
	const { photos } = await getFamilyIndex();
	if (!photos.some((p) => p.publicId === publicId)) return 'unknown-photo';
	await setFavorite(cloudinaryConfig(), publicId, favorite);
	familyCache.patch((all) => withFavorite(all, publicId, favorite));
	return 'ok';
}

/** No caption, no year, no people and no other keys: what a photo without context looks like. */
const hasNoData = (photo: Photo): boolean =>
	photo.caption === '' &&
	photo.year === null &&
	photo.people.length === 0 &&
	Object.keys(photo.extraContext ?? {}).length === 0;

export type AnnotateOutcome =
	| { status: 'unknown-photo' }
	| { status: 'rejected'; problem: 'too-many-people' | 'too-many-calls' }
	/** The current context of the photos could not be read, so nothing was written. */
	| { status: 'unavailable' }
	| {
			status: 'done';
			/** The photos that were written or that already were as asked, with the annotation they have now. */
			updated: { publicId: string; annotation: Annotation }[];
			/**
			 * The photos that were not written: Cloudinary failed, did not return them, returned nothing for a photo
			 * the index has data for, or their text has a backslash. The family index is reloaded the next time it
			 * is read.
			 */
			failed: string[];
	  };

/**
 * Applies a patch to family photos and patches the cached index with what was really written.
 * The patch is merged with what Cloudinary has for each photo right now, read with the Admin API just
 * before (so adding a person keeps the ones somebody else added, and clearing a field rewrites the keys that
 * are really there): the cached index can be out of date. It refuses ids that are not in the family index,
 * the demo folder included.
 */
export async function annotatePhotos(
	publicIds: string[],
	patch: AnnotationPatch
): Promise<AnnotateOutcome> {
	const { photos } = await getFamilyIndex();
	const byId = new Map(photos.map((photo) => [photo.publicId, photo]));
	const targets: Photo[] = [];
	for (const id of publicIds) {
		const photo = byId.get(id);
		if (!photo) return { status: 'unknown-photo' };
		targets.push(photo);
	}

	const cfg = cloudinaryConfig();
	const current = new Map<string, unknown>();
	try {
		for (const ids of chunks(publicIds, CONTEXT_BATCH)) {
			for (const [id, context] of await getContexts(cfg, ids)) current.set(id, context);
		}
	} catch (err) {
		console.error('[annotate] could not read the current context', err);
		return { status: 'unavailable' };
	}

	const missing: string[] = [];
	const doubted: string[] = [];
	const fresh: Photo[] = [];
	for (const photo of targets) {
		if (!current.has(photo.publicId)) {
			missing.push(photo.publicId);
			continue;
		}
		const now = withContext(photo, current.get(photo.publicId));
		// A read with nothing at all in it is what a read that leaves the context out looks like, and writing from
		// it would overwrite what is really there. It is only believed when the index has nothing for the photo either.
		if (hasNoData(now) && !hasNoData(photo)) {
			console.error(
				`[annotate] the current context of ${photo.publicId} came back empty while the index has data for it, nothing was written`
			);
			doubted.push(photo.publicId);
			continue;
		}
		fresh.push(now);
	}

	const plan = planAnnotation(fresh, patch);
	if (!plan.ok) return { status: 'rejected', problem: plan.problem };

	const { done, failed: notWritten } = await writeOperations(cfg, plan.operations);
	const written = new Map(plan.changes.filter((c) => done.includes(c.publicId)).map((c) => [c.publicId, c]));
	const unchanged = new Set(plan.unchanged);
	familyCache.patch((all) =>
		all.map((photo) => {
			const change = written.get(photo.publicId);
			if (change) return withChange(photo, change);
			// Found as asked already: what was cached for it was out of date, or it would not have been found so.
			return unchanged.has(photo.publicId) ? withContext(photo, current.get(photo.publicId)) : photo;
		})
	);
	const failed = [...notWritten, ...missing, ...doubted, ...plan.blocked];
	if (failed.length > 0) familyCache.invalidate();

	const updated: { publicId: string; annotation: Annotation }[] = [];
	for (const photo of fresh) {
		const change = written.get(photo.publicId);
		if (change) updated.push({ publicId: photo.publicId, annotation: change.after });
		else if (unchanged.has(photo.publicId)) {
			updated.push({ publicId: photo.publicId, annotation: { caption: photo.caption, year: photo.year, people: photo.people } });
		}
	}
	return { status: 'done', updated, failed };
}

/**
 * Decides which Cloudinary folder an upload signature should be issued for.
 *
 * This is the only server-side control preventing a client from signing an
 * upload into an arbitrary Cloudinary folder (e.g. the public `demo` folder,
 * which must never receive family uploads): a requested folder is honored
 * only if it is the default upload folder or a folder that already appears
 * in the family index; anything else silently falls back to the default.
 */
export function resolveUploadFolder(requested: string, existingFolders: string[]): string {
	const allowed = new Set([UPLOAD_FOLDER, ...existingFolders.filter(Boolean)]);
	return allowed.has(requested) ? requested : UPLOAD_FOLDER;
}
