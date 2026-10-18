import type { Photo } from './types';

const base = (cloudName: string) => `https://res.cloudinary.com/${cloudName}/image/upload`;

/** Fits inside 800×480 keeping its shape (never upscaled): the grid shows rows ~120–270px high. */
export function thumbUrl(cloudName: string, photo: Photo): string {
	return `${base(cloudName)}/c_limit,f_auto,q_auto,w_800,h_480/${photo.publicId}`;
}

/** The viewer's usual size. */
export function fullUrl(cloudName: string, photo: Photo): string {
	return `${base(cloudName)}/c_limit,f_auto,q_auto,w_1600/${photo.publicId}`;
}

/** Full screen and zoom: sharp on big and high-density screens. The original stays behind "Descargar". */
export function zoomUrl(cloudName: string, photo: Photo): string {
	return `${base(cloudName)}/c_limit,f_auto,q_auto,w_2400/${photo.publicId}`;
}

export function downloadUrl(cloudName: string, photo: Photo): string {
	return `${base(cloudName)}/fl_attachment/${photo.publicId}.${photo.format}`;
}
