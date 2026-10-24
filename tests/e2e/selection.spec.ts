import { expect, test, type Page } from '@playwright/test';
import { login, resetBackend, stubCdnImages } from './helpers';

test.beforeEach(async ({ page }) => {
	await stubCdnImages(page);
	await login(page);
	await resetBackend(page);
	await page.reload();
	await page.waitForLoadState('networkidle'); // hydration
});

test.afterEach(async ({ page }) => {
	await resetBackend(page);
});

const bar = (page: Page) => page.getByRole('group', { name: 'Fotos seleccionadas' });
const pick = (page: Page, name: string) => page.getByRole('checkbox', { name: `Seleccionar ${name}` });
/** What a person clicks: the box drawn over the photo, which shows when the pointer is over it. */
const box = (page: Page, name: string) => page.locator('label.pick', { has: pick(page, name) });

test('a check box picks a photo, and the top bar gives way to the selection bar', async ({ page }) => {
	await expect(bar(page)).toHaveCount(0);

	await box(page, 'Sample_001').click();
	await expect(bar(page)).toBeVisible();
	await expect(bar(page).getByRole('status')).toHaveText('1 seleccionada');
	await expect(page.getByRole('searchbox', { name: 'Buscar fotos' })).toHaveCount(0);

	await box(page, 'Sample_003').click();
	await expect(bar(page).getByRole('status')).toHaveText('2 seleccionadas');
	await expect(pick(page, 'Sample_001')).toBeChecked();

	await box(page, 'Sample_001').click();
	await expect(bar(page).getByRole('status')).toHaveText('1 seleccionada');
});

test('while something is picked, a click on a photo picks it instead of opening it', async ({ page }) => {
	await box(page, 'Sample_001').click();

	await page.getByRole('button', { name: 'Seleccionar Sample_002' }).click();

	await expect(bar(page).getByRole('status')).toHaveText('2 seleccionadas');
	await expect(page).toHaveURL(/\/app$/);
	await expect(page.getByRole('dialog', { name: 'Visor de fotos' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Seleccionar Sample_002' })).toHaveAttribute('aria-pressed', 'true');
	await expect(pick(page, 'Sample_002')).toBeChecked();
});

test('with nothing picked, a click still opens the photo', async ({ page }) => {
	await page.getByRole('button', { name: 'Abrir Sample_001' }).click();
	await expect(page).toHaveURL(/\/app\/photo\/Sample_001$/);
});

test('"Cancelar selección" and Esc end the selection and bring the top bar back', async ({ page }) => {
	await box(page, 'Sample_001').click();
	await bar(page).getByRole('button', { name: 'Cancelar selección' }).click();
	await expect(bar(page)).toHaveCount(0);
	await expect(page.getByRole('searchbox', { name: 'Buscar fotos' })).toBeVisible();
	await expect(pick(page, 'Sample_001')).not.toBeChecked();

	await box(page, 'Sample_001').click();
	await page.keyboard.press('Escape');
	await expect(bar(page)).toHaveCount(0);
});

test('picks all the photos the gallery shows, and only those', async ({ page }) => {
	await page.getByRole('combobox', { name: 'Persona' }).selectOption('Ana');
	await expect(page.getByRole('status')).toHaveText('2 fotos');
	await box(page, 'Sample_002').click();

	await bar(page).getByRole('button', { name: 'Seleccionar las 2' }).click();

	await expect(bar(page).getByRole('status')).toHaveText('2 seleccionadas');
	// Nothing left to pick: the button is gone.
	await expect(bar(page).getByRole('button', { name: /^Seleccionar las/ })).toHaveCount(0);
});

test('"Sin identificar" brings a shortcut that picks every photo nobody has described', async ({ page }) => {
	await page.getByRole('button', { name: 'Sin identificar', exact: true }).click();
	await expect(page.getByRole('status')).toHaveText('78 fotos');

	await page.getByRole('button', { name: 'Seleccionar las 78 sin identificar' }).click();

	await expect(bar(page).getByRole('status')).toHaveText('78 seleccionadas');
	await expect(page.getByRole('button', { name: /sin identificar$/ })).toHaveCount(0);
});

test('what was picked does not follow the person to another view', async ({ page }) => {
	await page.getByRole('combobox', { name: 'Persona' }).selectOption('Ana');
	await box(page, 'Sample_002').click();
	await expect(bar(page)).toBeVisible();

	await page.goBack();

	await expect(page).toHaveURL(/\/app$/);
	await expect(bar(page)).toHaveCount(0);
});

test('a picked photo that has the keyboard focus does not look like one that has not', async ({ page }) => {
	await box(page, 'Sample_001').click();
	const cell = page.getByRole('button', { name: 'Seleccionar Sample_001' });
	const ring = () => cell.evaluate((el) => getComputedStyle(el).outlineColor);
	const unfocused = await ring();

	await page.keyboard.press('Shift'); // from now on a focus counts as the keyboard's
	await cell.focus();
	await expect.poll(() => cell.evaluate((el) => el.matches(':focus-visible'))).toBe(true);

	expect(await ring()).not.toBe(unfocused);
});

test('a right click with the mouse still opens the browser menu on a photo', async ({ page }) => {
	// Seen from the window, which hears the event after the photo has had its say.
	await page.evaluate(() =>
		window.addEventListener('contextmenu', (event) => {
			(window as Window & { menuCancelled?: boolean }).menuCancelled = event.defaultPrevented;
		})
	);

	await page.getByRole('button', { name: 'Abrir Sample_001' }).click({ button: 'right' });

	const cancelled = await page.evaluate(() => (window as Window & { menuCancelled?: boolean }).menuCancelled);
	expect(cancelled).toBe(false);
});
