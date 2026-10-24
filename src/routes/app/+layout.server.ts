import { error, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { RATE_LIMITED } from '$lib/errors';
import { getFamilyIndex } from '$lib/server/photos';
import { CloudinaryRateLimitError } from '$lib/server/quota';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ depends, locals }) => {
	if (!locals.authed) redirect(303, '/login');
	depends('app:photos');
	try {
		const index = await getFamilyIndex();
		return { ...index, cloudName: env.CLOUDINARY_CLOUD_NAME ?? '' };
	} catch (err) {
		// Cloudinary's budget of calls for the hour is spent and there is no copy to show: say so, in words.
		if (err instanceof CloudinaryRateLimitError) error(503, RATE_LIMITED);
		throw err;
	}
};
