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
	/** context.caption; `''` si no hay */
	caption: string;
	/** context.year */
	year: number | null;
	/** context.people (separado por comas) */
	people: string[];
	/**
	 * Claves de context que esta app no gestiona. Se conservan para no perderlas si hay que reescribir
	 * el context de la foto; casi siempre no hay ninguna y el campo falta.
	 */
	extraContext?: Record<string, string>;
}

export interface PhotoIndex {
	photos: Photo[];
	/** epoch ms del último fetch correcto a Cloudinary */
	fetchedAt: number;
	/** true si se sirve una copia caducada porque la API falló */
	stale: boolean;
}
