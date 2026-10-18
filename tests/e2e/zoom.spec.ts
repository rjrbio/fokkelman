import { expect, test, type Page } from '@playwright/test';
import { login, stubCdnImages, viewerDialog } from './helpers';

const zoomable = (page: Page) => page.getByTestId('zoomable');
const scale = async (page: Page) => Number(await zoomable(page).getAttribute('data-scale'));

async function openFirstPhoto(page: Page) {
	await page.getByRole('button', { name: 'Abrir Sample_001' }).click();
	await expect(viewerDialog(page)).toBeVisible();
	await expect(zoomable(page)).toHaveAttribute('data-scale', '1.00');
}

async function pointAtCentre(page: Page) {
	const box = (await zoomable(page).boundingBox())!;
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
}

test.beforeEach(async ({ page }) => {
	await stubCdnImages(page);
	await login(page);
	await page.waitForLoadState('networkidle'); // hydration
});

test.describe('zoom', () => {
	test('the wheel zooms in and out, and the bigger picture is fetched only once zoomed', async ({
		page
	}) => {
		const requested: string[] = [];
		page.on('request', (request) => requested.push(request.url()));
		await openFirstPhoto(page);
		expect(requested.some((url) => url.includes('w_2400'))).toBe(false);

		await pointAtCentre(page);
		await page.mouse.wheel(0, -400);
		await expect.poll(() => scale(page)).toBeGreaterThan(1);
		await expect.poll(() => requested.some((url) => url.includes('w_2400/Sample_001'))).toBe(true);

		await page.mouse.wheel(0, 4000);
		await expect.poll(() => scale(page)).toBe(1);
	});

	test('the keyboard zooms in and out, and 0 starts over', async ({ page }) => {
		await openFirstPhoto(page);

		await page.keyboard.press('+');
		await expect(zoomable(page)).toHaveAttribute('data-scale', '1.25');
		await page.keyboard.press('+');
		await expect(zoomable(page)).toHaveAttribute('data-scale', '1.56');
		await page.keyboard.press('-');
		await expect(zoomable(page)).toHaveAttribute('data-scale', '1.25');
		await page.keyboard.press('0');
		await expect(zoomable(page)).toHaveAttribute('data-scale', '1.00');
	});

	test('a zoomed photo can be dragged, and a drag at the normal size changes nothing', async ({
		page
	}) => {
		await openFirstPhoto(page);
		await pointAtCentre(page);
		await page.mouse.down();
		await page.mouse.move(400, 300, { steps: 4 });
		await page.mouse.up();
		await expect(zoomable(page)).toHaveAttribute('data-x', '0');
		await expect(page).toHaveURL(/\/app\/photo\/Sample_001$/); // a mouse drag is not a swipe

		await page.keyboard.press('+');
		await page.keyboard.press('+');
		await page.keyboard.press('+');
		await pointAtCentre(page);
		await page.mouse.down();
		await page.mouse.move(500, 360, { steps: 4 });
		await page.mouse.up();
		expect(Number(await zoomable(page).getAttribute('data-x'))).not.toBe(0);
	});

	test('going to another photo starts it fitted', async ({ page }) => {
		await openFirstPhoto(page);
		await page.keyboard.press('+');
		await expect(zoomable(page)).toHaveAttribute('data-scale', '1.25');

		await page.keyboard.press('ArrowRight');
		await expect(page).toHaveURL(/\/app\/photo\/Sample_002$/);
		await expect(zoomable(page)).toHaveAttribute('data-scale', '1.00');
	});
});

test.describe('full screen', () => {
	const viewer = (page: Page) => viewerDialog(page);
	const panel = (page: Page) => viewer(page).getByRole('heading', { name: 'Detalles' });

	test('F hides the panel and Esc brings it back instead of closing the viewer', async ({ page }) => {
		await openFirstPhoto(page);
		await expect(panel(page)).toBeVisible();

		await page.keyboard.press('f');
		await expect(viewer(page)).toHaveAttribute('data-immersive', 'true');
		await expect(panel(page)).toHaveCount(0);
		await expect(viewer(page).getByRole('button', { name: 'Salir de pantalla completa' })).toBeFocused();

		await page.keyboard.press('Escape');
		await expect(viewer(page)).toHaveAttribute('data-immersive', 'false');
		await expect(panel(page)).toBeVisible();
		await expect(viewer(page).getByRole('button', { name: 'Pantalla completa' })).toBeFocused();

		await page.keyboard.press('Escape');
		await expect(viewer(page)).toHaveCount(0);
	});

	test('the buttons enter and leave it', async ({ page }) => {
		await openFirstPhoto(page);
		await viewer(page).getByRole('button', { name: 'Pantalla completa' }).click();
		await expect(viewer(page)).toHaveAttribute('data-immersive', 'true');

		await viewer(page).getByRole('button', { name: 'Salir de pantalla completa' }).click();
		await expect(viewer(page)).toHaveAttribute('data-immersive', 'false');
	});

	test('a double click enters it and a single click leaves it', async ({ page }) => {
		await openFirstPhoto(page);
		await zoomable(page).dblclick();
		await expect(viewer(page)).toHaveAttribute('data-immersive', 'true');

		await zoomable(page).click();
		await expect(viewer(page)).toHaveAttribute('data-immersive', 'false');
	});

	test('a double click on a zoomed photo zooms out instead', async ({ page }) => {
		await openFirstPhoto(page);
		await page.keyboard.press('+');
		await page.keyboard.press('+');
		await zoomable(page).dblclick();

		await expect(zoomable(page)).toHaveAttribute('data-scale', '1.00');
		await expect(viewer(page)).toHaveAttribute('data-immersive', 'false');
	});

	test('the bigger picture is fetched in full screen', async ({ page }) => {
		const requested: string[] = [];
		page.on('request', (request) => requested.push(request.url()));
		await openFirstPhoto(page);
		await page.keyboard.press('f');
		await expect.poll(() => requested.some((url) => url.includes('w_2400/Sample_001'))).toBe(true);
	});

	test('typing in a field is not a shortcut', async ({ page }) => {
		await openFirstPhoto(page);
		await viewer(page).evaluate((dialog) => {
			const input = document.createElement('input');
			input.id = 'probe';
			dialog.appendChild(input);
			input.focus();
		});
		await page.keyboard.type('f0+');
		await expect(viewer(page)).toHaveAttribute('data-immersive', 'false');
		await expect(zoomable(page)).toHaveAttribute('data-scale', '1.00');
	});
});
