import AxeBuilder from '@axe-core/playwright';
import { expect, type Locator, type Page } from '@playwright/test';

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
	await page.getByLabel('Contraseña de la familia').fill('test-password');
	await page.getByRole('button', { name: 'Entrar' }).click();
	await page.waitForURL('**/app');
}

/** Resets the Cloudinary mock and the app's cached index. Call after `login` (the API needs a session). */
export async function resetBackend(page: Page): Promise<void> {
	const response = await fetch('http://127.0.0.1:9966/__reset', { method: 'POST' });
	if (!response.ok) throw new Error(`mock reset failed: ${response.status}`);
	await page.request.post('/api/refresh-index');
}

export const viewerDialog = (page: Page) => page.getByRole('dialog', { name: 'Visor de fotos' });

/** The ★ toggle of the open viewer (the top bar has its own "Favoritas" filter). */
export const starButton = (page: Page) =>
	viewerDialog(page).getByRole('button', { name: 'Favorita', exact: true });

export interface TouchPoint {
	x: number;
	y: number;
}

/**
 * Plays a multi-finger gesture with real touch events (Chromium only). Each step lists where every
 * finger is; an empty step lifts them all.
 */
export async function touchGesture(page: Page, steps: TouchPoint[][]): Promise<void> {
	const cdp = await page.context().newCDPSession(page);
	for (let i = 0; i < steps.length; i++) {
		const fingers = steps[i];
		const type = i === 0 ? 'touchStart' : fingers.length === 0 ? 'touchEnd' : 'touchMove';
		await cdp.send('Input.dispatchTouchEvent', {
			type,
			touchPoints: fingers.map((point, id) => ({ x: point.x, y: point.y, id }))
		});
	}
}

/** Puts a finger down on the middle of `target` (Chromium only) and gives back what lifts it, so a test can act while it is down. */
export async function holdFinger(page: Page, target: Locator): Promise<() => Promise<unknown>> {
	const box = await target.boundingBox();
	if (!box) throw new Error('nothing to press: the element has no box');
	const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
	const cdp = await page.context().newCDPSession(page);
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
	return () => cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

/** Presses a finger on the middle of `target` for `ms` and lifts it (Chromium only), as a long press does. */
export async function longPress(page: Page, target: Locator, ms = 700): Promise<void> {
	const lift = await holdFinger(page, target);
	await page.waitForTimeout(ms);
	await lift();
}

/**
 * Fails with a readable list when axe-core (the engine behind Lighthouse's accessibility score)
 * finds a WCAG 2.1 A/AA problem, or a heading/landmark slip, in what is on screen right now.
 */
export async function expectNoA11yViolations(page: Page): Promise<void> {
	const { violations } = await new AxeBuilder({ page })
		.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
		.analyze();
	const report = violations.map(
		(violation) =>
			`${violation.id} (${violation.impact}): ${violation.help}\n` +
			violation.nodes.map((node) => `    ${node.target.join(' ')}`).join('\n')
	);
	expect(report, report.join('\n')).toEqual([]);
}

/** What the Cloudinary mock has stored as the context of a photo (`undefined` when it has none). */
export async function storedContext(publicId: string): Promise<Record<string, string> | undefined> {
	const state = (await (await fetch('http://127.0.0.1:9966/__state')).json()) as {
		family: { public_id: string; context?: Record<string, string> }[];
	};
	const context = state.family.find((photo) => photo.public_id === publicId)?.context;
	return context && Object.keys(context).length > 0 ? context : undefined;
}

/**
 * Sets the context of a photo straight in the Cloudinary mock, as if somebody had edited it by hand in the
 * Media Library: the app does not know, and what it has cached stays as it was.
 */
export async function editContextByHand(publicId: string, context: Record<string, string>): Promise<void> {
	const response = await fetch('http://127.0.0.1:9966/__context', {
		method: 'POST',
		body: JSON.stringify({ publicId, context })
	});
	if (!response.ok) throw new Error(`mock context edit failed: ${response.status}`);
}
