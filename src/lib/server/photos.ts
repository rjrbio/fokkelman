import { env } from '$env/dynamic/private';
import type { Annotation, AnnotationPatch } from '$lib/annotations';
import type { Photo } from '$lib/types';
import { planAnnotation, withChange, writeOperations } from './annotate';
import { searchAllPhotos, setFavorite, type CloudinaryConfig } from './cloudinary';
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

export type AnnotateOutcome =
	| { status: 'unknown-photo' }
	| { status: 'rejected'; problem: 'too-many-people' | 'too-many-calls' }
	| {
			status: 'done';
			/** The photos that were written, with the annotation they have now. */
			updated: { publicId: string; annotation: Annotation }[];
			/** The photos where Cloudinary failed; the family index is reloaded the next time it is read. */
			failed: string[];
	  };

/**
 * Applies a patch to family photos and patches the cached index with what was really written.
 * The patch is merged with what the server knows of each photo (so adding a person keeps the ones
 * somebody else added); it refuses ids that are not in the family index, the demo folder included.
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

	const plan = planAnnotation(targets, patch);
	if (!plan.ok) return { status: 'rejected', problem: plan.problem };

	const { done, failed } = await writeOperations(cloudinaryConfig(), plan.operations);
	const written = new Map(plan.changes.filter((c) => done.includes(c.publicId)).map((c) => [c.publicId, c]));
	familyCache.patch((all) =>
		all.map((photo) => {
			const change = written.get(photo.publicId);
			return change ? withChange(photo, change) : photo;
		})
	);
	if (failed.length > 0) familyCache.invalidate();

	return {
		status: 'done',
		updated: [...written.values()].map((c) => ({ publicId: c.publicId, annotation: c.after })),
		failed
	};
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
