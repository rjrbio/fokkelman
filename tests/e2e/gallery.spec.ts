import { expect, test } from '@playwright/test';
import { login, stubCdnImages } from './helpers';

test('loads the first batch and grows on scroll', async ({ page }) => {
	await stubCdnImages(page);
	await login(page);

	const cells = page.getByTestId('photo-grid').getByRole('button');
	await expect(cells).toHaveCount(60);

	await page.getByTestId('grid-sentinel').scrollIntoViewIfNeeded();
	await expect(cells).toHaveCount(80);
});
