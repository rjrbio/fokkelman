import { expect, test } from '@playwright/test';
import { expectNoA11yViolations, login, resetBackend, storedContext, stubCdnImages, viewerDialog } from './helpers';

// While Cloudinary's budget of calls for the hour is spent, the mock answers 420 (as the Admin API does) to the
// search and to the read of the contexts.
const setRateLimit = (on: boolean) =>
	fetch('http://127.0.0.1:9966/__rate-limit', { method: 'POST', body: JSON.stringify({ on }) });

test.beforeEach(async ({ page }) => {
	await stubCdnImages(page);
	await login(page);
	await resetBackend(page);
});

test.afterEach(async ({ page }) => {
	await setRateLimit(false);
	await resetBackend(page);
});

test('with no copy of the photos to show, says in words that the hour\'s calls are spent, and works again after', async ({ page }) => {
	await setRateLimit(true);
	const response = await page.goto('/app'); // the index was just cleared by the reset: nothing to fall back on

	expect(response?.status()).toBe(503);
	await expect(page.getByRole('heading', { name: 'Algo ha ido mal' })).toBeVisible();
	await expect(page.getByText('ha llegado a su límite de peticiones por hora')).toBeVisible();
	await expectNoA11yViolations(page);

	await setRateLimit(false);
	await page.getByRole('link', { name: 'Reintentar' }).click();
	await expect(page.getByRole('button', { name: 'Abrir Sample_001' })).toBeVisible();
});

test('saving says so when the calls are spent, and writes nothing', async ({ page }) => {
	await page.reload();
	await page.waitForLoadState('networkidle'); // hydration
	await page.getByRole('button', { name: /^Abrir Sample_001/ }).click();
	const viewer = viewerDialog(page);
	await viewer.getByRole('button', { name: 'Editar', exact: true }).click();
	await viewer.getByLabel('Descripción').fill('No se guarda');
	await setRateLimit(true);

	await viewer.getByRole('button', { name: 'Guardar' }).click();

	await expect(page.getByRole('alert').filter({ hasText: 'límite de peticiones por hora' })).toBeVisible();
	await expect(viewer.getByLabel('Descripción')).toHaveValue('No se guarda'); // the form stays, to try again
	expect(await storedContext('Sample_001')).toBeUndefined();
});
