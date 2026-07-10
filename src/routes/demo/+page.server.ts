import { env } from '$env/dynamic/private';
import { getDemoIndex } from '$lib/server/photos';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const index = await getDemoIndex();
	return { ...index, cloudName: env.CLOUDINARY_CLOUD_NAME ?? '' };
};
