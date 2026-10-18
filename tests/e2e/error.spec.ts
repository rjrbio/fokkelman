import { expect, test } from '@playwright/test';
import { login, stubCdnImages } from './helpers';

test.beforeEach(async ({ page }) => stubCdnImages(page));

test('says so in plain Spanish when the photo library cannot be loaded', async ({ page }) => {
	await page.goto('/login');
	await page.waitForLoadState('networkidle'); // hydration
	// Signing in navigates to /app on the client, which asks the server for the layout data.
	await page.route('**/app/__data.json*', (route) =>
		route.fulfill({
			status: 500,
			contentType: 'application/json',
			body: JSON.stringify({ message: 'Internal Error' })
		})
	);
	await page.getByLabel('Contraseña de la familia').fill('test-password');
	await page.getByRole('button', { name: 'Entrar' }).click();

	await expect(page.getByRole('heading', { name: 'Algo ha ido mal' })).toBeVisible();
	await expect(page.getByText('La biblioteca de fotos no está disponible ahora mismo.')).toBeVisible();
	await expect(page.getByRole('link', { name: 'Reintentar' })).toHaveAttribute('href', '/app');
});

test('an unknown page inside the family area is a Spanish 404', async ({ page }) => {
	await login(page);
	const response = await page.goto('/app/nada-por-aqui');
	expect(response!.status()).toBe(404);
	await expect(page.getByRole('heading', { name: 'No encontramos esta página' })).toBeVisible();
	await expect(page.locator('html')).toHaveAttribute('lang', 'es');
});

test('an unknown public page is an English 404', async ({ page }) => {
	const response = await page.goto('/nothing-here');
	expect(response!.status()).toBe(404);
	await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Back to the start' })).toHaveAttribute('href', '/');
});
