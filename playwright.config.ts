import { defineConfig } from '@playwright/test';
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
	use: { baseURL: 'http://localhost:5199' },
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
