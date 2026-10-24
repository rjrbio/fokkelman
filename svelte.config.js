import adapter from '@sveltejs/adapter-netlify';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// `vite dev` needs websockets for HMR; production does not. Fail closed: only an explicit
// `development` gets the relaxation, any other value (production, staging, unset) is strict.
const dev = process.env.NODE_ENV === 'development';

/** @type {Array<'ws:'>} */
const devConnectSrc = dev ? ['ws:'] : [];

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter(),
		csp: {
			mode: 'auto',
			directives: {
				'default-src': ['self'],
				'script-src': ['self'],
				'style-src': ['self', 'unsafe-inline'],
				'img-src': ['self', 'data:', 'https://res.cloudinary.com'],
				'font-src': ['self'],
				'connect-src': ['self', 'https://api.cloudinary.com', 'https://res.cloudinary.com', ...devConnectSrc],
				'object-src': ['none'],
				'base-uri': ['self'],
				'form-action': ['self'],
				'frame-ancestors': ['none']
			}
		}
	}
};

export default config;
