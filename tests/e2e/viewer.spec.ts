import { expect, test } from '@playwright/test';
import { login, stubCdnImages, viewerDialog } from './helpers';

test.beforeEach(async ({ page }) => {
	await stubCdnImages(page);
	await login(page);
	await page.waitForLoadState('networkidle'); // hydration
});

test('the panel shows where the photo is and what it is', async ({ page }) => {
	await page.getByRole('button', { name: 'Abrir Sample_001' }).click();
	const viewer = viewerDialog(page);

	await expect(viewer.getByText('Foto 1 de 80')).toBeVisible();
	await expect(viewer.getByText('Sample_001')).toBeVisible();
	await expect(viewer.getByText('Sin colección')).toBeVisible();
	await expect(viewer.getByText('800 × 600 px')).toBeVisible();
	await expect(viewer.getByRole('link', { name: 'Descargar' })).toHaveAttribute(
		'href',
		/\/fl_attachment\/Sample_001\.jpg$/
	);
});

test('the arrow keys move between photos and fetch the neighbours ahead of time', async ({
	page
}) => {
	const requested: string[] = [];
	page.on('request', (request) => requested.push(request.url()));

	await page.getByRole('button', { name: 'Abrir Sample_002' }).click();
	await expect(viewerDialog(page).getByText('Foto 2 de 80')).toBeVisible();
	await expect
		.poll(() => requested.some((url) => url.includes('w_1600/Sample_003')))
		.toBe(true);
	expect(requested.some((url) => url.includes('w_1600/Sample_001'))).toBe(true);

	await page.keyboard.press('ArrowRight');
	await expect(page).toHaveURL(/\/app\/photo\/Sample_003$/);
	await expect(viewerDialog(page).getByText('Foto 3 de 80')).toBeVisible();

	await page.keyboard.press('ArrowLeft');
	await expect(page).toHaveURL(/\/app\/photo\/Sample_002$/);
});

test('the page behind does not scroll while the viewer is open', async ({ page }) => {
	await page.getByRole('button', { name: 'Abrir Sample_001' }).click();
	await expect(viewerDialog(page)).toBeVisible();

	const overflow = () => page.evaluate(() => getComputedStyle(document.documentElement).overflow);
	expect(await overflow()).toBe('hidden');

	await page.keyboard.press('Escape');
	await expect(viewerDialog(page)).toHaveCount(0);
	expect(await overflow()).not.toBe('hidden');
});

test('Tab stays inside the viewer, and closing gives the focus back to the photo', async ({
	page
}) => {
	const opener = page.getByRole('button', { name: 'Abrir Sample_001' });
	await opener.click();
	const viewer = viewerDialog(page);
	await expect(viewer).toBeFocused();

	for (let i = 0; i < 8; i++) {
		await page.keyboard.press('Tab');
		expect(await viewer.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true);
	}
	for (let i = 0; i < 8; i++) {
		await page.keyboard.press('Shift+Tab');
		expect(await viewer.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true);
	}

	await page.keyboard.press('Escape');
	await expect(viewer).toHaveCount(0);
	await expect(opener).toBeFocused();
});

test('a shared link opens the viewer straight away, with the photo showing and no errors', async ({
	page
}) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	page.on('console', (message) => {
		if (message.type() === 'error') errors.push(message.text());
	});

	await page.goto('/app/photo/Sample_003');
	await expect(viewerDialog(page).getByText('Foto 3 de 80')).toBeVisible();
	// The server-rendered page may finish loading the photo before it hydrates: it must still appear.
	await expect(viewerDialog(page).locator('img.full')).toHaveCSS('opacity', '1');
	await page.waitForLoadState('networkidle');
	expect(errors).toEqual([]);

	await page.getByRole('button', { name: 'Cerrar visor' }).click();
	await expect(page).toHaveURL(/\/app$/);
	await expect(page.getByRole('button', { name: 'Abrir Sample_003' })).toBeVisible();
});

test('a link to a photo that does not exist says so and leads back', async ({ page }) => {
	await page.goto('/app/photo/nope');
	await expect(page.getByText('Foto no encontrada.')).toBeVisible();
	await page.getByRole('link', { name: 'Volver a la galería' }).click();
	await expect(page).toHaveURL(/\/app$/);
});
