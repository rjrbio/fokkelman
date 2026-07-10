import { env } from '$env/dynamic/private';
import { getFamilyIndex } from '$lib/server/photos';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ depends }) => {
	depends('app:photos');
	const index = await getFamilyIndex();
	return { ...index, cloudName: env.CLOUDINARY_CLOUD_NAME ?? '' };
};
