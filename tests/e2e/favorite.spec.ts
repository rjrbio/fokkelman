import { expect, test } from '@playwright/test';
import { login, stubCdnImages } from './helpers';

test('marks a photo as favorite and finds it with the filter', async ({ page }) => {
	await stubCdnImages(page);
	await login(page);
	// The dev server serves an unbundled module graph; wait for it to settle so the
	// client has hydrated (and the grid button's click handler is actually wired up)
	// before interacting, otherwise the very first click can land on dead HTML.
	await page.waitForLoadState('networkidle');

	await page.getByRole('button', { name: 'Open Sample_001' }).click();
	const favButton = page.getByRole('button', { name: 'Add to favorites' });
	await favButton.click();
	await expect(page.getByRole('button', { name: 'Remove from favorites' })).toBeVisible();

	await page.getByRole('button', { name: 'Close viewer' }).click();
	await page.getByRole('button', { name: '★ Favorites' }).click();
	await expect(page.getByText('1 photos')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Open Sample_001' })).toBeVisible();
});
