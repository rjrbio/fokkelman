import { createHash } from 'node:crypto';
import { expect, test, type Request } from '@playwright/test';
import { login, multipartFields, stubCdnImages } from './helpers';

test('uploads a photo with a server-issued signature', async ({ page }) => {
	await stubCdnImages(page);
	await page.route('https://api.cloudinary.com/v1_1/testcloud/image/upload', (route) =>
		route.fulfill({
			contentType: 'application/json',
			body: JSON.stringify({ public_id: 'family_uploads/e2e_new', format: 'jpg' })
		})
	);
	await login(page);
	// See favorite.spec.ts: wait for the client to hydrate before the first interaction.
	await page.waitForLoadState('networkidle');

	await page.getByRole('button', { name: 'Subir', exact: true }).click();
	await page.setInputFiles('input[type=file]', {
		name: 'holiday.jpg',
		mimeType: 'image/jpeg',
		buffer: Buffer.from('fake-image-bytes')
	});
	await page.getByRole('button', { name: 'Subir todo' }).click();
	await expect(page.getByText('Subida', { exact: true })).toBeVisible();

	const refresh = page.waitForRequest('**/api/refresh-index');
	await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
	await refresh;
});

test('keeps the focus inside the dialog when the button that had it is disabled by its own press', async ({
	page
}) => {
	await stubCdnImages(page);
	// Held until the test lets it go, so that the button stays disabled while the keys are pressed.
	let finishUpload!: () => void;
	const uploadMayFinish = new Promise<void>((resolve) => (finishUpload = resolve));
	await page.route('https://api.cloudinary.com/v1_1/testcloud/image/upload', async (route) => {
		await uploadMayFinish;
		await route.fulfill({
			contentType: 'application/json',
			body: JSON.stringify({ public_id: 'family_uploads/e2e_focus', format: 'jpg' })
		});
	});
	await login(page);
	await page.waitForLoadState('networkidle'); // hydration

	await page.getByRole('button', { name: 'Subir', exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'Subir fotos' });
	const focusIsInside = () => dialog.evaluate((d) => d.contains(document.activeElement));
	await page.setInputFiles('input[type=file]', {
		name: 'holiday.jpg',
		mimeType: 'image/jpeg',
		buffer: Buffer.from('fake-image-bytes')
	});

	// Pressing Enter on "Subir todo" disables it (and "Cerrar"), so the browser drops the focus on
	// <body>. The next Tab must still land inside the dialog, not on the page behind it.
	await dialog.getByRole('button', { name: 'Subir todo' }).focus();
	await page.keyboard.press('Enter');
	await expect(dialog.getByRole('button', { name: 'Subiendo…' })).toBeDisabled();
	await expect(page.locator('body')).toBeFocused();
	await page.keyboard.press('Tab');
	expect(await focusIsInside()).toBe(true);

	finishUpload();
	await expect(dialog.getByText('Subida', { exact: true })).toBeVisible();

	// The same going backwards: from the first control, losing the focus and pressing Shift+Tab
	// must not reach the page behind either.
	await dialog.locator('input[type=file]').focus();
	await page.evaluate(() => (document.activeElement as HTMLElement).blur());
	await expect(page.locator('body')).toBeFocused();
	await page.keyboard.press('Shift+Tab');
	expect(await focusIsInside()).toBe(true);
});

test('ignores a file that is already in the queue instead of crashing', async ({ page }) => {
	await stubCdnImages(page);
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await login(page);
	await page.waitForLoadState('networkidle'); // hydration

	await page.getByRole('button', { name: 'Subir', exact: true }).click();
	const photo = {
		name: 'holiday.jpg',
		mimeType: 'image/jpeg',
		buffer: Buffer.from('fake-image-bytes')
	};
	await page.setInputFiles('input[type=file]', photo);
	await page.setInputFiles('input[type=file]', photo);

	const dialog = page.getByRole('dialog', { name: 'Subir fotos' });
	await expect(dialog.getByRole('listitem')).toHaveCount(1);
	await expect(dialog.getByText('1 archivo omitido')).toBeVisible();
	expect(errors).toEqual([]);
});

test('reaches the file field with the keyboard, announces what it skipped and closes with Escape', async ({
	page
}) => {
	await stubCdnImages(page);
	await login(page);
	await page.waitForLoadState('networkidle'); // hydration

	await page.getByRole('button', { name: 'Subir', exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'Subir fotos' });
	await expect(dialog).toBeFocused();
	// The live region has to be in the accessibility tree before its text changes, or the
	// announcement can be lost: getByRole skips elements that are display: none.
	await expect(dialog.getByRole('status')).toHaveCount(1);

	await page.keyboard.press('Tab');
	await expect(dialog.locator('input[type=file]')).toBeFocused();

	await page.setInputFiles('input[type=file]', {
		name: 'notes.txt',
		mimeType: 'text/plain',
		buffer: Buffer.from('not an image')
	});
	await expect(dialog.getByRole('status')).toHaveText(
		'1 archivo omitido (repetido o no es una imagen).'
	);

	await page.keyboard.press('Escape');
	await expect(dialog).toHaveCount(0);
});

test('offers a retry button big enough to tap when an upload fails', async ({ page }) => {
	await stubCdnImages(page);
	await page.route('https://api.cloudinary.com/v1_1/testcloud/image/upload', (route) =>
		route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
	);
	await login(page);
	await page.waitForLoadState('networkidle'); // hydration

	await page.getByRole('button', { name: 'Subir', exact: true }).click();
	await page.setInputFiles('input[type=file]', {
		name: 'holiday.jpg',
		mimeType: 'image/jpeg',
		buffer: Buffer.from('fake-image-bytes')
	});
	await page.getByRole('button', { name: 'Subir todo' }).click();
	await expect(page.getByText('Falló')).toBeVisible();

	const box = await page.getByRole('button', { name: 'Reintentar' }).boundingBox();
	expect(box?.height).toBeGreaterThanOrEqual(44);
});

const holiday = { name: 'holiday.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('fake-image-bytes') };
const UPLOAD_URL = 'https://api.cloudinary.com/v1_1/testcloud/image/upload';

/** Fulfils the uploads, keeping the requests (the files go to Cloudinary, not to the app). */
async function captureUploads(page: import('@playwright/test').Page): Promise<Request[]> {
	const requests: Request[] = [];
	await page.route(UPLOAD_URL, (route) => {
		requests.push(route.request());
		return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ public_id: 'family_uploads/e2e_new', format: 'jpg' }) });
	});
	return requests;
}

test('uploads the photos with a description, a year and people, signed together with them', async ({ page }) => {
	await stubCdnImages(page);
	const uploads = await captureUploads(page);
	await login(page);
	await page.waitForLoadState('networkidle'); // hydration

	await page.getByRole('button', { name: 'Subir', exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'Subir fotos' });
	await page.setInputFiles('input[type=file]', holiday);
	await dialog.getByLabel('Descripción').fill('Fiesta | 50 = años');
	await dialog.getByLabel('Año').fill('1999');
	await dialog.getByLabel('Personas').pressSequentially('Ana,Luis,');
	await dialog.getByRole('button', { name: 'Subir todo' }).click();
	await expect(dialog.getByText('Subida', { exact: true })).toBeVisible();

	expect(uploads).toHaveLength(1);
	const fields = multipartFields(uploads[0]);
	expect(fields.folder).toBe('family_uploads');
	expect(fields.context).toBe('caption=Fiesta \\| 50 \\= años|people=Ana, Luis|year=1999');
	// The server signed the context along with the rest: the signature is the one for exactly these fields.
	expect(fields.signature).toBe(
		createHash('sha1')
			.update(`context=${fields.context}&folder=family_uploads&timestamp=${fields.timestamp}test-secret`)
			.digest('hex')
	);
});

test('uploads with no data as it always did: no context in the request', async ({ page }) => {
	await stubCdnImages(page);
	const uploads = await captureUploads(page);
	await login(page);
	await page.waitForLoadState('networkidle');

	await page.getByRole('button', { name: 'Subir', exact: true }).click();
	await page.setInputFiles('input[type=file]', holiday);
	await page.getByRole('button', { name: 'Subir todo' }).click();
	await expect(page.getByText('Subida', { exact: true })).toBeVisible();

	const fields = multipartFields(uploads[0]);
	expect(fields).not.toHaveProperty('context');
	expect(fields.signature).toBe(
		createHash('sha1').update(`folder=family_uploads&timestamp=${fields.timestamp}test-secret`).digest('hex')
	);
});

test('says what is wrong with the data and uploads nothing', async ({ page }) => {
	await stubCdnImages(page);
	const uploads = await captureUploads(page);
	await login(page);
	await page.waitForLoadState('networkidle');

	await page.getByRole('button', { name: 'Subir', exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'Subir fotos' });
	await page.setInputFiles('input[type=file]', holiday);
	await dialog.getByLabel('Año').fill('abc');
	await dialog.getByRole('button', { name: 'Subir todo' }).click();

	await expect(dialog.getByRole('alert')).toContainText('El año tiene que ser un número de cuatro cifras');
	await expect(dialog.getByLabel('Año')).toBeFocused();
	await expect(dialog.getByRole('status')).toHaveText('Revisa los datos de las fotos antes de subirlas.');
	expect(uploads).toHaveLength(0);
});

test('offers the collection the gallery is showing, and the default one', async ({ page }) => {
	await stubCdnImages(page);
	await login(page);
	await page.goto('/app?folder=family_uploads');
	await page.waitForLoadState('networkidle');

	await page.getByRole('button', { name: 'Subir', exact: true }).click();
	const select = page.getByRole('dialog', { name: 'Subir fotos' }).getByLabel('Colección');
	await expect(select).toHaveValue('family_uploads');
	expect(await select.locator('option').allTextContents()).toEqual(['family_uploads']);
});

test('sends two photos at a time, never more', async ({ page }) => {
	await stubCdnImages(page);
	let active = 0;
	let most = 0;
	await page.route(UPLOAD_URL, async (route) => {
		active++;
		most = Math.max(most, active);
		await new Promise((resolve) => setTimeout(resolve, 300));
		active--;
		await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ public_id: 'family_uploads/e2e_new', format: 'jpg' }) });
	});
	await login(page);
	await page.waitForLoadState('networkidle');

	await page.getByRole('button', { name: 'Subir', exact: true }).click();
	await page.setInputFiles(
		'input[type=file]',
		['a', 'b', 'c', 'd'].map((name) => ({ name: `${name}.jpg`, mimeType: 'image/jpeg', buffer: Buffer.from(`bytes of ${name}`) }))
	);
	await page.getByRole('button', { name: 'Subir todo' }).click();

	await expect(page.getByText('Subida', { exact: true })).toHaveCount(4);
	expect(most).toBe(2);
});

test('sets aside an image bigger than 10 MB, and says so', async ({ page }) => {
	await stubCdnImages(page);
	await login(page);
	await page.waitForLoadState('networkidle');

	await page.getByRole('button', { name: 'Subir', exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'Subir fotos' });
	await page.setInputFiles('input[type=file]', {
		name: 'huge.jpg',
		mimeType: 'image/jpeg',
		buffer: Buffer.alloc(10 * 1024 * 1024 + 1)
	});

	await expect(dialog.getByRole('status')).toHaveText('1 archivo omitido por pesar más de 10 MB.');
	await expect(dialog.getByRole('listitem')).toHaveCount(0);
});

test('shows the names as they are added, and uploads the ones left plus the one typed and not added yet', async ({ page }) => {
	await stubCdnImages(page);
	const uploads = await captureUploads(page);
	await login(page);
	await page.waitForLoadState('networkidle'); // hydration

	await page.getByRole('button', { name: 'Subir', exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'Subir fotos' });
	await page.setInputFiles('input[type=file]', holiday);
	await dialog.getByLabel('Personas').pressSequentially('Ana,Luis,Marta');
	// The list the field edits has to be one the page watches: a name that is added must show up at once.
	await expect(dialog.getByRole('button', { name: 'Quitar a Ana' })).toBeVisible();
	await expect(dialog.getByRole('button', { name: 'Quitar a Luis' })).toBeVisible();
	await dialog.getByRole('button', { name: 'Quitar a Ana' }).click();
	await expect(dialog.getByRole('button', { name: 'Quitar a Ana' })).toHaveCount(0);

	await dialog.getByRole('button', { name: 'Subir todo' }).click();
	await expect(dialog.getByText('Subida', { exact: true })).toBeVisible();
	expect(multipartFields(uploads[0]).context).toBe('people=Luis, Marta');
});

test('reads the data again when an upload is retried', async ({ page }) => {
	await stubCdnImages(page);
	const uploads: Request[] = [];
	let failNext = true;
	await page.route(UPLOAD_URL, (route) => {
		uploads.push(route.request());
		if (failNext) {
			failNext = false;
			return route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
		}
		return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ public_id: 'family_uploads/e2e_new', format: 'jpg' }) });
	});
	await login(page);
	await page.waitForLoadState('networkidle'); // hydration

	await page.getByRole('button', { name: 'Subir', exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'Subir fotos' });
	await page.setInputFiles('input[type=file]', holiday);
	await dialog.getByLabel('Año').fill('1975');
	await dialog.getByRole('button', { name: 'Subir todo' }).click();
	await expect(dialog.getByText('Falló')).toBeVisible();
	expect(multipartFields(uploads[0]).context).toBe('year=1975');

	// Nothing is going up now: the data can be corrected, and the retry sends what is in the form at that moment.
	await dialog.getByLabel('Año').fill('1980');
	await dialog.getByRole('button', { name: 'Reintentar' }).click();
	await expect(dialog.getByText('Subida', { exact: true })).toBeVisible();
	expect(multipartFields(uploads[1]).context).toBe('year=1980');
});

test('does not offer a retry, nor lets the data change, while photos are going up', async ({ page }) => {
	await stubCdnImages(page);
	let active = 0;
	let most = 0;
	let release!: () => void;
	const held = new Promise<void>((resolve) => (release = resolve));
	await page.route(UPLOAD_URL, async (route) => {
		const isFirst = route.request().postDataBuffer()?.toString('latin1').includes('filename="a.jpg"');
		active++;
		most = Math.max(most, active);
		if (isFirst) {
			active--;
			return route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
		}
		await held; // the others stay up until the test lets them go
		active--;
		return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ public_id: 'family_uploads/e2e_new', format: 'jpg' }) });
	});
	await login(page);
	await page.waitForLoadState('networkidle'); // hydration

	await page.getByRole('button', { name: 'Subir', exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'Subir fotos' });
	await page.setInputFiles(
		'input[type=file]',
		['a', 'b', 'c'].map((name) => ({ name: `${name}.jpg`, mimeType: 'image/jpeg', buffer: Buffer.from(`bytes of ${name}`) }))
	);
	await dialog.getByRole('button', { name: 'Subir todo' }).click();

	// "a" has failed while "b" and "c" are still going up: its retry would be a third upload at once.
	await expect(dialog.getByText('Falló')).toBeVisible();
	await expect(dialog.getByRole('button', { name: 'Reintentar' })).toBeDisabled();
	await expect(dialog.getByLabel('Año')).toBeDisabled();
	await expect(dialog.getByLabel('Colección')).toBeDisabled();

	release();
	await expect(dialog.getByText('Subida', { exact: true })).toHaveCount(2);
	await expect(dialog.getByRole('button', { name: 'Reintentar' })).toBeEnabled();
	await expect(dialog.getByLabel('Año')).toBeEnabled();
	expect(most).toBeLessThanOrEqual(2);
});

test('goes through the data of the photos with the keyboard, showing where the focus is', async ({ page }) => {
	await stubCdnImages(page);
	await login(page);
	await page.waitForLoadState('networkidle'); // hydration

	await page.getByRole('button', { name: 'Subir', exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'Subir fotos' });
	await page.setInputFiles('input[type=file]', holiday);
	await page.keyboard.press('Tab');
	await expect(dialog.locator('input[type=file]')).toBeFocused();

	const outline = () =>
		page.evaluate(() => {
			const style = getComputedStyle(document.activeElement!);
			return { id: document.activeElement!.id, style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
		});
	// The data comes after the files, in the order it is read, and each field shows the focus when it gets it.
	for (const id of ['upload-folder', 'upload-caption', 'upload-year', 'upload-person']) {
		await page.keyboard.press('Tab');
		await expect(dialog.locator(`#${id}`)).toBeFocused();
		const { style, width } = await outline();
		expect(style, id).not.toBe('none');
		expect(width, id).toBeGreaterThan(0);
	}
});
