import { env } from '$env/dynamic/private';
import { searchAllPhotos, type CloudinaryConfig } from './cloudinary';
import { createIndexCache } from './photoIndex';

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
