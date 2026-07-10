import { describe, expect, it } from 'vitest';
import { resolveUploadFolder, UPLOAD_FOLDER } from './photos';

describe('resolveUploadFolder', () => {
	it('honors a request for the default upload folder', () => {
		expect(resolveUploadFolder(UPLOAD_FOLDER, [])).toBe(UPLOAD_FOLDER);
	});

	it('honors a request for a folder that already exists in the family index', () => {
		expect(resolveUploadFolder('vacations_2019', ['family_uploads', 'vacations_2019'])).toBe(
			'vacations_2019'
		);
	});

	it('falls back to the default folder when the public demo folder is requested', () => {
		// The family index never contains `demo` (it's excluded via
		// `-folder:demo`), so this must never be honored.
		expect(resolveUploadFolder('demo', ['family_uploads', 'vacations_2019'])).toBe(UPLOAD_FOLDER);
	});

	it('falls back to the default folder for an arbitrary/unknown folder', () => {
		expect(resolveUploadFolder('../evil', ['family_uploads'])).toBe(UPLOAD_FOLDER);
		expect(resolveUploadFolder('../../etc', ['family_uploads'])).toBe(UPLOAD_FOLDER);
		expect(resolveUploadFolder('anything_else', ['family_uploads'])).toBe(UPLOAD_FOLDER);
	});

	it('falls back to the default folder for an empty request', () => {
		expect(resolveUploadFolder('', ['family_uploads'])).toBe(UPLOAD_FOLDER);
	});
});
