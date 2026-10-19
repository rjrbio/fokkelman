import { expect, test, type Page } from '@playwright/test';
import {
	expectNoA11yViolations,
	login,
	starButton,
	stubCdnImages,
	touchGesture,
	viewerDialog
} from './helpers';

// Runs in the "mobile" project (see playwright.config.ts): a 412×839 touch screen.

const TOTAL = 80;

test.beforeEach(async ({ page }) => {
	await stubCdnImages(page);
	await login(page);
	await page.waitForLoadState('networkidle'); // hydration
});

const tabs = (page: Page) => page.getByRole('navigation', { name: 'Navegación principal' });

test('fits the screen: no sideways scroll, phone controls instead of the desktop ones', async ({
	page
}) => {
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(overflow).toBeLessThanOrEqual(0);

	await expect(tabs(page)).toBeVisible();
	await expect(tabs(page).getByRole('link', { name: 'Fotos' })).toHaveAttribute('aria-current', 'page');
	await expect(page.getByRole('button', { name: 'Opciones' })).toBeVisible();
	await expect(page.getByLabel('Colección')).toBeHidden(); // it lives in the options sheet
	await expect(page.getByRole('button', { name: 'Salir' })).toHaveCount(0);
	await expect(page.getByRole('searchbox', { name: 'Buscar fotos' })).toBeHidden();
	await expect(page.getByText('80 fotos')).toBeVisible();
});

test('every control is at least 44px, the size of a fingertip', async ({ page }) => {
	const { checked, small } = await page.evaluate(() => {
		const controls = [
			...document.querySelectorAll<HTMLElement>('header button, header a, nav button, nav a')
		].filter((el) => el.getClientRects().length > 0 && !el.closest('.sr-only'));
		const measured = controls.map((el) => ({
			name: el.getAttribute('aria-label') ?? el.textContent?.trim() ?? '',
			box: el.getBoundingClientRect()
		}));
		return {
			checked: measured.map(({ name }) => name),
			small: measured
				.filter(({ box }) => box.width < 44 || box.height < 44)
				.map(({ name, box }) => `${name}: ${Math.round(box.width)}×${Math.round(box.height)}`)
		};
	});
	// The brand link, search, options and the four tabs: without this, a selector that matches nothing
	// would make the test pass vacuously.
	expect(checked.length, `measured: ${JSON.stringify(checked)}`).toBeGreaterThanOrEqual(7);
	expect(small).toEqual([]);
});

test('rows are shorter on a phone, so a few photos fit side by side', async ({ page }) => {
	const rows = await page
		.getByTestId('photo-row')
		.evaluateAll((all) => all.map((row) => ({ height: row.getBoundingClientRect().height, photos: row.children.length })));
	expect(rows.length).toBeGreaterThan(3);
	for (const row of rows.slice(0, -1)) {
		expect(row.height).toBeGreaterThan(80);
		expect(row.height).toBeLessThan(180);
		expect(row.photos).toBeGreaterThanOrEqual(2);
	}
});

test('the tab bar does not cover the last row of photos', async ({ page }) => {
	// Same technique as `loadEverything` in gallery.spec.ts: keep scrolling the sentinel into view
	// until every row of the library is in the page.
	const cells = page.getByTestId('photo-grid').getByRole('button');
	const sentinel = page.getByTestId('grid-sentinel');
	await expect(async () => {
		if (await sentinel.count()) await sentinel.scrollIntoViewIfNeeded();
		await expect(cells).toHaveCount(TOTAL, { timeout: 1000 });
	}).toPass();

	// Scroll to the very bottom and wait until the last row has stopped moving.
	const lastRow = page.getByTestId('photo-row').last();
	let previous = -1;
	await expect
		.poll(async () => {
			await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
			const box = (await lastRow.boundingBox())!;
			const bottom = Math.round(box.y + box.height);
			const settled = bottom === previous;
			previous = bottom;
			return settled;
		})
		.toBe(true);

	const row = (await lastRow.boundingBox())!;
	const bar = (await tabs(page).boundingBox())!;
	// 2px of tolerance: a 1px gap at the border of the bar is fine, a covered photo is not.
	expect(row.y + row.height).toBeLessThanOrEqual(bar.y + 2);
});

test('the search folds away until asked for, from the bar or from the tabs', async ({ page }) => {
	const search = page.getByRole('searchbox', { name: 'Buscar fotos' });

	await page.getByRole('button', { name: 'Buscar fotos' }).tap();
	await expect(search).toBeVisible();
	await expect(search).toBeFocused();
	await search.fill('Sample_07');
	await expect(page.getByText('10 fotos')).toBeVisible();

	await search.fill('');
	await page.getByRole('button', { name: 'Buscar fotos' }).tap(); // fold it again
	await expect(search).toBeHidden();

	await tabs(page).getByRole('button', { name: 'Buscar' }).tap();
	await expect(search).toBeFocused();
});

test('the favorites tab filters, and Fotos clears it', async ({ page }) => {
	const favorites = tabs(page).getByRole('button', { name: 'Favoritas' });
	await favorites.tap();
	await expect(favorites).toHaveAttribute('aria-pressed', 'true');
	await expect(page).toHaveURL(/[?&]fav=1/);

	await tabs(page).getByRole('link', { name: 'Fotos' }).tap();
	await expect(page).not.toHaveURL(/fav=1/);
	await expect(favorites).toHaveAttribute('aria-pressed', 'false');
});

test('the options sheet holds the collection and the log out button', async ({ page }) => {
	const opener = page.getByRole('button', { name: 'Opciones' });
	await opener.tap();
	const sheet = page.getByRole('dialog', { name: 'Opciones' });
	await expect(sheet).toBeVisible();
	await expect(sheet.getByLabel('Colección')).toBeVisible();
	await expect(sheet.getByRole('button', { name: 'Salir' })).toBeVisible();

	await page.keyboard.press('Escape');
	await expect(sheet).toHaveCount(0);
	await expect(opener).toBeFocused();
});

test('the upload tab opens a dialog that fits the screen', async ({ page }) => {
	await tabs(page).getByRole('button', { name: 'Subir' }).tap();
	const dialog = page.getByRole('dialog', { name: 'Subir fotos' });
	await expect(dialog).toBeVisible();
	const box = (await dialog.boundingBox())!;
	expect(box.x).toBeGreaterThanOrEqual(0);
	expect(box.x + box.width).toBeLessThanOrEqual(412);
});

test.describe('viewer', () => {
	test.beforeEach(async ({ page }) => {
		await page.getByRole('button', { name: 'Abrir Sample_001' }).tap();
		await expect(viewerDialog(page)).toBeVisible();
	});

	test('stacks the photo above a sheet with the details', async ({ page }) => {
		const stage = (await page.getByTestId('zoomable').boundingBox())!;
		const sheet = (await viewerDialog(page).getByRole('group').boundingBox())!;

		expect(sheet.y).toBeGreaterThanOrEqual(stage.y + stage.height - 1);
		expect(sheet.width).toBeGreaterThan(400);
		expect(stage.height).toBeGreaterThan(839 * 0.4);
		await expect(starButton(page)).toBeVisible();
	});

	test('a double tap goes full screen and a tap comes back', async ({ page }) => {
		const box = (await page.getByTestId('zoomable').boundingBox())!;
		const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

		await page.touchscreen.tap(centre.x, centre.y);
		await page.touchscreen.tap(centre.x, centre.y);
		await expect(viewerDialog(page)).toHaveAttribute('data-immersive', 'true');
		await expect(viewerDialog(page).getByRole('group')).toHaveCount(0);

		await page.touchscreen.tap(centre.x, centre.y);
		await expect(viewerDialog(page)).toHaveAttribute('data-immersive', 'false');
	});

	test('pinching zooms in and a swipe moves to the next photo', async ({ page }) => {
		const box = (await page.getByTestId('zoomable').boundingBox())!;
		const cx = box.x + box.width / 2;
		const cy = box.y + box.height / 2;

		await touchGesture(page, [
			[{ x: cx - 30, y: cy }, { x: cx + 30, y: cy }],
			[{ x: cx - 60, y: cy }, { x: cx + 60, y: cy }],
			[{ x: cx - 120, y: cy }, { x: cx + 120, y: cy }],
			[]
		]);
		await expect
			.poll(async () => Number(await page.getByTestId('zoomable').getAttribute('data-scale')))
			.toBeGreaterThan(1.5);

		await page.keyboard.press('0'); // back to the normal size, where a swipe is a swipe
		await expect(page.getByTestId('zoomable')).toHaveAttribute('data-scale', '1.00');
		await touchGesture(page, [[{ x: cx + 100, y: cy }], [{ x: cx, y: cy }], [{ x: cx - 100, y: cy }], []]);
		await expect(page).toHaveURL(/\/app\/photo\/Sample_002$/);
	});
});

test.describe('accessibility on a phone', () => {
	test('the gallery with the search open', async ({ page }) => {
		await page.getByRole('button', { name: 'Buscar fotos' }).tap();
		await expect(page.getByRole('searchbox', { name: 'Buscar fotos' })).toBeVisible();
		await expectNoA11yViolations(page);
	});

	test('the options sheet', async ({ page }) => {
		await page.getByRole('button', { name: 'Opciones' }).tap();
		await expect(page.getByRole('dialog', { name: 'Opciones' })).toBeVisible();
		await expectNoA11yViolations(page);
	});

	test('the viewer', async ({ page }) => {
		await page.getByRole('button', { name: 'Abrir Sample_001' }).tap();
		await expect(viewerDialog(page)).toBeVisible();
		await expectNoA11yViolations(page);
	});
});
