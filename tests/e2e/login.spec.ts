import { expect, test, type Page } from '@playwright/test';
import { login, stubCdnImages } from './helpers';

test.beforeEach(async ({ page }) => stubCdnImages(page));

/**
 * Answers the sign-in form action with a canned failure. The form has no explicit action, so
 * `use:enhance` POSTs (fetch) to `/login` itself; the body is the devalue-encoded envelope
 * SvelteKit sends: a JSON string holding the form data. Page loads of `/login` pass through.
 */
async function stubLoginFailure(page: Page, status: number, devalueData: string): Promise<void> {
	await page.route(
		(url) => url.pathname === '/login',
		(route) =>
			route.request().method() === 'POST'
				? route.fulfill({
						contentType: 'application/json',
						body: JSON.stringify({ type: 'failure', status, data: devalueData })
					})
				: route.continue()
	);
}

test('rejects a wrong password with a generic error', async ({ page }) => {
	await page.goto('/login');
	await page.getByLabel('Contraseña de la familia').fill('nope');
	await page.getByRole('button', { name: 'Entrar' }).click();
	await expect(page.getByRole('alert')).toHaveText('Contraseña incorrecta.');
	expect(page.url()).toContain('/login');
});

test('signs in with the family password and lands on the gallery', async ({ page }) => {
	await login(page);
	await expect(page.getByText('80 photos')).toBeVisible();
});

test('redirects an anonymous visitor from /app to /login', async ({ page }) => {
	await page.goto('/app');
	await page.waitForURL('**/login?next=%2Fapp');
});

test('the password can be revealed and hidden', async ({ page }) => {
	await page.goto('/login');
	await page.waitForLoadState('networkidle'); // wait for hydration before clicking
	const input = page.getByLabel('Contraseña de la familia');
	await expect(input).toHaveAttribute('type', 'password');
	await page.getByRole('button', { name: 'Mostrar contraseña' }).click();
	await expect(input).toHaveAttribute('type', 'text');
	await page.getByRole('button', { name: 'Ocultar contraseña' }).click();
	await expect(input).toHaveAttribute('type', 'password');
});

test('says sign-in is unavailable, and disables the button, when the server is not configured', async ({
	page
}) => {
	await stubLoginFailure(page, 503, '[{"misconfigured":1},true]');
	await page.goto('/login');
	await page.waitForLoadState('networkidle'); // wait for hydration before submitting
	await page.getByLabel('Contraseña de la familia').fill('any-password');
	await page.getByRole('button', { name: 'Entrar' }).click();
	await expect(page.getByRole('alert')).toHaveText(
		'No se puede entrar ahora: el servidor aún no está configurado.'
	);
	await expect(page.getByRole('button', { name: 'Entrar' })).toBeDisabled();
});

test('tells a locked-out visitor how long to wait', async ({ page }) => {
	await stubLoginFailure(page, 429, '[{"locked":1,"retryAfterMin":2},true,2]');
	await page.goto('/login');
	await page.waitForLoadState('networkidle'); // wait for hydration before submitting
	await page.getByLabel('Contraseña de la familia').fill('any-password');
	await page.getByRole('button', { name: 'Entrar' }).click();
	await expect(page.getByRole('alert')).toHaveText('Demasiados intentos. Vuelve a probar en 2 min.');
	await expect(page.getByRole('alert')).toHaveCount(1);
	await expect(page.getByRole('button', { name: 'Entrar' })).toBeEnabled();
});
