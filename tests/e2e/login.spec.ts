import { expect, test } from '@playwright/test';
import { login, stubCdnImages } from './helpers';

test.beforeEach(async ({ page }) => stubCdnImages(page));

test('rejects a wrong password with a generic error', async ({ page }) => {
	await page.goto('/login');
	await page.getByPlaceholder('Family password').fill('nope');
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByRole('alert')).toHaveText('Incorrect password.');
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
	const input = page.getByPlaceholder('Family password');
	await expect(input).toHaveAttribute('type', 'password');
	await page.getByRole('button', { name: 'Show password' }).click();
	await expect(input).toHaveAttribute('type', 'text');
	await page.getByRole('button', { name: 'Hide password' }).click();
	await expect(input).toHaveAttribute('type', 'password');
});
