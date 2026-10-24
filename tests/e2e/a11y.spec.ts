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

test('the gallery with photos picked, and the shortcut for the ones not identified', async ({ page }) => {
	await login(page);
	await hydrated(page);
	await page.getByRole('button', { name: 'Sin identificar', exact: true }).click();
	await page.getByRole('button', { name: /sin identificar$/ }).waitFor();
	await expectNoA11yViolations(page);

	await page.getByRole('button', { name: /sin identificar$/ }).click();
	await page.getByRole('group', { name: 'Fotos seleccionadas' }).waitFor();
	await expectNoA11yViolations(page);
});

test('the bulk edit dialogs, for the year, the people and the description', async ({ page }) => {
	await login(page);
	await hydrated(page);
	await page.locator('label.pick').first().click();
	const bar = page.getByRole('group', { name: 'Fotos seleccionadas' });
	for (const [button, label] of [['Año…', 'Año'], ['Personas…', 'Añadir a todas'], ['Descripción…', 'Descripción']]) {
		await bar.getByRole('button', { name: button }).click();
		await page.getByRole('dialog', { name: 'Editar 1 foto' }).getByLabel(label).waitFor();
		await expectNoA11yViolations(page);
		await page.keyboard.press('Escape');
	}
});

test('the viewer', async ({ page }) => {
	await login(page);
	await hydrated(page);
	await page.getByRole('button', { name: 'Abrir Sample_001' }).click();
	await page.getByRole('dialog', { name: 'Visor de fotos' }).waitFor();
	await expectNoA11yViolations(page);
});

test('the viewer with the editor open, and again with an error showing', async ({ page }) => {
	await login(page);
	await hydrated(page);
	await page.getByRole('button', { name: /^Abrir Sample_002/ }).click();
	const viewer = page.getByRole('dialog', { name: 'Visor de fotos' });
	await viewer.getByRole('button', { name: 'Editar', exact: true }).click();
	await viewer.getByLabel('Descripción').waitFor();
	await expectNoA11yViolations(page);

	await viewer.getByLabel('Año').fill('abc');
	await viewer.getByRole('button', { name: 'Guardar' }).click();
	await viewer.getByRole('alert').waitFor();
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
