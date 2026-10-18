import { describe, expect, it } from 'vitest';
import { downloadUrl, fullUrl, thumbUrl, zoomUrl } from './cdn';
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
	it('builds a thumbnail that keeps the photo shape and is never upscaled', () => {
		expect(thumbUrl('democloud', photo)).toBe(
			'https://res.cloudinary.com/democloud/image/upload/c_limit,f_auto,q_auto,w_800,h_480/family_uploads/abc123'
		);
	});

	it('builds the viewer url, never upscaled', () => {
		expect(fullUrl('democloud', photo)).toBe(
			'https://res.cloudinary.com/democloud/image/upload/c_limit,f_auto,q_auto,w_1600/family_uploads/abc123'
		);
	});

	it('builds a larger url for full screen and zoom', () => {
		expect(zoomUrl('democloud', photo)).toBe(
			'https://res.cloudinary.com/democloud/image/upload/c_limit,f_auto,q_auto,w_2400/family_uploads/abc123'
		);
	});

	it('builds a download url with attachment flag and original extension', () => {
		expect(downloadUrl('democloud', photo)).toBe(
			'https://res.cloudinary.com/democloud/image/upload/fl_attachment/family_uploads/abc123.jpg'
		);
	});
});
