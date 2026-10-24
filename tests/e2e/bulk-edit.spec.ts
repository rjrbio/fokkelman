import { expect, test, type Page } from '@playwright/test';
import { login, resetBackend, storedContext, stubCdnImages } from './helpers';

// The mock comes with Sample_002 (caption, Ana and Luis), Sample_004 (Ana) and Sample_006 (a key that is
// not ours); the rest have nothing.
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
const box = (page: Page, name: string) =>
	page.locator('label.pick', { has: page.getByRole('checkbox', { name: `Seleccionar ${name}` }) });
const pickPhotos = async (page: Page, ...names: string[]) => {
	for (const name of names) await box(page, name).click();
};
const dialog = (page: Page, n: number) => page.getByRole('dialog', { name: n === 1 ? 'Editar 1 foto' : `Editar ${n} fotos` });
const annotate = async (page: Page, publicIds: string[], patch: object) => {
	const response = await page.request.post('/api/annotate', { data: { publicIds, patch } });
	expect(response.ok()).toBe(true);
};

test('sets a year for every photo picked, and the selection ends', async ({ page }) => {
	await pickPhotos(page, 'Sample_020', 'Sample_021', 'Sample_022');
	await bar(page).getByRole('button', { name: 'Año…' }).click();
	const form = dialog(page, 3);
	await expect(form.getByLabel('Año')).toBeFocused();

	await form.getByLabel('Año').fill('1990');
	await form.getByRole('button', { name: 'Poner el año a 3 fotos' }).click();

	await expect(form).toHaveCount(0);
	await expect(bar(page)).toHaveCount(0);
	for (const id of ['Sample_020', 'Sample_021', 'Sample_022']) expect(await storedContext(id)).toEqual({ year: '1990' });
	// The gallery goes by year: they are the first three now, with their year on them.
	await expect(page.getByTestId('photo-grid').getByRole('button').first()).toHaveAccessibleName('Abrir Sample_020: 1990');
});

test('takes the year off every photo picked, and leaves the rest of what they have', async ({ page }) => {
	await annotate(page, ['Sample_002'], { year: 1975 });
	await annotate(page, ['Sample_010'], { year: 1975 });
	await page.reload();
	await page.waitForLoadState('networkidle');
	await pickPhotos(page, 'Sample_002', 'Sample_010');
	await bar(page).getByRole('button', { name: 'Año…' }).click();

	await dialog(page, 2).getByRole('button', { name: 'Quitar el año a 2 fotos' }).click();

	await expect(bar(page)).toHaveCount(0);
	expect(await storedContext('Sample_002')).toEqual({ caption: 'Playa de Sitges', people: 'Ana, Luis' });
	expect(await storedContext('Sample_010')).toBeUndefined();
});

test('sets and takes off a description', async ({ page }) => {
	await pickPhotos(page, 'Sample_010', 'Sample_011');
	await bar(page).getByRole('button', { name: 'Descripción…' }).click();
	await dialog(page, 2).getByLabel('Descripción').fill('Vacaciones en la playa');
	await dialog(page, 2).getByRole('button', { name: 'Poner la descripción a 2 fotos' }).click();
	await expect(bar(page)).toHaveCount(0);
	expect(await storedContext('Sample_011')).toEqual({ caption: 'Vacaciones en la playa' });

	await pickPhotos(page, 'Sample_010', 'Sample_011');
	await bar(page).getByRole('button', { name: 'Descripción…' }).click();
	await dialog(page, 2).getByRole('button', { name: 'Quitar la descripción a 2 fotos' }).click();
	await expect(bar(page)).toHaveCount(0);
	expect(await storedContext('Sample_010')).toBeUndefined();
});

test('adds a person to every photo picked, keeping the people they already have', async ({ page }) => {
	await pickPhotos(page, 'Sample_002', 'Sample_010');
	await bar(page).getByRole('button', { name: 'Personas…' }).click();
	const form = dialog(page, 2);
	const suggested = await form.locator('#bulk-person-list option').evaluateAll((options) => options.map((o) => (o as HTMLOptionElement).value));
	expect(suggested).toEqual(['Ana', 'Luis']);

	await form.getByLabel('Añadir a todas').pressSequentially('Marta');
	await page.keyboard.press('Enter');
	await expect(form.getByRole('button', { name: 'Quitar a Marta' })).toBeVisible(); // the name is on the list: the list notices what is pushed to it
	await form.getByRole('button', { name: 'Aplicar a 2 fotos' }).click();

	await expect(bar(page)).toHaveCount(0);
	expect(await storedContext('Sample_002')).toMatchObject({ people: 'Ana, Luis, Marta' });
	expect(await storedContext('Sample_010')).toEqual({ people: 'Marta' });
});

test('takes a person off every photo picked, offering the people who are in them, the most first', async ({ page }) => {
	await pickPhotos(page, 'Sample_002', 'Sample_004');
	await bar(page).getByRole('button', { name: 'Personas…' }).click();
	const form = dialog(page, 2);
	await expect(form.getByRole('checkbox')).toHaveCount(2);
	expect(await form.getByRole('checkbox').evaluateAll((boxes) => boxes.map((b) => b.parentElement?.textContent?.trim()))).toEqual(['Ana (2)', 'Luis (1)']);

	await form.getByRole('checkbox', { name: 'Ana (2)' }).check();
	await form.getByRole('button', { name: 'Aplicar a 2 fotos' }).click();

	await expect(bar(page)).toHaveCount(0);
	expect(await storedContext('Sample_002')).toEqual({ caption: 'Playa de Sitges', people: 'Luis' });
	expect(await storedContext('Sample_004')).toBeUndefined(); // Ana was all it had
});

test('says what is wrong and saves nothing', async ({ page }) => {
	await pickPhotos(page, 'Sample_010');
	await bar(page).getByRole('button', { name: 'Año…' }).click();
	const form = dialog(page, 1);
	await form.getByLabel('Año').fill('abc');
	await form.getByRole('button', { name: 'Poner el año a 1 foto' }).click();
	await expect(form.getByRole('alert')).toContainText('El año tiene que ser un número de cuatro cifras');
	await expect(form.getByLabel('Año')).toBeFocused();
	await page.keyboard.press('Escape');

	await bar(page).getByRole('button', { name: 'Descripción…' }).click();
	await dialog(page, 1).getByRole('button', { name: 'Poner la descripción a 1 foto' }).click();
	await expect(dialog(page, 1).getByRole('alert')).toContainText('Escribe la descripción');
	await page.keyboard.press('Escape');

	await bar(page).getByRole('button', { name: 'Personas…' }).click();
	await dialog(page, 1).getByRole('button', { name: 'Aplicar a 1 foto' }).click();
	await expect(dialog(page, 1).getByRole('alert')).toContainText('Elige a quién añadir');

	expect(await storedContext('Sample_010')).toBeUndefined();
});

test('Esc closes the dialog and keeps the selection; a second Esc ends the selection', async ({ page }) => {
	await pickPhotos(page, 'Sample_010', 'Sample_011');
	await bar(page).getByRole('button', { name: 'Año…' }).click();
	await expect(dialog(page, 2)).toBeVisible();

	await page.keyboard.press('Escape');

	await expect(dialog(page, 2)).toHaveCount(0);
	await expect(bar(page).getByRole('status')).toHaveText('2 seleccionadas');
	await page.keyboard.press('Escape');
	await expect(bar(page)).toHaveCount(0);
});

test('when the save fails it says so, keeps the dialog and the selection, and takes the change back', async ({ page }) => {
	await page.route('**/api/annotate', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }));
	await pickPhotos(page, 'Sample_020', 'Sample_021', 'Sample_022');
	await bar(page).getByRole('button', { name: 'Año…' }).click();
	const form = dialog(page, 3);
	await form.getByLabel('Año').fill('1990');
	await form.getByRole('button', { name: 'Poner el año a 3 fotos' }).click();

	const toast = page.getByRole('alert').filter({ hasText: 'No se pudieron guardar los datos de 3 fotos' });
	await expect(toast).toBeVisible();
	// It is on top of the dialog's dark backdrop, not dimmed behind it.
	expect(await toast.evaluate((el) => {
		const { x, y, width, height } = el.getBoundingClientRect();
		return el.contains(document.elementFromPoint(x + width / 2, y + height / 2));
	})).toBe(true);
	await expect(form).toBeVisible();
	await expect(form.getByLabel('Año')).toHaveValue('1990');
	await expect(form.getByRole('button', { name: 'Poner el año a 3 fotos' })).toBeFocused();
	await expect(page.getByTestId('photo-grid').getByRole('button').first()).toHaveAccessibleName('Seleccionar Sample_001');

	await form.getByRole('button', { name: 'Cancelar' }).click();
	await expect(bar(page).getByRole('status')).toHaveText('3 seleccionadas');
});

test('while it saves it says so, and nothing closes under the finger', async ({ page }) => {
	let release!: () => void;
	const mayFinish = new Promise<void>((resolve) => (release = resolve));
	await page.route('**/api/annotate', async (route) => {
		await mayFinish;
		await route.continue();
	});
	await pickPhotos(page, 'Sample_020', 'Sample_021');
	await bar(page).getByRole('button', { name: 'Año…' }).click();
	const form = dialog(page, 2);
	await form.getByLabel('Año').fill('1990');
	await form.getByRole('button', { name: 'Poner el año a 2 fotos' }).click();

	await expect(form.getByRole('status')).toContainText('Guardando…');
	await expect(form.getByRole('button', { name: 'Poner el año a 2 fotos' })).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(form).toBeVisible();

	release();
	await expect(form).toHaveCount(0);
	expect(await storedContext('Sample_020')).toEqual({ year: '1990' });
});
