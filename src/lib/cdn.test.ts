import { describe, expect, it } from 'vitest';
import { downloadUrl, fullUrl, thumbUrl } from './cdn';
import type { Photo } from './types';

const photo: Photo = {
	publicId: 'family_uploads/abc123',
	folder: 'family_uploads',
	format: 'jpg',
	width: 1200,
	height: 800,
	favorite: false
};

describe('cdn urls', () => {
	it('builds a square auto-format thumbnail without extension', () => {
		expect(thumbUrl('democloud', photo)).toBe(
			'https://res.cloudinary.com/democloud/image/upload/c_fill,f_auto,q_auto,w_400,h_400/family_uploads/abc123'
		);
	});

	it('builds a large view url without extension', () => {
		expect(fullUrl('democloud', photo)).toBe(
			'https://res.cloudinary.com/democloud/image/upload/f_auto,q_auto,w_1600/family_uploads/abc123'
		);
	});

	it('builds a download url with attachment flag and original extension', () => {
		expect(downloadUrl('democloud', photo)).toBe(
			'https://res.cloudinary.com/democloud/image/upload/fl_attachment/family_uploads/abc123.jpg'
		);
	});
});
