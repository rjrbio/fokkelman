import { test, type Page } from '@playwright/test';
import { expectNoA11yViolations, login, stubCdnImages } from './helpers';

test.beforeEach(async ({ page }) => stubCdnImages(page));

/** Waits for the client to take over, so that what is scanned is what people use. */
const hydrated = (page: Page) => page.waitForLoadState('networkidle');

test('the sign-in page', async ({ page }) => {
	await page.goto('/login');
	await hydrated(page);
	await expectNoA11yViolations(page);
});

test('the sign-in page showing an error', async ({ page }) => {
	await page.goto('/login');
	await hydrated(page);
	await page.getByLabel('Contraseña de la familia').fill('nope');
	await page.getByRole('button', { name: 'Entrar' }).click();
	await page.getByRole('alert').waitFor();
	await expectNoA11yViolations(page);
});

test('the family gallery', async ({ page }) => {
	await login(page);
	await hydrated(page);
	await page.getByRole('button', { name: 'Abrir Sample_001' }).waitFor();
	await expectNoA11yViolations(page);
});

test('the viewer', async ({ page }) => {
	await login(page);
	await hydrated(page);
	await page.getByRole('button', { name: 'Abrir Sample_001' }).click();
	await page.getByRole('dialog', { name: 'Visor de fotos' }).waitFor();
	await expectNoA11yViolations(page);
});

test('the upload dialog, with a queued file', async ({ page }) => {
	await login(page);
	await hydrated(page);
	await page.getByRole('button', { name: 'Subir', exact: true }).click();
	await page.setInputFiles('input[type=file]', {
		name: 'holiday.jpg',
		mimeType: 'image/jpeg',
		buffer: Buffer.from('fake-image-bytes')
	});
	await page.getByText('holiday.jpg').waitFor();
	await expectNoA11yViolations(page);
});

test('the public demo', async ({ page }) => {
	await page.goto('/demo');
	await hydrated(page);
	await page.getByRole('button', { name: 'Open demo/sample_1' }).waitFor();
	await expectNoA11yViolations(page);
});

test('the demo viewer', async ({ page }) => {
	await page.goto('/demo');
	await hydrated(page);
	await page.getByRole('button', { name: 'Open demo/sample_1' }).click();
	await page.getByRole('dialog', { name: 'Photo viewer' }).waitFor();
	await expectNoA11yViolations(page);
});

test('the landing page', async ({ page }) => {
	await page.goto('/');
	await hydrated(page);
	await expectNoA11yViolations(page);
});
