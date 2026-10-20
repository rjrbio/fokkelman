import { expect, test, type Page } from '@playwright/test';
import { login, resetBackend, storedContext, stubCdnImages, viewerDialog } from './helpers';

test.beforeEach(async ({ page }) => {
	await stubCdnImages(page);
	await login(page);
	await resetBackend(page);
	await page.reload();
	await page.waitForLoadState('networkidle'); // hydration
});

// What these tests save stays in the mock, which the other specs share: put it back as it was.
test.afterEach(async ({ page }) => {
	await resetBackend(page);
});

// Sample_002 comes with a caption ("Playa de Sitges") and two people (Ana, Luis), and no year.
async function openAndEdit(page: Page, name = 'Abrir Sample_002') {
	await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
	const viewer = viewerDialog(page);
	await viewer.getByRole('button', { name: 'Editar', exact: true }).click();
	return viewer;
}

test('shows what is known about the photo', async ({ page }) => {
	await page.getByRole('button', { name: /^Abrir Sample_002/ }).click();
	const viewer = viewerDialog(page);

	await expect(viewer.getByText('Playa de Sitges')).toBeVisible();
	await expect(viewer.getByText('Sin año')).toBeVisible();
	await expect(viewer.getByRole('listitem').filter({ hasText: 'Ana' })).toBeVisible();
	await expect(viewer.getByRole('listitem').filter({ hasText: 'Luis' })).toBeVisible();

	await page.keyboard.press('Escape');
	await page.getByRole('button', { name: 'Abrir Sample_001' }).click();
	await expect(viewer.getByText('Sin descripción')).toBeVisible();
	await expect(viewer.getByText('Sin personas')).toBeVisible();
});

test('edits the caption, the year and the people, and the gallery shows it at once', async ({ page }) => {
	const viewer = await openAndEdit(page);
	await expect(viewer.getByLabel('Descripción')).toBeFocused();

	await viewer.getByLabel('Descripción').fill('Atardecer en Sitges');
	await viewer.getByLabel('Año').fill('1977');
	await viewer.getByRole('button', { name: 'Quitar a Luis' }).click();
	await viewer.getByLabel('Personas').pressSequentially('Marta');
	await page.keyboard.press('Enter');
	await expect(viewer.getByRole('listitem').filter({ hasText: 'Marta' })).toBeVisible();
	await viewer.getByRole('button', { name: 'Guardar' }).click();

	await expect(viewer.getByRole('button', { name: 'Editar', exact: true })).toBeFocused();
	await expect(viewer.getByText('Atardecer en Sitges')).toBeVisible();
	await expect(viewer.getByText('1977')).toBeVisible();
	expect(await storedContext('Sample_002')).toEqual({ caption: 'Atardecer en Sitges', year: '1977', people: 'Ana, Marta' });

	await page.keyboard.press('Escape');
	await expect(page.getByTestId('photo-grid').getByRole('button').first()).toHaveAccessibleName(
		'Abrir Sample_002: Atardecer en Sitges, 1977'
	);
});

test('clears a field', async ({ page }) => {
	const viewer = await openAndEdit(page);
	await viewer.getByLabel('Descripción').fill('');
	await viewer.getByRole('button', { name: 'Guardar' }).click();

	await expect(viewer.getByRole('button', { name: 'Editar', exact: true })).toBeVisible(); // the save has ended
	await expect(viewer.getByText('Sin descripción')).toBeVisible();
	expect(await storedContext('Sample_002')).toEqual({ people: 'Ana, Luis' });
});

test('takes a name that was typed but not added when saving', async ({ page }) => {
	const viewer = await openAndEdit(page, 'Abrir Sample_001');
	await viewer.getByLabel('Personas').pressSequentially('Marta');
	await viewer.getByRole('button', { name: 'Guardar' }).click();

	// The name is also in the form until the save ends, so wait for the editor to close before looking at what was stored.
	await expect(viewer.getByRole('button', { name: 'Editar', exact: true })).toBeVisible();
	await expect(viewer.getByRole('listitem').filter({ hasText: 'Marta' })).toBeVisible();
	expect(await storedContext('Sample_001')).toEqual({ people: 'Marta' });
});

test('a comma adds the name, and a name already there is not added twice', async ({ page }) => {
	const viewer = await openAndEdit(page);
	await viewer.getByLabel('Personas').pressSequentially('ana,Marta,');

	await expect(viewer.getByRole('listitem').filter({ hasText: 'Marta' })).toHaveCount(1);
	await expect(viewer.getByRole('button', { name: /^Quitar a / })).toHaveCount(3); // Ana, Luis, Marta
});

test('suggests the names already used in the library', async ({ page }) => {
	const viewer = await openAndEdit(page, 'Abrir Sample_001');
	const suggested = await viewer.locator('#notes-people option').evaluateAll((options) => options.map((o) => (o as HTMLOptionElement).value));
	expect(suggested).toEqual(['Ana', 'Luis']);
});

test('says what is wrong and saves nothing', async ({ page }) => {
	const viewer = await openAndEdit(page);

	await viewer.getByLabel('Año').fill('abc');
	await viewer.getByRole('button', { name: 'Guardar' }).click();
	await expect(viewer.getByRole('alert')).toContainText('El año tiene que ser un número de cuatro cifras');
	await expect(viewer.getByLabel('Año')).toBeFocused();

	await viewer.getByLabel('Año').fill('');
	await viewer.getByLabel('Descripción').fill('x'.repeat(256));
	await viewer.getByRole('button', { name: 'Guardar' }).click();
	await expect(viewer.getByRole('alert')).toContainText('no puede pasar de 255 caracteres');

	expect(await storedContext('Sample_002')).toEqual({ caption: 'Playa de Sitges', people: 'Ana, Luis' });
});

test('Esc leaves the editor and keeps the viewer; Esc again closes it', async ({ page }) => {
	const viewer = await openAndEdit(page);
	await viewer.getByLabel('Descripción').fill('a medias');

	await page.keyboard.press('Escape');
	await expect(viewer.getByRole('button', { name: 'Editar', exact: true })).toBeVisible();
	await expect(viewer.getByText('Playa de Sitges')).toBeVisible();
	await expect(viewerDialog(page)).toBeVisible();

	await page.keyboard.press('Escape');
	await expect(viewerDialog(page)).toBeHidden();
	expect(await storedContext('Sample_002')).toEqual({ caption: 'Playa de Sitges', people: 'Ana, Luis' });
});

test('Esc pressed on a button of the editor does not close the viewer either', async ({ page }) => {
	const viewer = await openAndEdit(page);
	await viewer.getByRole('button', { name: 'Cancelar' }).focus();

	await page.keyboard.press('Escape');

	await expect(viewer.getByRole('button', { name: 'Editar', exact: true })).toBeVisible();
	await expect(viewerDialog(page)).toBeVisible();
});

test('the keys of the viewer do nothing while the focus is in the editor', async ({ page }) => {
	const viewer = await openAndEdit(page);
	await viewer.getByRole('button', { name: 'Cancelar' }).focus();

	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('f');

	await expect(page).toHaveURL(/\/app\/photo\/Sample_002$/);
	await expect(viewer).toHaveAttribute('data-immersive', 'false');
});

test('Esc with the focus outside the editor closes the viewer, as always', async ({ page }) => {
	const viewer = await openAndEdit(page);
	await viewer.getByRole('button', { name: 'Favorita', exact: true }).focus();

	await page.keyboard.press('Escape');

	await expect(viewerDialog(page)).toBeHidden();
});

test('another photo starts with the editor closed', async ({ page }) => {
	const viewer = await openAndEdit(page);
	await viewer.getByLabel('Descripción').fill('sin guardar');

	await viewer.getByRole('button', { name: 'Foto siguiente' }).click();

	await expect(viewer.getByRole('button', { name: 'Editar', exact: true })).toBeVisible();
	await expect(viewer.getByLabel('Descripción')).toHaveCount(0);
});

test('when the save fails it takes the change back, says so, and lets the form be tried again', async ({ page }) => {
	await page.route('**/api/annotate', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }));
	const viewer = await openAndEdit(page);
	await viewer.getByLabel('Descripción').fill('No se guarda');
	await viewer.getByRole('button', { name: 'Guardar' }).click();

	await expect(page.getByRole('alert').filter({ hasText: 'No se pudieron guardar los datos de la foto' })).toBeVisible();
	await expect(viewer.getByLabel('Descripción')).toHaveValue('No se guarda');
	await expect(viewer.getByRole('button', { name: 'Guardar' })).toBeEnabled();
	// The focus stayed where it was: the keys still go to the editor, not to the viewer behind it.
	await expect(viewer.getByRole('button', { name: 'Guardar' })).toBeFocused();

	await viewer.getByRole('button', { name: 'Cancelar' }).click();
	await expect(viewer.getByText('Playa de Sitges')).toBeVisible();
});

test('does not ask the server when nothing changed', async ({ page }) => {
	let asked = 0;
	await page.route('**/api/annotate', (route) => {
		asked++;
		return route.continue();
	});
	const viewer = await openAndEdit(page);

	await viewer.getByRole('button', { name: 'Guardar' }).click();

	await expect(viewer.getByRole('button', { name: 'Editar', exact: true })).toBeFocused();
	expect(asked).toBe(0);
});

const focusIsInsideTheForm = (page: Page) => page.evaluate(() => document.activeElement?.closest('form') != null);

test('taking a person off keeps the focus in the editor, so Esc still leaves only the editor', async ({ page }) => {
	const viewer = await openAndEdit(page);

	await viewer.getByRole('button', { name: 'Quitar a Ana' }).click();
	// The focus moves on to the next person's button instead of falling to the page.
	await expect(viewer.getByRole('button', { name: 'Quitar a Luis' })).toBeFocused();
	expect(await focusIsInsideTheForm(page)).toBe(true);

	await page.keyboard.press('Escape');

	await expect(viewer.getByRole('button', { name: 'Editar', exact: true })).toBeFocused();
	await expect(viewerDialog(page)).toBeVisible();
	await expect(page).toHaveURL(/\/app\/photo\/Sample_002$/);
});

test('taking off the last person sends the focus to the person field', async ({ page }) => {
	const viewer = await openAndEdit(page);
	await viewer.getByRole('button', { name: 'Quitar a Luis' }).click();
	// Luis was the last one: the focus goes back to the one before.
	await expect(viewer.getByRole('button', { name: 'Quitar a Ana' })).toBeFocused();

	await viewer.getByRole('button', { name: 'Quitar a Ana' }).click();

	await expect(viewer.getByLabel('Personas')).toBeFocused();
	expect(await focusIsInsideTheForm(page)).toBe(true);
});

test('while a save is in flight the keys do not close the viewer or the editor, and it closes when the save ends', async ({ page }) => {
	let release!: () => void;
	const gate = new Promise<void>((resolve) => (release = resolve));
	await page.route('**/api/annotate', async (route) => {
		await gate;
		await route.continue();
	});
	const viewer = await openAndEdit(page);
	await viewer.getByLabel('Descripción').fill('Despacio');
	await viewer.getByRole('button', { name: 'Guardar' }).click();

	await expect(viewer.getByRole('button', { name: 'Guardando…' })).toBeFocused();
	expect(await focusIsInsideTheForm(page)).toBe(true);

	await page.keyboard.press('Escape');
	await page.keyboard.press('ArrowRight');
	await expect(viewerDialog(page)).toBeVisible();
	await expect(viewer.getByLabel('Descripción')).toHaveValue('Despacio');
	await expect(page).toHaveURL(/\/app\/photo\/Sample_002$/);

	release();

	await expect(viewer.getByRole('button', { name: 'Editar', exact: true })).toBeFocused();
	await expect(viewer.getByText('Despacio')).toBeVisible();
	expect(await storedContext('Sample_002')).toEqual({ caption: 'Despacio', people: 'Ana, Luis' });
});

test('a replacement that is not one of the suggestions (autocorrect) is not taken as a name that was picked', async ({ page }) => {
	const viewer = await openAndEdit(page, 'Abrir Sample_001');

	await page.evaluate(() => {
		const input = document.querySelector<HTMLInputElement>('#notes-person')!;
		input.value = 'Jose';
		input.dispatchEvent(new InputEvent('input', { inputType: 'insertReplacementText', data: 'Jose', bubbles: true }));
	});

	await expect(viewer.getByLabel('Personas')).toHaveValue('Jose');
	await expect(viewer.getByRole('listitem').filter({ hasText: 'Jose' })).toHaveCount(0);
});

test('a replacement that is one of the suggestions is a name that was picked, and is added at once', async ({ page }) => {
	const viewer = await openAndEdit(page, 'Abrir Sample_001');

	await page.evaluate(() => {
		const input = document.querySelector<HTMLInputElement>('#notes-person')!;
		input.value = 'Ana';
		input.dispatchEvent(new InputEvent('input', { inputType: 'insertReplacementText', data: 'Ana', bubbles: true }));
	});

	await expect(viewer.getByRole('listitem').filter({ hasText: 'Ana' })).toHaveCount(1);
	await expect(viewer.getByLabel('Personas')).toHaveValue('');
});
