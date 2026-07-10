import type { Photo } from './types';

const base = (cloudName: string) => `https://res.cloudinary.com/${cloudName}/image/upload`;

export function thumbUrl(cloudName: string, photo: Photo): string {
	return `${base(cloudName)}/c_fill,f_auto,q_auto,w_400,h_400/${photo.publicId}`;
}

export function fullUrl(cloudName: string, photo: Photo): string {
	return `${base(cloudName)}/f_auto,q_auto,w_1600/${photo.publicId}`;
}

export function downloadUrl(cloudName: string, photo: Photo): string {
	return `${base(cloudName)}/fl_attachment/${photo.publicId}.${photo.format}`;
}
