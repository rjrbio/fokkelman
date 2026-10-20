import { expect, test } from '@playwright/test';
import { login, resetBackend, stubCdnImages, viewerDialog } from './helpers';

test.beforeEach(async ({ page }) => {
	await stubCdnImages(page);
	await login(page);
	await resetBackend(page);
	const annotate = (publicIds: string[], patch: object) => page.request.post('/api/annotate', { data: { publicIds, patch } });
	await annotate(['Sample_010'], { caption: 'Cumpleaños de María', year: 1990, addPeople: ['María', 'Luis'] });
	await annotate(['Sample_011'], { year: 1985 });
	await annotate(['Sample_012'], { year: 1990 });
	await page.reload();
	await page.waitForLoadState('networkidle'); // hydration
});

// The years written here stay in the mock, which the other specs share, and the gallery goes by year: put it back as it was.
test.afterEach(async ({ page }) => {
	await resetBackend(page);
});

const cells = (page: import('@playwright/test').Page) => page.getByTestId('photo-grid').getByRole('button');

test('the gallery goes by year, oldest first, and the photos with no year come last', async ({ page }) => {
	await expect(cells(page).nth(0)).toHaveAccessibleName('Abrir Sample_011: 1985');
	await expect(cells(page).nth(1)).toHaveAccessibleName('Abrir Sample_010: Cumpleaños de María, 1990');
	await expect(cells(page).nth(2)).toHaveAccessibleName('Abrir Sample_012: 1990');
	await expect(cells(page).nth(3)).toHaveAccessibleName('Abrir Sample_001');
});

test('shows the year on the photo, and nothing on the photos that have none', async ({ page }) => {
	await expect(cells(page).nth(0)).toContainText('1985');
	await expect(page.getByRole('button', { name: 'Abrir Sample_001' })).not.toContainText(/\d{4}/);
});

test('finds a photo by what was written about it, whatever the accents', async ({ page }) => {
	await page.getByRole('searchbox', { name: 'Buscar fotos' }).fill('maria cumpleanos');

	await expect(page.getByText('1 foto', { exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: /^Abrir Sample_010/ })).toBeVisible();
});

test('finds photos by year, and by several words at once', async ({ page }) => {
	const search = page.getByRole('searchbox', { name: 'Buscar fotos' });
	await search.fill('1990');
	await expect(page.getByText('2 fotos', { exact: true })).toBeVisible();

	await search.fill('luis 1985');
	await expect(page.getByText('Ninguna foto coincide con los filtros.')).toBeVisible();
});

test('the viewer moves through the photos in the same order as the gallery', async ({ page }) => {
	await page.getByRole('button', { name: /^Abrir Sample_011/ }).click();
	await expect(viewerDialog(page).getByText('Foto 1 de 80')).toBeVisible();

	await page.keyboard.press('ArrowRight');

	await expect(page).toHaveURL(/\/app\/photo\/Sample_010$/);
});
