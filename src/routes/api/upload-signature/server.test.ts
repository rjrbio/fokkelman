import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const photos = vi.hoisted(() => ({
	cloudinaryConfig: vi.fn(),
	getFamilyIndex: vi.fn(),
	resolveUploadFolder: vi.fn()
}));
vi.mock('$lib/server/photos', () => photos);

import { POST } from './+server';

async function call(body: unknown) {
	const event = { locals: { authed: true }, request: { json: async () => body } } as never;
	const response = (await POST(event)) as Response;
	return { status: response.status, body: await response.json() };
}

beforeEach(() => {
	photos.cloudinaryConfig.mockReset().mockReturnValue({ cloudName: 'testcloud', apiKey: 'key123', apiSecret: 'secret123' });
	photos.getFamilyIndex.mockReset().mockResolvedValue({ photos: [] });
	photos.resolveUploadFolder.mockReset().mockImplementation((folder: string) => folder || 'family_uploads');
});

describe('POST /api/upload-signature', () => {
	it('signs an upload with no data, as it always did', async () => {
		const { status, body } = await call({ folder: 'family_uploads' });
		expect(status).toBe(200);
		expect(body).toMatchObject({ cloudName: 'testcloud', apiKey: 'key123', folder: 'family_uploads' });
		expect(body).not.toHaveProperty('context');
		expect(body.signature).toBe(
			createHash('sha1').update(`folder=family_uploads&timestamp=${body.timestamp}secret123`).digest('hex')
		);
	});

	it('builds the context from what was asked for, and signs it', async () => {
		const { status, body } = await call({ folder: 'family_uploads', caption: 'Fiesta', year: 1999, people: ['Ana', 'Luis'] });
		expect(status).toBe(200);
		expect(body.context).toBe('caption=Fiesta|people=Ana, Luis|year=1999');
		expect(body.signature).toBe(
			createHash('sha1')
				.update(`context=${body.context}&folder=family_uploads&timestamp=${body.timestamp}secret123`)
				.digest('hex')
		);
	});

	it('never takes a context from the client', async () => {
		const { body } = await call({ folder: 'family_uploads', context: 'caption=Mine|admin=yes' });
		expect(body).not.toHaveProperty('context');
	});

	it('answers 400 with the problem when the data is not valid, and signs nothing', async () => {
		expect(await call({ folder: 'family_uploads', year: 1500 })).toMatchObject({ status: 400, body: { problem: 'year-out-of-range' } });
		expect(await call({ folder: 'family_uploads', people: ['Ana, Luis'] })).toMatchObject({ status: 400, body: { problem: 'person-has-comma' } });
	});

	it('answers 422 when there are too many people', async () => {
		const people = Array.from({ length: 8 }, (_, i) => `${'N'.repeat(30)}${i}`);
		expect(await call({ folder: 'family_uploads', people })).toMatchObject({ status: 422, body: { problem: 'too-many-people' } });
	});

	it('still lets the folder be decided by the server', async () => {
		photos.resolveUploadFolder.mockReturnValue('family_uploads');
		const { body } = await call({ folder: 'demo' });
		expect(body.folder).toBe('family_uploads');
	});
});
