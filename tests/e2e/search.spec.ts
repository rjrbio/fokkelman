import { expect, test } from '@playwright/test';
import { login, stubCdnImages } from './helpers';

test.beforeEach(async ({ page }) => {
	await stubCdnImages(page);
	await login(page);
	await page.waitForLoadState('networkidle'); // hydration
});

test('typing in the search box filters without adding a history entry per keystroke', async ({
	page
}) => {
	const before = await page.evaluate(() => history.length);

	await page.getByRole('searchbox', { name: 'Search photos' }).pressSequentially('Sample_07', {
		delay: 30
	});

	await expect(page).toHaveURL(/[?&]q=Sample_07/);
	await expect(page.getByText('10 photos')).toBeVisible(); // Sample_070 … Sample_079
	expect(await page.evaluate(() => history.length)).toBe(before);
});

test('choosing a filter right after typing keeps what was typed', async ({ page }) => {
	await page.getByRole('searchbox', { name: 'Search photos' }).pressSequentially('Sample_01');
	await page.getByRole('button', { name: '★ Favorites' }).click();

	await expect(page).toHaveURL(/\?q=Sample_01&fav=1$/);
});

test('a real filter change returns the grid to the first batch', async ({ page }) => {
	const cells = page.getByTestId('photo-grid').getByRole('button');
	await expect(cells.first()).toBeVisible();
	const firstBatch = await cells.count();
	await page.getByTestId('grid-sentinel').scrollIntoViewIfNeeded();
	await expect.poll(() => cells.count()).toBeGreaterThan(firstBatch);

	await page.getByRole('searchbox', { name: 'Search photos' }).fill('Sample'); // matches all 80
	await expect(page).toHaveURL(/[?&]q=Sample/);

	await expect(cells).toHaveCount(firstBatch);
});
