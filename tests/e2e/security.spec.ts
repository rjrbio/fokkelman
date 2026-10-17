import { expect, test } from '@playwright/test';
import { login, stubCdnImages } from './helpers';

test('the login page ships the security headers and a CSP', async ({ page }) => {
	const response = await page.goto('/login');
	const headers = response!.headers();
	expect(headers['x-frame-options']).toBe('DENY');
	expect(headers['x-robots-tag']).toContain('noindex');
	expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
	expect(headers['content-security-policy']).toContain('https://res.cloudinary.com');
});

test('the gallery and the viewer run without Content-Security-Policy violations', async ({
	page
}) => {
	const violations: string[] = [];
	page.on('console', (message) => {
		if (message.text().includes('Content Security Policy')) violations.push(message.text());
	});
	await stubCdnImages(page);
	await login(page);
	await page.waitForLoadState('networkidle'); // hydration
	await page.getByRole('button', { name: 'Open Sample_001' }).click();
	await expect(page.getByRole('dialog', { name: 'Photo viewer' })).toBeVisible();
	expect(violations).toEqual([]);
});
