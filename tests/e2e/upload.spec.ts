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

	await page.getByRole('button', { name: 'Subir', exact: true }).click();
	await page.setInputFiles('input[type=file]', {
		name: 'holiday.jpg',
		mimeType: 'image/jpeg',
		buffer: Buffer.from('fake-image-bytes')
	});
	await page.getByRole('button', { name: 'Subir todo' }).click();
	await expect(page.getByText('Subida')).toBeVisible();

	const refresh = page.waitForRequest('**/api/refresh-index');
	await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
	await refresh;
});

test('keeps the focus inside the dialog when the button that had it is disabled by its own press', async ({
	page
}) => {
	await stubCdnImages(page);
	// Held until the test lets it go, so that the button stays disabled while the keys are pressed.
	let finishUpload!: () => void;
	const uploadMayFinish = new Promise<void>((resolve) => (finishUpload = resolve));
	await page.route('https://api.cloudinary.com/v1_1/testcloud/image/upload', async (route) => {
		await uploadMayFinish;
		await route.fulfill({
			contentType: 'application/json',
			body: JSON.stringify({ public_id: 'family_uploads/e2e_focus', format: 'jpg' })
		});
	});
	await login(page);
	await page.waitForLoadState('networkidle'); // hydration

	await page.getByRole('button', { name: 'Subir', exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'Subir fotos' });
	const focusIsInside = () => dialog.evaluate((d) => d.contains(document.activeElement));
	await page.setInputFiles('input[type=file]', {
		name: 'holiday.jpg',
		mimeType: 'image/jpeg',
		buffer: Buffer.from('fake-image-bytes')
	});

	// Pressing Enter on "Subir todo" disables it (and "Cerrar"), so the browser drops the focus on
	// <body>. The next Tab must still land inside the dialog, not on the page behind it.
	await dialog.getByRole('button', { name: 'Subir todo' }).focus();
	await page.keyboard.press('Enter');
	await expect(dialog.getByRole('button', { name: 'Subiendo…' })).toBeDisabled();
	await expect(page.locator('body')).toBeFocused();
	await page.keyboard.press('Tab');
	expect(await focusIsInside()).toBe(true);

	finishUpload();
	await expect(dialog.getByText('Subida')).toBeVisible();

	// The same going backwards: from the first control, losing the focus and pressing Shift+Tab
	// must not reach the page behind either.
	await dialog.locator('input[type=file]').focus();
	await page.evaluate(() => (document.activeElement as HTMLElement).blur());
	await expect(page.locator('body')).toBeFocused();
	await page.keyboard.press('Shift+Tab');
	expect(await focusIsInside()).toBe(true);
});

test('ignores a file that is already in the queue instead of crashing', async ({ page }) => {
	await stubCdnImages(page);
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await login(page);
	await page.waitForLoadState('networkidle'); // hydration

	await page.getByRole('button', { name: 'Subir', exact: true }).click();
	const photo = {
		name: 'holiday.jpg',
		mimeType: 'image/jpeg',
		buffer: Buffer.from('fake-image-bytes')
	};
	await page.setInputFiles('input[type=file]', photo);
	await page.setInputFiles('input[type=file]', photo);

	const dialog = page.getByRole('dialog', { name: 'Subir fotos' });
	await expect(dialog.getByRole('listitem')).toHaveCount(1);
	await expect(dialog.getByText('1 archivo omitido')).toBeVisible();
	expect(errors).toEqual([]);
});

test('reaches the file field with the keyboard, announces what it skipped and closes with Escape', async ({
	page
}) => {
	await stubCdnImages(page);
	await login(page);
	await page.waitForLoadState('networkidle'); // hydration

	await page.getByRole('button', { name: 'Subir', exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'Subir fotos' });
	await expect(dialog).toBeFocused();
	// The live region has to be in the accessibility tree before its text changes, or the
	// announcement can be lost: getByRole skips elements that are display: none.
	await expect(dialog.getByRole('status')).toHaveCount(1);

	await page.keyboard.press('Tab');
	await expect(dialog.locator('input[type=file]')).toBeFocused();

	await page.setInputFiles('input[type=file]', {
		name: 'notes.txt',
		mimeType: 'text/plain',
		buffer: Buffer.from('not an image')
	});
	await expect(dialog.getByRole('status')).toHaveText(
		'1 archivo omitido (repetido o no es una imagen).'
	);

	await page.keyboard.press('Escape');
	await expect(dialog).toHaveCount(0);
});

test('offers a retry button big enough to tap when an upload fails', async ({ page }) => {
	await stubCdnImages(page);
	await page.route('https://api.cloudinary.com/v1_1/testcloud/image/upload', (route) =>
		route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
	);
	await login(page);
	await page.waitForLoadState('networkidle'); // hydration

	await page.getByRole('button', { name: 'Subir', exact: true }).click();
	await page.setInputFiles('input[type=file]', {
		name: 'holiday.jpg',
		mimeType: 'image/jpeg',
		buffer: Buffer.from('fake-image-bytes')
	});
	await page.getByRole('button', { name: 'Subir todo' }).click();
	await expect(page.getByText('Falló')).toBeVisible();

	const box = await page.getByRole('button', { name: 'Reintentar' }).boundingBox();
	expect(box?.height).toBeGreaterThanOrEqual(44);
});
