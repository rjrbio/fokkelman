import type { Page } from '@playwright/test';

const TINY_PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
	'base64'
);

export async function stubCdnImages(page: Page): Promise<void> {
	await page.route('https://res.cloudinary.com/**', (route) =>
		route.fulfill({ contentType: 'image/png', body: TINY_PNG })
	);
}

export async function login(page: Page): Promise<void> {
	await page.goto('/login');
	await page.getByPlaceholder('Family password').fill('test-password');
	await page.getByRole('button', { name: 'Sign in' }).click();
	await page.waitForURL('**/app');
}
