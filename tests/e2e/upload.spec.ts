import { expect, test } from '@playwright/test';
import { login, stubCdnImages } from './helpers';

test('uploads a photo with a server-issued signature', async ({ page }) => {
	await stubCdnImages(page);
	await page.route('https://api.cloudinary.com/v1_1/testcloud/image/upload', (route) =>
		route.fulfill({
			contentType: 'application/json',
			body: JSON.stringify({ public_id: 'family_uploads/e2e_new', format: 'jpg' })
		})
	);
	await login(page);
	// See favorite.spec.ts: wait for the client to hydrate before the first interaction.
	await page.waitForLoadState('networkidle');

	await page.getByRole('button', { name: 'Subir' }).click();
	await page.setInputFiles('input[type=file]', {
		name: 'holiday.jpg',
		mimeType: 'image/jpeg',
		buffer: Buffer.from('fake-image-bytes')
	});
	await page.getByRole('button', { name: 'Upload all' }).click();
	await expect(page.getByText('Done')).toBeVisible();

	const refresh = page.waitForRequest('**/api/refresh-index');
	await page.getByRole('button', { name: 'Close', exact: true }).click();
	await refresh;
});

test('ignores a file that is already in the queue instead of crashing', async ({ page }) => {
	await stubCdnImages(page);
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await login(page);
	await page.waitForLoadState('networkidle'); // hydration

	await page.getByRole('button', { name: 'Subir' }).click();
	const photo = {
		name: 'holiday.jpg',
		mimeType: 'image/jpeg',
		buffer: Buffer.from('fake-image-bytes')
	};
	await page.setInputFiles('input[type=file]', photo);
	await page.setInputFiles('input[type=file]', photo);

	const dialog = page.getByRole('dialog', { name: 'Upload photos' });
	await expect(dialog.getByRole('listitem')).toHaveCount(1);
	await expect(dialog.getByText('1 file skipped')).toBeVisible();
	expect(errors).toEqual([]);
});
