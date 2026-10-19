import { expect, test } from '@playwright/test';
import { stubCdnImages } from './helpers';

test.beforeEach(async ({ page }) => stubCdnImages(page));

test('the demo is public and in English, and its favorites stay in the browser', async ({
	page
}) => {
	await page.goto('/demo');
	await expect(page.locator('html')).toHaveAttribute('lang', 'en');
	await page.waitForLoadState('networkidle'); // hydration
	await expect(page.getByText('3 photos', { exact: true })).toBeVisible();

	await page.getByRole('button', { name: 'Open demo/sample_1' }).click();
	const viewer = page.getByRole('dialog', { name: 'Photo viewer' });
	await expect(viewer.getByText('Photo 1 of 3')).toBeVisible();

	const star = viewer.getByRole('button', { name: 'Favorite', exact: true });
	await star.click();
	await expect(star).toHaveAttribute('aria-pressed', 'true');
	await viewer.getByRole('button', { name: 'Close viewer' }).click();

	await page.getByRole('button', { name: 'Favorites', exact: true }).click();
	await expect(page.getByText('1 photo', { exact: true })).toBeVisible();

	await page.reload();
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: 'Favorites', exact: true }).click();
	await expect(page.getByText('1 photo', { exact: true })).toBeVisible();
});

test('the demo browses with the arrow keys', async ({ page }) => {
	await page.goto('/demo');
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: 'Open demo/sample_1' }).click();
	const viewer = page.getByRole('dialog', { name: 'Photo viewer' });
	await expect(viewer.getByText('Photo 1 of 3')).toBeVisible();

	await page.keyboard.press('ArrowRight');
	await expect(viewer.getByText('Photo 2 of 3')).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(viewer).toHaveCount(0);
});

test('each area declares its own language', async ({ page }) => {
	await page.goto('/login');
	await expect(page.locator('html')).toHaveAttribute('lang', 'es');
	await page.goto('/');
	await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('the language follows client-side navigation, not only full page loads', async ({ page }) => {
	await page.goto('/');
	await page.waitForLoadState('networkidle'); // hydration
	await expect(page.locator('html')).toHaveAttribute('lang', 'en');

	await page.getByRole('link', { name: 'Family sign in' }).click(); // a client-routed link
	await page.waitForURL('**/login');
	await expect(page.locator('html')).toHaveAttribute('lang', 'es');

	await page.goBack();
	await page.waitForURL((url) => url.pathname === '/');
	await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('the brand link is big enough to tap', async ({ page }) => {
	await page.goto('/demo');
	await page.waitForLoadState('networkidle');
	const box = await page.getByRole('link', { name: 'Fokkelman', exact: true }).boundingBox();
	expect(box?.height).toBeGreaterThanOrEqual(44);
});
