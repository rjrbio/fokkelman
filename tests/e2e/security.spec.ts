import { expect, test } from '@playwright/test';
import { login, stubCdnImages, viewerDialog } from './helpers';

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
	await page.getByRole('button', { name: 'Abrir Sample_001' }).click();
	await expect(viewerDialog(page)).toBeVisible();
	expect(violations).toEqual([]);
});

test.describe('without a session', () => {
	test('a percent-encoded /app is redirected to the login, not served', async ({ request }) => {
		const response = await request.get('/%61pp', { maxRedirects: 0 });
		expect(response.status()).toBe(303);
		expect(response.headers()['location']).toContain('/login');
	});

	test('a percent-encoded /api path is refused', async ({ request }) => {
		const response = await request.post('/%61pi/upload-signature', { data: { folder: '' } });
		expect(response.status()).toBe(401);
	});
});
