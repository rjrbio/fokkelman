import { expect, test, type Page } from '@playwright/test';
import { login, stubCdnImages } from './helpers';

const TOTAL = 80;

/** Scrolls to the end of the loaded rows until the whole library is in the page. */
async function loadEverything(page: Page) {
	const cells = page.getByTestId('photo-grid').getByRole('button');
	const sentinel = page.getByTestId('grid-sentinel');
	await expect(async () => {
		if (await sentinel.count()) await sentinel.scrollIntoViewIfNeeded();
		await expect(cells).toHaveCount(TOTAL, { timeout: 1000 });
	}).toPass();
}

test.beforeEach(async ({ page }) => {
	await stubCdnImages(page);
	await login(page);
});

test('loads a first batch of rows and grows on scroll until everything is there', async ({
	page
}) => {
	const cells = page.getByTestId('photo-grid').getByRole('button');
	await expect(cells.first()).toBeVisible();
	const first = await cells.count();
	expect(first).toBeGreaterThan(0);
	expect(first).toBeLessThan(TOTAL);

	await loadEverything(page);
});

test('rows are justified: every row but the last spans the full width, with no cropping', async ({
	page
}) => {
	await loadEverything(page);

	const geometry = await page.getByTestId('photo-grid').evaluate((grid) => {
		const gridBox = grid.getBoundingClientRect();
		return [...grid.querySelectorAll('[data-testid="photo-row"]')].map((row) => {
			const cells = [...row.children].map((cell) => cell.getBoundingClientRect());
			return {
				left: cells[0].left - gridBox.left,
				right: gridBox.right - cells[cells.length - 1].right,
				heights: cells.map((box) => box.height)
			};
		});
	});

	expect(geometry.length).toBeGreaterThan(2);
	for (const row of geometry.slice(0, -1)) {
		expect(Math.abs(row.left)).toBeLessThan(1);
		expect(Math.abs(row.right)).toBeLessThan(1);
	}
	for (const row of geometry) {
		expect(new Set(row.heights.map((h) => Math.round(h))).size).toBe(1); // equal heights in a row
	}
});

test('each photo is drawn with its own shape: vertical ones are narrower than horizontal ones', async ({
	page
}) => {
	// Sample_004 is vertical (600×800), Sample_001 horizontal (800×600).
	const vertical = await page.getByRole('button', { name: 'Abrir Sample_004' }).boundingBox();
	const horizontal = await page.getByRole('button', { name: 'Abrir Sample_001' }).boundingBox();
	expect(vertical!.width).toBeLessThan(vertical!.height);
	expect(horizontal!.width).toBeGreaterThan(horizontal!.height);
});
