import { expect, test, type Page } from '@playwright/test';
import { expectNoA11yViolations, login, resetBackend, starButton, stubCdnImages, viewerDialog } from './helpers';

declare global {
	interface Window {
		__shared?: { files?: { name: string; type: string; size: number }[]; url?: string; title?: string };
		__copied?: string;
	}
}

test.beforeEach(async ({ page }) => {
	await stubCdnImages(page);
});

/** What a phone's browser offers: files can be shared, and sharing remembers what it was given. */
const phoneThatSharesFiles = (page: Page) =>
	page.addInitScript(() => {
		navigator.canShare = (data) => Array.isArray(data?.files);
		navigator.share = async (data) => {
			window.__shared = {
				files: data?.files?.map((f) => ({ name: f.name, type: f.type, size: f.size })),
				url: data?.url,
				title: data?.title
			};
		};
	});

async function openFirstPhoto(page: Page) {
	await login(page);
	await resetBackend(page); // sharing writes nothing, but the order of the photos must not depend on an earlier spec
	await page.reload();
	await page.waitForLoadState('networkidle'); // hydration
	await page.getByRole('button', { name: 'Abrir Sample_001' }).click();
	await expect(viewerDialog(page)).toBeVisible();
}

const shareButton = (page: Page) => viewerDialog(page).getByRole('button', { name: 'Compartir' });

test('shares the picture itself where the device can share files', async ({ page }) => {
	await phoneThatSharesFiles(page);
	const fetched: string[] = [];
	page.on('request', (request) => {
		// The viewer's own <img> asks for the same picture; the share button reads it with fetch().
		if (request.resourceType() === 'fetch' && request.url().includes('w_1600')) fetched.push(request.url());
	});
	await openFirstPhoto(page);

	// The picture is fetched ahead of time (at the viewer's size, not the original), so that the press needs nothing.
	await expect(shareButton(page)).toHaveAttribute('data-ready', 'true');
	await shareButton(page).click();

	const shared = await page.evaluate(() => window.__shared);
	expect(shared?.files).toHaveLength(1);
	expect(shared?.files?.[0]).toMatchObject({ name: 'Sample_001.png', type: 'image/png' });
	expect(shared?.files?.[0].size).toBeGreaterThan(0);
	expect(shared?.title).toBe('Sample_001');
	expect(fetched.length).toBeGreaterThan(0);
});

test('the picture to share is the one of the photo on screen', async ({ page }) => {
	await phoneThatSharesFiles(page);
	await openFirstPhoto(page);
	await expect(shareButton(page)).toHaveAttribute('data-ready', 'true');

	await page.keyboard.press('ArrowRight');
	await expect(page).toHaveURL(/Sample_002$/);
	await expect(shareButton(page)).toHaveAttribute('data-ready', 'false'); // the old picture is not this photo's
	await expect(shareButton(page)).toHaveAttribute('data-ready', 'true');
	await shareButton(page).click();

	expect((await page.evaluate(() => window.__shared))?.files?.[0].name).toBe('Sample_002.png');
});

test('shares the link, through the share sheet, when the device cannot share files', async ({ page }) => {
	await page.addInitScript(() => {
		navigator.canShare = () => false;
		navigator.share = async (data) => {
			window.__shared = { url: data?.url, title: data?.title };
		};
	});
	const fetched: string[] = [];
	page.on('request', (request) => {
		if (request.resourceType() === 'fetch' && request.url().includes('res.cloudinary.com')) fetched.push(request.url());
	});
	await openFirstPhoto(page);
	await page.waitForTimeout(900); // longer than the moment the viewer waits before preparing a picture

	await shareButton(page).click();

	const shared = await page.evaluate(() => window.__shared);
	expect(shared?.url).toBe('http://localhost:5199/app/photo/Sample_001');
	expect(shared?.files).toBeUndefined();
	expect(fetched).toEqual([]); // no picture was downloaded for a device that cannot use it
});

test('copies the link where there is no share sheet, and says so', async ({ page }) => {
	await page.addInitScript(() => {
		Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
		Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
		Object.defineProperty(navigator, 'clipboard', {
			value: { writeText: async (text: string) => void (window.__copied = text) },
			configurable: true
		});
	});
	await openFirstPhoto(page);

	await shareButton(page).click();

	await expect(page.getByRole('status').filter({ hasText: 'Enlace copiado' })).toBeVisible();
	expect(await page.evaluate(() => window.__copied)).toBe('http://localhost:5199/app/photo/Sample_001');
});

test('closing the share sheet is not an error', async ({ page }) => {
	await page.addInitScript(() => {
		navigator.canShare = () => false;
		navigator.share = async () => {
			throw new DOMException('closed', 'AbortError');
		};
	});
	await openFirstPhoto(page);

	await shareButton(page).click();

	await expect(page.getByRole('alert')).toHaveCount(0);
	await expect(page.getByText('Enlace copiado')).toHaveCount(0);
});

test('says so when it cannot share at all', async ({ page }) => {
	await page.addInitScript(() => {
		Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
		Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
		Object.defineProperty(navigator, 'clipboard', {
			value: { writeText: async () => Promise.reject(new Error('denied')) },
			configurable: true
		});
	});
	await openFirstPhoto(page);

	await shareButton(page).click();

	await expect(page.getByRole('status').filter({ hasText: 'No se pudo compartir la foto' })).toBeVisible();
});

test('the public demo has no Share button: its photos have no page to link to', async ({ page }) => {
	await page.goto('/demo');
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: 'Open demo/sample_1' }).click();
	await expect(page.getByRole('dialog', { name: 'Photo viewer' })).toBeVisible();
	await expect(page.getByRole('button', { name: /^Share$/ })).toHaveCount(0);
	await expect(page.getByRole('dialog').getByRole('button', { name: 'Favorite' })).toBeVisible(); // the viewer is complete without it
});

test('a star on the open photo does not throw away the picture already fetched', async ({ page }) => {
	await phoneThatSharesFiles(page);
	let fetches = 0;
	page.on('request', (request) => {
		if (request.resourceType() === 'fetch' && request.url().includes('w_1600')) fetches++;
	});
	await openFirstPhoto(page);
	try {
		await expect(shareButton(page)).toHaveAttribute('data-ready', 'true');
		const before = fetches;

		await starButton(page).click();
		await expect(starButton(page)).toHaveAttribute('aria-pressed', 'true');
		await page.waitForTimeout(900); // longer than the moment the viewer waits before preparing a picture

		await expect(shareButton(page)).toHaveAttribute('data-ready', 'true');
		expect(fetches).toBe(before);
	} finally {
		await resetBackend(page); // the star is stored in the mock
	}
});

test('the notice is seen on top of the viewer, not dimmed behind it', async ({ page }) => {
	await page.addInitScript(() => {
		Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
		Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
		Object.defineProperty(navigator, 'clipboard', {
			value: { writeText: async () => {} },
			configurable: true
		});
	});
	await openFirstPhoto(page);

	await shareButton(page).click();

	const notice = page.getByRole('status').filter({ hasText: 'Enlace copiado' });
	await expect(notice).toBeVisible();
	const onTop = await notice.evaluate((element) => {
		const box = element.getBoundingClientRect();
		return document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2) === element;
	});
	expect(onTop).toBe(true);
	await expectNoA11yViolations(page); // the viewer with its Share button and the notice over it
});
