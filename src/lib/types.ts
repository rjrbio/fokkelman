export interface Photo {
	/** public_id de Cloudinary, p. ej. "Fokkelman10_001_grguyo" o "family_uploads/abc123" */
	publicId: string;
	/** carpeta de Cloudinary; "" para la raíz */
	folder: string;
	format: string;
	width: number;
	height: number;
	/** true si la foto lleva el tag "favorite" */
	favorite: boolean;
}

export interface PhotoIndex {
	photos: Photo[];
	/** epoch ms del último fetch correcto a Cloudinary */
	fetchedAt: number;
	/** true si se sirve una copia caducada porque la API falló */
	stale: boolean;
}
