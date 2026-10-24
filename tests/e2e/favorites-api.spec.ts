import { expect, test, type Page } from '@playwright/test';
import { login, resetBackend, storedFavorites } from './helpers';

// The mock checks the signature of every tags call the way Cloudinary does, with the ids comma-joined.
test.beforeEach(async ({ page }) => {
	await login(page);
	await resetBackend(page);
});

test.afterEach(async ({ page }) => {
	await resetBackend(page);
});

const mark = (page: Page, publicIds: string[], favorite: boolean) =>
	page.request.post('/api/favorites', { data: { publicIds, favorite } });

test('answers 401 without a session', async ({ playwright }) => {
	const anonymous = await playwright.request.newContext({ baseURL: 'http://localhost:5199' });
	const response = await anonymous.post('/api/favorites', { data: { publicIds: ['Sample_001'], favorite: true } });
	expect(response.status()).toBe(401);
	await anonymous.dispose();
});

test('marks many photos with one signed call, and unmarks them', async ({ page }) => {
	const response = await mark(page, ['Sample_001', 'Sample_002', 'Sample_003'], true);

	expect(response.status()).toBe(200);
	expect(await response.json()).toEqual({ done: ['Sample_001', 'Sample_002', 'Sample_003'], failed: [] });
	expect(await storedFavorites()).toEqual(['Sample_001', 'Sample_002', 'Sample_003']);

	await mark(page, ['Sample_002'], false);
	expect(await storedFavorites()).toEqual(['Sample_001', 'Sample_003']);
});

test('refuses what it should, and changes nothing', async ({ page }) => {
	expect((await mark(page, ['demo/sample_1'], true)).status()).toBe(404);
	expect((await mark(page, ['Sample_001', 'demo/sample_1'], true)).status()).toBe(404);
	expect((await mark(page, [], true)).status()).toBe(400);
	expect((await page.request.post('/api/favorites', { data: { publicIds: ['Sample_001'], favorite: 'yes' } })).status()).toBe(400);
	expect(await storedFavorites()).toEqual([]);
});
