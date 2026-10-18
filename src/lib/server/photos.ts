import { env } from '$env/dynamic/private';
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
