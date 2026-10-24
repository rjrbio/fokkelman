import { expect, test, type Page } from '@playwright/test';
import { login, resetBackend, stubCdnImages } from './helpers';

// The mock comes with Sample_002 (caption, Ana and Luis), Sample_004 (Ana) and Sample_006 (a key that is
// not ours), none with a year. These three get years on top, so that Ana is in 4 photos, Luis in 2, the 1970s
// have 2 photos, the 1980s 1, and 75 of the 80 are not identified (no year, nobody in them).
test.beforeEach(async ({ page }) => {
	await stubCdnImages(page);
	await login(page);
	await resetBackend(page);
	const annotate = async (publicId: string, patch: object) => {
		const response = await page.request.post('/api/annotate', { data: { publicIds: [publicId], patch } });
		expect(response.ok()).toBe(true);
	};
	await annotate('Sample_010', { year: 1975, addPeople: ['Ana'] });
	await annotate('Sample_011', { year: 1979, addPeople: ['Ana', 'Luis'] });
	await annotate('Sample_012', { year: 1982 });
	await page.reload();
	await page.waitForLoadState('networkidle'); // hydration
});

test.afterEach(async ({ page }) => {
	await resetBackend(page);
});

const count = (page: Page, text: string) => expect(page.getByRole('status').filter({ hasText: /fotos?$/ })).toHaveText(text);

test('filters by person, and keeps the filter in the address', async ({ page }) => {
	await page.getByRole('combobox', { name: 'Persona' }).selectOption('Ana');

	await count(page, '4 fotos');
	await expect(page).toHaveURL(/[?&]persona=Ana(&|$)/);
	await page.reload();
	await count(page, '4 fotos');
	await expect(page.getByRole('combobox', { name: 'Persona' })).toHaveValue('Ana');
});

test('offers the people most used first, and everybody', async ({ page }) => {
	const options = await page.getByRole('combobox', { name: 'Persona' }).locator('option').allTextContents();
	expect(options).toEqual(['Todas las personas', 'Ana', 'Luis']);
});

test('filters by decade, with a decade for the photos that have no date', async ({ page }) => {
	const decade = page.getByRole('combobox', { name: 'Década' });
	expect(await decade.locator('option').allTextContents()).toEqual([
		'Todas las décadas',
		'1970–1979',
		'1980–1989',
		'Sin fecha'
	]);

	await decade.selectOption('1970');
	await count(page, '2 fotos');
	await decade.selectOption('sin');
	await count(page, '77 fotos');
	await expect(page).toHaveURL(/[?&]decada=sin(&|$)/);
});

test('"Sin identificar" leaves the photos with no year and nobody in them', async ({ page }) => {
	const pill = page.getByRole('button', { name: 'Sin identificar', exact: true });
	await pill.click();

	await expect(pill).toHaveAttribute('aria-pressed', 'true');
	await count(page, '75 fotos');
	await expect(page.getByRole('button', { name: /^Abrir Sample_010/ })).toHaveCount(0);
	await pill.click();
	await count(page, '80 fotos');
});

test('combines the filters, and a link with them opens the same view', async ({ page }) => {
	await page.goto('/app?persona=Ana&decada=1970');
	await count(page, '2 fotos');
	await expect(page.getByRole('combobox', { name: 'Persona' })).toHaveValue('Ana');
	await expect(page.getByRole('combobox', { name: 'Década' })).toHaveValue('1970');

	await page.goto('/app?persona=Luis&decada=sin');
	await count(page, '1 foto');
});

test('a person that nobody has still shows in the select, so that the filter can be seen and undone', async ({ page }) => {
	await page.goto('/app?persona=Nadie');
	await page.waitForLoadState('networkidle'); // hydration: the select is used right away
	await expect(page.getByText('Ninguna foto coincide con los filtros.')).toBeVisible();
	await expect(page.getByRole('combobox', { name: 'Persona' })).toHaveValue('Nadie');

	await page.getByRole('combobox', { name: 'Persona' }).selectOption('');
	await count(page, '80 fotos');
});
