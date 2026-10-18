import { expect, test, type Page } from '@playwright/test';
import { login, resetBackend, starButton, stubCdnImages, viewerDialog } from './helpers';

async function openGallery(page: Page) {
	await stubCdnImages(page);
	await login(page);
	await resetBackend(page);
	await page.reload();
	// The dev server serves an unbundled module graph; wait for it to settle so the
	// client has hydrated (and the grid button's click handler is actually wired up)
	// before interacting, otherwise the very first click can land on dead HTML.
	await page.waitForLoadState('networkidle');
}

const closeViewer = (page: Page) => page.getByRole('button', { name: 'Cerrar visor' }).click();

test('marks a photo as favorite and finds it with the filter', async ({ page }) => {
	await openGallery(page);

	await page.getByRole('button', { name: 'Abrir Sample_001' }).click();
	await starButton(page).click();
	await expect(starButton(page)).toHaveAttribute('aria-pressed', 'true');

	await closeViewer(page);
	await page.getByRole('button', { name: '★ Favorites' }).click();
	await expect(page.getByText('1 photos')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Abrir Sample_001' })).toBeVisible();
});

test('toggling a favorite does not reload the photo index', async ({ page }) => {
	await openGallery(page);
	await page.getByRole('button', { name: 'Abrir Sample_001' }).click();
	await expect(viewerDialog(page)).toBeVisible();

	const reloads: string[] = [];
	page.on('request', (request) => {
		if (request.url().includes('__data.json')) reloads.push(request.url());
	});
	await starButton(page).click();
	await expect(starButton(page)).toHaveAttribute('aria-pressed', 'true');
	await page.waitForTimeout(500);

	expect(reloads).toEqual([]);
});

test('favoriting deep in the grid keeps the loaded photos and the scroll position', async ({
	page
}) => {
	await openGallery(page);
	const cells = page.getByTestId('photo-grid').getByRole('button');
	await page.getByTestId('grid-sentinel').scrollIntoViewIfNeeded();
	await expect(cells).toHaveCount(80);

	await page.getByRole('button', { name: 'Abrir Sample_075' }).click();
	await starButton(page).click();
	await expect(starButton(page)).toHaveAttribute('aria-pressed', 'true');
	await closeViewer(page);

	await expect(cells).toHaveCount(80);
	await expect(page.getByRole('button', { name: 'Abrir Sample_075' })).toBeInViewport();
});

test('a double tap on the star sends one request and ends up favorited', async ({ page }) => {
	await openGallery(page);
	await page.getByRole('button', { name: 'Abrir Sample_002' }).click();

	let requests = 0;
	page.on('request', (request) => {
		if (request.url().endsWith('/api/favorite')) requests++;
	});
	await starButton(page).dblclick();
	await page.waitForTimeout(500);

	await expect(starButton(page)).toHaveAttribute('aria-pressed', 'true');
	expect(requests).toBe(1);
});

test('an expired session while the viewer is open sends the user back to sign in', async ({
	page,
	context
}) => {
	await openGallery(page);
	await page.getByRole('button', { name: 'Abrir Sample_003' }).click();
	await expect(viewerDialog(page)).toBeVisible();

	await context.clearCookies();
	await starButton(page).click();

	await page.waitForURL(/\/login\?next=%2Fapp%2Fphoto%2FSample_003/);
});

test('un-starring from the favorites view keeps the viewer open on that photo', async ({
	page
}) => {
	await openGallery(page);
	await page.getByRole('button', { name: 'Abrir Sample_004' }).click();
	await starButton(page).click();
	await expect(starButton(page)).toHaveAttribute('aria-pressed', 'true');
	await closeViewer(page);

	await page.getByRole('button', { name: '★ Favorites' }).click();
	await page.getByRole('button', { name: 'Abrir Sample_004' }).click();
	await expect(viewerDialog(page)).toBeVisible();

	await starButton(page).click();
	await expect(starButton(page)).toHaveAttribute('aria-pressed', 'false');
	await expect(viewerDialog(page)).toBeVisible();
	await expect(page.getByText('Foto no encontrada.')).toHaveCount(0);

	await closeViewer(page);
	await expect(page.getByText('Ninguna foto coincide con los filtros.')).toBeVisible();
});

test('a failed save rolls the star back and the message outlives the viewer', async ({ page }) => {
	await openGallery(page);
	await page.route('**/api/favorite', (route) => route.fulfill({ status: 500 }));
	await page.getByRole('button', { name: 'Abrir Sample_005' }).click();
	await starButton(page).click();

	const alert = page.getByRole('alert');
	await expect(alert).toHaveText('No se pudo actualizar el favorito de Sample_005. Inténtalo de nuevo.');
	await expect(starButton(page)).toHaveAttribute('aria-pressed', 'false');

	await closeViewer(page);
	await expect(viewerDialog(page)).toHaveCount(0);
	await expect(alert).toBeVisible();
});
