import { defineConfig, devices } from '@playwright/test';
import { hashPassword } from './src/lib/server/session';

const appEnv = {
	CLOUDINARY_CLOUD_NAME: 'testcloud',
	CLOUDINARY_API_KEY: 'test-key',
	CLOUDINARY_API_SECRET: 'test-secret',
	CLOUDINARY_API_BASE: 'http://127.0.0.1:9966',
	SESSION_SECRET: 'e2e-session-secret-0123456789-abcdef',
	FAMILY_PASSWORD_HASH: hashPassword('test-password')
};

export default defineConfig({
	testDir: 'tests/e2e',
	// Every test talks to the same Cloudinary mock and the same dev server (and its cached index), and
	// many reset or change what they share: in parallel they would trample one another's data.
	workers: 1,
	use: { baseURL: 'http://localhost:5199' },
	projects: [
		{ name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /mobile\.spec\.ts/ },
		// A phone-sized, touch-enabled Chromium: the family mostly looks at photos on their phones.
		{ name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /mobile\.spec\.ts/ }
	],
	webServer: [
		{
			command: 'node tests/e2e/mock-cloudinary.mjs',
			port: 9966,
			reuseExistingServer: !process.env.CI
		},
		{
			command: 'npm run dev -- --port 5199',
			port: 5199,
			env: appEnv,
			reuseExistingServer: false
		}
	]
});
