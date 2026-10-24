import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	setFavorite: vi.fn(),
	createUploadSignature: vi.fn(),
	cloudinaryConfig: vi.fn(),
	getFamilyIndex: vi.fn(),
	markFavorite: vi.fn(),
	markFavorites: vi.fn(),
	annotatePhotos: vi.fn(),
	invalidateFamilyIndex: vi.fn(),
	resolveUploadFolder: vi.fn()
}));
vi.mock('$lib/server/cloudinary', () => ({
	setFavorite: mocks.setFavorite,
	createUploadSignature: mocks.createUploadSignature
}));
vi.mock('$lib/server/photos', () => ({
	cloudinaryConfig: mocks.cloudinaryConfig,
	getFamilyIndex: mocks.getFamilyIndex,
	markFavorite: mocks.markFavorite,
	markFavorites: mocks.markFavorites,
	annotatePhotos: mocks.annotatePhotos,
	invalidateFamilyIndex: mocks.invalidateFamilyIndex,
	resolveUploadFolder: mocks.resolveUploadFolder
}));

import { POST as annotate } from './annotate/+server';
import { POST as favorite } from './favorite/+server';
import { POST as favorites } from './favorites/+server';
import { POST as refreshIndex } from './refresh-index/+server';
import { POST as uploadSignature } from './upload-signature/+server';

const handlers = { annotate, favorite, favorites, 'refresh-index': refreshIndex, 'upload-signature': uploadSignature };

function makeEvent(authed: boolean) {
	const json = vi.fn(async () => ({ publicId: 'x', favorite: true, folder: '' }));
	const event = { locals: { authed }, request: { json } };
	return { event: event as never, json };
}

beforeEach(() => {
	for (const mock of Object.values(mocks)) mock.mockReset();
	mocks.getFamilyIndex.mockResolvedValue({ photos: [] });
	mocks.markFavorite.mockResolvedValue('ok');
	mocks.markFavorites.mockResolvedValue({ status: 'done', done: [], failed: [] });
	mocks.resolveUploadFolder.mockReturnValue('family_uploads');
});

describe.each(Object.entries(handlers))('/api/%s', (_name, handler) => {
	it('answers 401 to an unauthenticated call before reading the body or touching Cloudinary', async () => {
		const { event, json } = makeEvent(false);
		await expect((async () => handler(event))()).rejects.toMatchObject({ status: 401 });
		expect(json).not.toHaveBeenCalled();
		for (const mock of Object.values(mocks)) expect(mock).not.toHaveBeenCalled();
	});

	it('lets an authenticated call through', async () => {
		const { event } = makeEvent(true);
		await expect((async () => handler(event))()).resolves.toBeInstanceOf(Response);
	});
});
