import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getFamilyIndex: vi.fn() }));
vi.mock('$env/dynamic/private', () => ({ env: { CLOUDINARY_CLOUD_NAME: 'testcloud' } }));
vi.mock('$lib/server/photos', () => ({ getFamilyIndex: mocks.getFamilyIndex }));

import { load } from './+layout.server';

function loadWith(authed: boolean) {
	const event = { locals: { authed }, depends: vi.fn() } as unknown as Parameters<typeof load>[0];
	return load(event);
}

beforeEach(() => {
	mocks.getFamilyIndex.mockReset();
	mocks.getFamilyIndex.mockResolvedValue({ photos: [] });
});

describe('/app layout load', () => {
	it('redirects an unauthenticated request to the login before touching the photo index', async () => {
		await expect(loadWith(false)).rejects.toMatchObject({ status: 303, location: '/login' });
		expect(mocks.getFamilyIndex).not.toHaveBeenCalled();
	});

	it('loads the photo index for an authenticated request', async () => {
		await expect(loadWith(true)).resolves.toMatchObject({ photos: [], cloudName: 'testcloud' });
		expect(mocks.getFamilyIndex).toHaveBeenCalledOnce();
	});
});
