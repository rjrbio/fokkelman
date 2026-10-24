import { expect, test, type Page } from '@playwright/test';
import { login, resetBackend, storedFavorites, stubCdnImages } from './helpers';

test.beforeEach(async ({ page }) => {
	await stubCdnImages(page);
	await login(page);
	await resetBackend(page);
	await page.reload();
	await page.waitForLoadState('networkidle'); // hydration
});

test.afterEach(async ({ page }) => {
	await resetBackend(page);
});

const bar = (page: Page) => page.getByRole('group', { name: 'Fotos seleccionadas' });
const box = (page: Page, name: string) =>
	page.locator('label.pick', { has: page.getByRole('checkbox', { name: `Seleccionar ${name}` }) });

test('marks every photo picked as a favorite, and the button turns into the one that takes it off', async ({ page }) => {
	for (const name of ['Sample_001', 'Sample_002', 'Sample_003']) await box(page, name).click();

	await bar(page).getByRole('button', { name: 'Marcar como favoritas' }).click();

	await expect(bar(page).getByRole('button', { name: 'Quitar de favoritas' })).toBeVisible();
	await expect.poll(storedFavorites).toEqual(['Sample_001', 'Sample_002', 'Sample_003']);
	await expect(page.getByTestId('photo-grid').locator('.star')).toHaveCount(3);

	await bar(page).getByRole('button', { name: 'Quitar de favoritas' }).click();

	await expect(bar(page).getByRole('button', { name: 'Marcar como favoritas' })).toBeVisible();
	await expect.poll(storedFavorites).toEqual([]);
	await expect(page.getByTestId('photo-grid').locator('.star')).toHaveCount(0);
});

test('with some of the photos favorite already, it marks the rest instead of taking them all off', async ({ page }) => {
	await page.request.post('/api/favorites', { data: { publicIds: ['Sample_001'], favorite: true } });
	await page.reload();
	await page.waitForLoadState('networkidle');
	for (const name of ['Sample_001', 'Sample_002']) await box(page, name).click();

	await bar(page).getByRole('button', { name: 'Marcar como favoritas' }).click();

	await expect.poll(storedFavorites).toEqual(['Sample_001', 'Sample_002']);
});

test('when it fails it says so and takes the change back', async ({ page }) => {
	await page.route('**/api/favorites', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }));
	for (const name of ['Sample_001', 'Sample_002']) await box(page, name).click();

	await bar(page).getByRole('button', { name: 'Marcar como favoritas' }).click();

	await expect(page.getByRole('alert').filter({ hasText: 'No se pudo actualizar el favorito de 2 fotos' })).toBeVisible();
	await expect(page.getByTestId('photo-grid').locator('.star')).toHaveCount(0);
	await expect(bar(page).getByRole('button', { name: 'Marcar como favoritas' })).toBeVisible();
	expect(await storedFavorites()).toEqual([]);
});
