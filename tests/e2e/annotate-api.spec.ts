import { expect, test, type Page } from '@playwright/test';
import { editContextByHand, login, resetBackend, storedContext } from './helpers';

// The mock verifies the signature of every context call the way Cloudinary does and keeps what it is
// sent, so these tests read back what really got stored.

async function annotate(page: Page, publicIds: string[], patch: unknown) {
	return page.request.post('/api/annotate', { data: { publicIds, patch } });
}

test.beforeEach(async ({ page }) => {
	await login(page);
	await resetBackend(page);
});

// What these tests store stays in the mock, which the other specs share: put it back as it was.
test.afterEach(async ({ page }) => {
	await resetBackend(page);
});

test('answers 401 without a session', async ({ playwright }) => {
	const anonymous = await playwright.request.newContext({ baseURL: 'http://localhost:5199' });
	const response = await anonymous.post('/api/annotate', { data: { publicIds: ['Sample_001'], patch: { caption: 'x' } } });
	expect(response.status()).toBe(401);
	await anonymous.dispose();
});

test('stores a caption, a year and the people of a photo', async ({ page }) => {
	const response = await annotate(page, ['Sample_001'], { caption: 'Playa de Sitges', year: 1975, addPeople: ['Ana', 'Luis'] });

	expect(response.status()).toBe(200);
	expect(await response.json()).toEqual({
		updated: [{ publicId: 'Sample_001', annotation: { caption: 'Playa de Sitges', year: 1975, people: ['Ana', 'Luis'] } }],
		failed: []
	});
	expect(await storedContext('Sample_001')).toEqual({ caption: 'Playa de Sitges', year: '1975', people: 'Ana, Luis' });
});

test('adds a person without losing the ones already there or the year', async ({ page }) => {
	// Sample_004 comes with Ana
	await annotate(page, ['Sample_004'], { year: 1982 });
	await annotate(page, ['Sample_004'], { addPeople: ['Luis', 'ana'] });

	expect(await storedContext('Sample_004')).toEqual({ year: '1982', people: 'Ana, Luis' });
});

test('clears one field and keeps the rest, the keys that are not ours included', async ({ page }) => {
	// Sample_002: caption and people (and a year, once we give it one). Sample_006: only a key of somebody else's.
	await annotate(page, ['Sample_002'], { year: 1975 });
	await annotate(page, ['Sample_002'], { caption: '' });
	expect(await storedContext('Sample_002')).toEqual({ year: '1975', people: 'Ana, Luis' });

	await annotate(page, ['Sample_006'], { caption: 'Cena' });
	await annotate(page, ['Sample_006'], { caption: '' });
	expect(await storedContext('Sample_006')).toEqual({ alt: 'texto alternativo' });
});

test('clears everything when the last field goes', async ({ page }) => {
	await annotate(page, ['Sample_004'], { removePeople: ['Ana'] });
	expect(await storedContext('Sample_004')).toBeUndefined();
});

test('stores text with the characters Cloudinary uses as separators exactly as written', async ({ page }) => {
	const caption = 'Cumpleaños de "Ana" | 50 = ¡fiesta! — 日本 😀';
	await annotate(page, ['Sample_001'], { caption, addPeople: ["María José", "O'Brien"] });
	expect(await storedContext('Sample_001')).toEqual({ caption, people: "María José, O'Brien" });
});

test('annotates several photos at once, each keeping what it had', async ({ page }) => {
	// The two without context end up with the same keys: they travel in one call, which has to be signed with both ids.
	const response = await annotate(page, ['Sample_002', 'Sample_004', 'Sample_010', 'Sample_011'], { addPeople: ['Marta'] });

	expect((await response.json()).failed).toEqual([]);
	expect(await storedContext('Sample_002')).toMatchObject({ caption: 'Playa de Sitges', people: 'Ana, Luis, Marta' });
	expect(await storedContext('Sample_004')).toEqual({ people: 'Ana, Marta' });
	expect(await storedContext('Sample_010')).toEqual({ people: 'Marta' });
	expect(await storedContext('Sample_011')).toEqual({ people: 'Marta' });
});

test('refuses what it should, and stores nothing', async ({ page }) => {
	expect((await annotate(page, ['demo/sample_1'], { caption: 'x' })).status()).toBe(404);
	expect((await annotate(page, ['Sample_001'], { year: 1500 })).status()).toBe(400);
	expect((await annotate(page, ['Sample_001'], { addPeople: ['Ana, Luis'] })).status()).toBe(400);
	expect((await annotate(page, [], { caption: 'x' })).status()).toBe(400);
	expect(await storedContext('Sample_001')).toBeUndefined();
});

// The app keeps a copy of the photo index for a few minutes. Somebody can change a photo in the Cloudinary
// Media Library in the meantime, so a write is planned from what Cloudinary has when the request arrives.
test.describe('what was changed behind the back of the app', () => {
	test('is kept when a field is cleared, which rewrites the whole context', async ({ page }) => {
		// The first call makes the app take its copy of the index, with "Cena" in it.
		await annotate(page, ['Sample_006'], { caption: 'Cena' });
		expect(await storedContext('Sample_006')).toEqual({ alt: 'texto alternativo', caption: 'Cena' });
		// Then somebody adds a key of their own and a year in the Media Library.
		await editContextByHand('Sample_006', { alt: 'texto alternativo', caption: 'Cena', fuente: 'álbum de la abuela', year: '1962' });

		const response = await annotate(page, ['Sample_006'], { caption: '' });

		expect(await storedContext('Sample_006')).toEqual({ alt: 'texto alternativo', fuente: 'álbum de la abuela', year: '1962' });
		// And the answer is what the photo has, not what the app thought it had.
		expect(await response.json()).toEqual({
			updated: [{ publicId: 'Sample_006', annotation: { caption: '', year: 1962, people: [] } }],
			failed: []
		});
	});

	test('is kept when a person is added', async ({ page }) => {
		await annotate(page, ['Sample_004'], { year: 1982 });
		await editContextByHand('Sample_004', { people: 'Ana, Rosa', year: '1982', fuente: 'carta' });

		const response = await annotate(page, ['Sample_004'], { addPeople: ['Luis'] });

		expect(await storedContext('Sample_004')).toEqual({ people: 'Ana, Rosa, Luis', year: '1982', fuente: 'carta' });
		expect((await response.json()).updated).toEqual([
			{ publicId: 'Sample_004', annotation: { caption: '', year: 1982, people: ['Ana', 'Rosa', 'Luis'] } }
		]);
	});

	test('is not written over when the photo already is as asked, and the answer says what it has', async ({ page }) => {
		await annotate(page, ['Sample_004'], { year: 1982 });
		await editContextByHand('Sample_004', { people: 'Ana, Rosa', caption: 'Hecho a mano' });

		const response = await annotate(page, ['Sample_004'], { caption: 'Hecho a mano' });

		expect(await storedContext('Sample_004')).toEqual({ people: 'Ana, Rosa', caption: 'Hecho a mano' });
		expect(await response.json()).toEqual({
			updated: [{ publicId: 'Sample_004', annotation: { caption: 'Hecho a mano', year: null, people: ['Ana', 'Rosa'] } }],
			failed: []
		});
	});

	test('clearing a field that somebody emptied by hand is not an error and writes nothing', async ({ page }) => {
		await annotate(page, ['Sample_004'], { caption: 'Cena' });
		await editContextByHand('Sample_004', { people: 'Ana' });

		const response = await annotate(page, ['Sample_004'], { caption: '' });

		expect(await storedContext('Sample_004')).toEqual({ people: 'Ana' });
		expect((await response.json()).failed).toEqual([]);
	});

	test('a photo whose current context comes back empty while the index has data for it is not written', async ({ page }) => {
		// Sample_002 comes with a caption and two people. Loading the gallery makes the app take its copy of the index.
		await page.goto('/app');
		await editContextByHand('Sample_002', {});
		expect(await storedContext('Sample_002')).toBeUndefined();

		const response = await annotate(page, ['Sample_002'], { addPeople: ['Marta'] });

		// Nothing is written over a read that may have left the context out: the notice says it did not work.
		expect(response.status()).toBe(200);
		expect(await response.json()).toEqual({ updated: [], failed: ['Sample_002'] });
		expect(await storedContext('Sample_002')).toBeUndefined();
	});

	test('a text with a backslash is not rewritten: the photo is reported as failed and nothing changes', async ({ page }) => {
		await annotate(page, ['Sample_004'], { year: 1982 });
		await editContextByHand('Sample_004', { people: 'Ana, C:\\Rosa', year: '1982' });

		const response = await annotate(page, ['Sample_004'], { addPeople: ['Luis'] });

		expect(await response.json()).toEqual({ updated: [], failed: ['Sample_004'] });
		expect(await storedContext('Sample_004')).toEqual({ people: 'Ana, C:\\Rosa', year: '1982' });
	});
});
