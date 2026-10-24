import { expect, test, type Page } from '@playwright/test';
import {
	expectNoA11yViolations,
	holdFinger,
	login,
	longPress,
	resetBackend,
	starButton,
	storedContext,
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

test('an active search keeps its field on screen, even from a link and after tapping the magnifier', async ({
	page
}) => {
	await page.goto('/app?q=Sample_07');
	await page.waitForLoadState('networkidle'); // hydration
	const search = page.getByRole('searchbox', { name: 'Buscar fotos' });
	await expect(search).toBeVisible();
	await expect(search).toHaveValue('Sample_07');

	const magnifier = page.getByRole('button', { name: 'Buscar fotos' }); // the field has the same name
	await magnifier.tap();
	await expect(search).toBeVisible();
	await expect(magnifier).toHaveAttribute('aria-expanded', 'true');
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

test('the options sheet filters by person, decade and what is not identified, and stays open until told', async ({ page }) => {
	await resetBackend(page);
	await page.request.post('/api/annotate', { data: { publicIds: ['Sample_010'], patch: { year: 1975, addPeople: ['Ana'] } } });
	await page.reload();
	await page.waitForLoadState('networkidle');

	await page.getByRole('button', { name: 'Opciones' }).tap();
	const sheet = page.getByRole('dialog', { name: 'Opciones' });
	await sheet.getByLabel('Persona').selectOption('Ana');
	await expect(sheet).toBeVisible(); // choosing something does not close it: there may be more to choose
	await sheet.getByLabel('Década').selectOption('1970');
	await expect(sheet.getByRole('button', { name: 'Ver 1 foto' })).toBeVisible();

	await sheet.getByRole('button', { name: 'Ver 1 foto' }).tap();
	await expect(sheet).toHaveCount(0);
	await expect(page.getByText('1 foto', { exact: true })).toBeVisible();
	await expect(page).toHaveURL(/persona=Ana&decada=1970$/);
	await expect(tabs(page).getByRole('link', { name: 'Fotos' })).not.toHaveAttribute('aria-current', 'page');

	await page.getByRole('button', { name: 'Opciones' }).tap();
	await page.getByRole('dialog', { name: 'Opciones' }).getByRole('button', { name: 'Sin identificar' }).tap();
	await expect(page.getByText('Ninguna foto coincide con los filtros.')).toBeVisible();
	await resetBackend(page);
});

test('the options sheet scrolls on a short screen, so that nothing in it is out of reach', async ({ page }) => {
	await page.setViewportSize({ width: 412, height: 360 }); // a phone on its side, or with large text
	await page.getByRole('button', { name: 'Opciones' }).tap();
	const sheet = page.getByRole('dialog', { name: 'Opciones' });
	await expect(sheet).toBeVisible();

	const { clientHeight, scrollHeight, top } = await sheet.evaluate((element) => ({
		clientHeight: element.clientHeight,
		scrollHeight: element.scrollHeight,
		top: element.getBoundingClientRect().top
	}));
	expect(top).toBeGreaterThanOrEqual(0); // it does not grow past the top edge
	expect(scrollHeight).toBeGreaterThan(clientHeight); // what does not fit scrolls

	for (const target of [
		sheet.getByRole('button', { name: 'Cerrar' }),
		sheet.getByLabel('Persona'),
		sheet.getByRole('button', { name: /^Ver [\d.]+ fotos?$/ })
	]) {
		await target.scrollIntoViewIfNeeded();
		await expect(target).toBeInViewport({ ratio: 1 });
	}
});

test('the upload tab opens a dialog that fits the screen', async ({ page }) => {
	await tabs(page).getByRole('button', { name: 'Subir' }).tap();
	const dialog = page.getByRole('dialog', { name: 'Subir fotos' });
	await expect(dialog).toBeVisible();
	const box = (await dialog.boundingBox())!;
	expect(box.x).toBeGreaterThanOrEqual(0);
	expect(box.x + box.width).toBeLessThanOrEqual(412);
});

test('the controls of the upload dialog are big enough for a finger, and the data fits the screen', async ({ page }) => {
	await tabs(page).getByRole('button', { name: 'Subir' }).tap();
	const dialog = page.getByRole('dialog', { name: 'Subir fotos' });
	await page.setInputFiles('input[type=file]', {
		name: 'holiday.jpg',
		mimeType: 'image/jpeg',
		buffer: Buffer.from('fake-image-bytes')
	});
	await dialog.getByLabel('Personas').fill('Ana,');
	await expect(dialog.getByRole('button', { name: 'Quitar a Ana' })).toBeVisible();

	const { checked, small, wide } = await dialog.evaluate((node) => {
		const measured = [...node.querySelectorAll<HTMLElement>('button, input:not(.sr-only), textarea, select')]
			.filter((el) => el.getClientRects().length > 0)
			.map((el) => ({
				name: el.getAttribute('aria-label') ?? el.id ?? el.textContent?.trim() ?? '',
				remove: el.classList.contains('chip-remove'),
				box: el.getBoundingClientRect()
			}));
		const edge = node.getBoundingClientRect().right;
		return {
			checked: measured.map(({ name }) => name),
			// The little × on a name is smaller on purpose; it still has to be 24px (WCAG 2.2).
			small: measured
				.filter(({ remove, box }) => (remove ? box.width < 24 || box.height < 24 : box.height < 44))
				.map(({ name, box }) => `${name}: ${Math.round(box.width)}×${Math.round(box.height)}`),
			wide: measured.filter(({ box }) => box.right > edge + 1).map(({ name }) => name)
		};
	});
	// The collection, the description, the year, the names, "Subir todo", "Cerrar": without this, a selector
	// that matches nothing would make the test pass vacuously.
	expect(checked.length, `measured: ${JSON.stringify(checked)}`).toBeGreaterThanOrEqual(6);
	expect(small).toEqual([]);
	expect(wide).toEqual([]);

	for (const name of ['Subir todo', 'Cerrar']) {
		const button = dialog.getByRole('button', { name, exact: true });
		await button.scrollIntoViewIfNeeded();
		await expect(button).toBeInViewport({ ratio: 1 });
	}
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

	test('has a Share button in the sheet, big enough for a finger', async ({ page }) => {
		const share = viewerDialog(page).getByRole('button', { name: 'Compartir' });
		await expect(share).toBeVisible();
		const box = (await share.boundingBox())!;
		expect(box.height).toBeGreaterThanOrEqual(44);
		expect(box.x + box.width).toBeLessThanOrEqual(412);
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

test.describe('selecting on a phone', () => {
	test.beforeEach(async ({ page }) => {
		await resetBackend(page);
		await page.reload();
		await page.waitForLoadState('networkidle');
	});

	test.afterEach(async ({ page }) => {
		await resetBackend(page);
	});

	const bar = (page: Page) => page.getByRole('group', { name: 'Fotos seleccionadas' });

	test('a long press picks a photo, and then a tap picks another one instead of opening it', async ({ page }) => {
		await longPress(page, page.getByRole('button', { name: 'Abrir Sample_001' }));

		await expect(bar(page).getByRole('status')).toHaveText('1 seleccionada');
		await expect(page).toHaveURL(/\/app$/); // the lifted finger did not open the photo

		await page.getByRole('button', { name: 'Seleccionar Sample_002' }).tap();
		await expect(bar(page).getByRole('status')).toHaveText('2 seleccionadas');
		await expect(page).toHaveURL(/\/app$/);

		await page.getByRole('button', { name: 'Seleccionar Sample_002' }).tap();
		await expect(bar(page).getByRole('status')).toHaveText('1 seleccionada');
	});

	test('the browser is not let pop up its own menu over the photo during or right after a press', async ({ page }) => {
		// By position, not by name: once the photo is picked its name is no longer "Abrir …".
		const cell = page.getByTestId('photo-grid').getByRole('button').first();
		/** Asks for the browser's menu on the photo, as its own long press does, and says whether the page cancelled it. */
		const menuCancelled = () =>
			cell.evaluate((el) => {
				const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
				el.dispatchEvent(menu);
				return menu.defaultPrevented;
			});

		const lift = await holdFinger(page, cell);

		// The browser can ask for its menu before the page's own timer (500 ms) has picked the photo...
		await page.waitForTimeout(200);
		await expect(bar(page)).toHaveCount(0);
		expect(await menuCancelled(), 'while the finger is down, before the photo is picked').toBe(true);

		// ...after it has...
		await expect(bar(page).getByRole('status')).toHaveText('1 seleccionada');
		expect(await menuCancelled(), 'while the finger is down, once the photo is picked').toBe(true);

		// ...and right after the finger leaves.
		await lift();
		expect(await menuCancelled(), 'right after the finger is lifted').toBe(true);
	});

	test('a mouse press after a finger takes the protection away: the menu is only cancelled for touch', async ({ page }) => {
		const cell = page.getByTestId('photo-grid').getByRole('button').first();
		const lift = await holdFinger(page, cell);
		await lift();

		const cancelled = await cell.evaluate((el) => {
			el.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'mouse', bubbles: true }));
			const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
			el.dispatchEvent(menu);
			return menu.defaultPrevented;
		});

		expect(cancelled).toBe(false);
	});

	test('a short tap still opens the photo', async ({ page }) => {
		await page.getByRole('button', { name: 'Abrir Sample_001' }).tap();
		await expect(page).toHaveURL(/\/app\/photo\/Sample_001$/);
	});

	test('a tap on the corner where the box is drawn does not pick by accident', async ({ page }) => {
		const cell = page.getByRole('button', { name: 'Abrir Sample_001' });
		const box = (await cell.boundingBox())!;
		await page.touchscreen.tap(box.x + 8, box.y + 8);
		await expect(bar(page)).toHaveCount(0);
		await expect(page).toHaveURL(/\/app\/photo\/Sample_001$/);
	});

	test('the selection bar fits the screen and its controls are big enough for a finger', async ({ page }) => {
		await longPress(page, page.getByRole('button', { name: 'Abrir Sample_001' }));
		await expect(bar(page)).toBeVisible();

		const { small, count, overflow } = await bar(page).evaluate((node) => {
			const controls = [...node.querySelectorAll<HTMLElement>('button')].filter((el) => el.getClientRects().length > 0);
			return {
				count: controls.length,
				small: controls
					.map((el) => ({ name: el.textContent?.trim() ?? '', box: el.getBoundingClientRect() }))
					.filter(({ box }) => box.width < 44 || box.height < 44)
					.map(({ name, box }) => `${name}: ${Math.round(box.width)}×${Math.round(box.height)}`),
				overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
			};
		});
		expect(count).toBeGreaterThanOrEqual(2); // "Seleccionar las 80" and "Cancelar selección"
		expect(small).toEqual([]);
		expect(overflow).toBeLessThanOrEqual(0);
	});

	test('the bulk edit dialog fits the screen, works with taps and its controls are big enough for a finger', async ({ page }) => {
		await longPress(page, page.getByRole('button', { name: 'Abrir Sample_001' }));
		await page.getByRole('button', { name: 'Seleccionar Sample_002' }).tap();
		await bar(page).getByRole('button', { name: 'Personas…' }).tap();
		const dialog = page.getByRole('dialog', { name: 'Editar 2 fotos' });
		await expect(dialog).toBeVisible();

		const fits = await dialog.evaluate((node) => {
			const box = node.getBoundingClientRect();
			return box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight;
		});
		expect(fits).toBe(true);
		const small = await dialog.evaluate((node) =>
			[...node.querySelectorAll<HTMLElement>('button:not(.chip-remove), input:not([type=checkbox]), textarea')]
				.filter((el) => el.getClientRects().length > 0 && !el.classList.contains('sr-only'))
				.map((el) => ({ name: el.getAttribute('aria-label') ?? el.id ?? el.textContent?.trim() ?? '', box: el.getBoundingClientRect() }))
				.filter(({ box }) => box.height < 44)
				.map(({ name, box }) => `${name || '(sin nombre)'}: ${Math.round(box.width)}×${Math.round(box.height)}`)
		);
		expect(small).toEqual([]);

		await dialog.getByLabel('Añadir a todas').fill('Marta');
		await page.keyboard.press('Enter');
		await dialog.getByRole('button', { name: 'Aplicar a 2 fotos' }).tap();
		await expect(bar(page)).toHaveCount(0);
		expect(await storedContext('Sample_001')).toEqual({ people: 'Marta' });
	});

	test('has nothing wrong for a screen reader with the bulk edit dialog open', async ({ page }) => {
		await longPress(page, page.getByRole('button', { name: 'Abrir Sample_001' }));
		await bar(page).getByRole('button', { name: 'Año…' }).tap();
		await expect(page.getByRole('dialog', { name: 'Editar 1 foto' })).toBeVisible();
		await expectNoA11yViolations(page);
	});

	test('has nothing wrong for a screen reader while photos are picked', async ({ page }) => {
		await longPress(page, page.getByRole('button', { name: 'Abrir Sample_001' }));
		await expect(bar(page)).toBeVisible();
		await expectNoA11yViolations(page);
	});
});

test.describe('the public demo on a phone', () => {
	// The demo shares the photo grid but has no selection: a finger on a photo must behave as it always did,
	// i.e. leave the browser's own long press (its menu and its text selection) alone.
	const demoCell = (page: Page) => page.getByRole('button', { name: 'Open demo/sample_1' });

	test.beforeEach(async ({ page }) => {
		await page.goto('/demo');
		await page.waitForLoadState('networkidle'); // hydration
		await expect(demoCell(page)).toBeVisible();
	});

	test('a finger held on a photo does not get the browser menu cancelled', async ({ page }) => {
		const cell = demoCell(page);
		// The press has to reach the page as a touch pointer, or what follows would prove nothing.
		await cell.evaluate((el) => {
			(window as unknown as { pointerTypes: string[] }).pointerTypes = [];
			el.addEventListener('pointerdown', (event) =>
				(window as unknown as { pointerTypes: string[] }).pointerTypes.push((event as PointerEvent).pointerType)
			);
		});

		const lift = await holdFinger(page, cell);
		await page.waitForTimeout(700); // past the 500 ms a long press takes
		const { cancelled, pointerTypes } = await cell.evaluate((el) => {
			const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
			el.dispatchEvent(menu);
			return { cancelled: menu.defaultPrevented, pointerTypes: (window as unknown as { pointerTypes: string[] }).pointerTypes };
		});
		await lift();

		expect(pointerTypes).toEqual(['touch']);
		expect(cancelled).toBe(false);
	});

	test('a photo is not made unselectable for the finger, as it is on the family grid', async ({ page }) => {
		// `-webkit-touch-callout` (the iOS menu) is not a property Chromium has, so it cannot be read here:
		// `user-select`, set by the same rule, stands for it.
		expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
		expect(await demoCell(page).evaluate((el) => getComputedStyle(el).userSelect)).not.toBe('none');

		// The control: the same phone, the same rule, on the grid that does have a selection.
		await page.goto('/app');
		await page.waitForLoadState('networkidle');
		const familyCell = page.getByTestId('photo-grid').getByRole('button').first();
		await expect(familyCell).toBeVisible();
		expect(await familyCell.evaluate((el) => getComputedStyle(el).userSelect)).toBe('none');
	});
});

test.describe('annotating on a phone', () => {
	test.beforeEach(async ({ page }) => {
		await resetBackend(page);
		await page.reload();
		await page.waitForLoadState('networkidle');
		await page.getByRole('button', { name: /^Abrir Sample_002/ }).tap();
		await viewerDialog(page).getByRole('button', { name: 'Editar', exact: true }).tap();
	});

	// What is saved here stays in the mock, which the other specs share: put it back as it was.
	test.afterEach(async ({ page }) => {
		await resetBackend(page);
	});

	test('edits and saves with taps', async ({ page }) => {
		const viewer = viewerDialog(page);
		await viewer.getByLabel('Descripción').fill('Con el móvil');
		await viewer.getByLabel('Año').fill('1999');
		await viewer.getByRole('button', { name: 'Guardar' }).tap();

		await expect(viewer.getByText('Con el móvil')).toBeVisible();
		await expect(viewer.getByRole('button', { name: 'Editar', exact: true })).toBeVisible();
		expect(await storedContext('Sample_002')).toEqual({ caption: 'Con el móvil', year: '1999', people: 'Ana, Luis' });
	});

	test('the controls of the editor are big enough for a finger', async ({ page }) => {
		const form = viewerDialog(page).locator('form');
		const small = await form.evaluate((node) =>
			[...node.querySelectorAll<HTMLElement>('button, input, textarea')]
				.filter((el) => el.getClientRects().length > 0)
				.map((el) => ({
					name: el.getAttribute('aria-label') ?? el.id ?? el.textContent?.trim() ?? '',
					remove: el.classList.contains('chip-remove'),
					box: el.getBoundingClientRect()
				}))
				// The little × on a name is smaller on purpose; it still has to be 24px (WCAG 2.2).
				.filter(({ remove, box }) => (remove ? box.width < 24 || box.height < 24 : box.height < 44))
				.map(({ name, box }) => `${name}: ${Math.round(box.width)}×${Math.round(box.height)}`)
		);
		expect(small).toEqual([]);
	});

	test('has nothing wrong for a screen reader, with an error showing', async ({ page }) => {
		const viewer = viewerDialog(page);
		await viewer.getByLabel('Año').fill('abc');
		await viewer.getByRole('button', { name: 'Guardar' }).tap();
		await expect(viewer.getByRole('alert')).toBeVisible();
		await expectNoA11yViolations(page);
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
