/**
 * Every user-facing string. The family area (`/app`, `/login`) is in Spanish and imports `es`
 * directly. The parts that the public demo shares with it (the grid and the viewer) read their
 * strings from `getMessages()` (see `i18n.ts`), so `/demo` can show them in English.
 */

const pluralEs = (n: number, one: string, many: string) => (n === 1 ? one : many);
const photosEs = (n: number) => (n === 1 ? '1 foto' : `${n.toLocaleString('es-ES')} fotos`);

export const es = {
	brand: 'Fokkelman',
	login: {
		title: 'Entrar · Fokkelman',
		heading: 'Fokkelman',
		lede: 'Escribe la contraseña de la familia para entrar.',
		passwordLabel: 'Contraseña de la familia',
		show: 'Mostrar',
		hide: 'Ocultar',
		showPassword: 'Mostrar contraseña',
		hidePassword: 'Ocultar contraseña',
		submit: 'Entrar',
		incorrect: 'Contraseña incorrecta.',
		locked: (minutes: number) => `Demasiados intentos. Vuelve a probar en ${minutes} min.`,
		unavailable: 'No se puede entrar ahora: el servidor aún no está configurado.'
	},
	error: {
		title: 'Algo ha ido mal',
		body: 'La biblioteca de fotos no está disponible ahora mismo. Vuelve a intentarlo en unos minutos.',
		notFoundTitle: 'No encontramos esta página',
		notFoundBody: 'Puede que el enlace esté mal escrito o que la foto ya no exista.',
		retry: 'Reintentar',
		home: 'Volver al inicio'
	},
	grid: {
		empty: 'Ninguna foto coincide con los filtros.',
		open: (name: string, details?: string) => (details ? `Abrir ${name}: ${details}` : `Abrir ${name}`),
		select: (name: string) => `Seleccionar ${name}`
	},
	viewer: {
		label: 'Visor de fotos',
		close: 'Cerrar visor',
		previous: 'Foto anterior',
		next: 'Foto siguiente',
		favorite: 'Favorita',
		download: 'Descargar',
		enterFullscreen: 'Pantalla completa',
		exitFullscreen: 'Salir de pantalla completa',
		details: 'Detalles',
		file: 'Archivo',
		collection: 'Colección',
		noCollection: 'Sin colección',
		size: 'Tamaño',
		dimensions: (width: number, height: number) => `${width} × ${height} px`,
		position: (index: number, total: number) => `Foto ${index} de ${total}`,
		notFound: 'Foto no encontrada.',
		backToGallery: 'Volver a la galería'
	},
	topbar: {
		search: 'Buscar fotos',
		searchPlaceholder: 'Buscar por descripción, persona o año…',
		collection: 'Colección',
		allCollections: 'Todas las colecciones',
		favorites: 'Favoritas',
		filters: 'Filtros',
		person: 'Persona',
		allPeople: 'Todas las personas',
		decade: 'Década',
		allDecades: 'Todas las décadas',
		decadeLabel: (decade: number) => `${decade}–${decade + 9}`,
		noDate: 'Sin fecha',
		unidentified: 'Sin identificar',
		showPhotos: (n: number) => (n === 1 ? 'Ver 1 foto' : `Ver ${n.toLocaleString('es-ES')} fotos`),
		photos: (n: number) => (n === 1 ? '1 foto' : `${n.toLocaleString('es-ES')} fotos`),
		stale: 'copia guardada',
		staleHint: 'Mostrando una copia guardada de las fotos',
		upload: 'Subir',
		logout: 'Salir',
		options: 'Opciones',
		closeOptions: 'Cerrar',
		nav: 'Navegación principal',
		tabHome: 'Fotos',
		tabSearch: 'Buscar',
		tabFavorites: 'Favoritas',
		tabUpload: 'Subir'
	},
	upload: {
		title: 'Subir fotos',
		destination: 'Colección',
		data: 'Datos de las fotos',
		dataHint: 'Los mismos para todas las fotos de esta subida. Puedes dejarlos en blanco.',
		dropzone: 'Arrastra las fotos aquí o haz clic para elegirlas',
		skipped: (n: number) =>
			`${n} ${pluralEs(n, 'archivo omitido', 'archivos omitidos')} (repetido o no es una imagen).`,
		tooBig: (n: number) =>
			`${n} ${pluralEs(n, 'archivo omitido', 'archivos omitidos')} por pesar más de 10 MB.`,
		invalidData: 'Revisa los datos de las fotos antes de subirlas.',
		waiting: 'En cola',
		done: 'Subida',
		failed: 'Falló',
		retry: 'Reintentar',
		uploadAll: 'Subir todo',
		uploading: 'Subiendo…',
		close: 'Cerrar'
	},
	selection: {
		bar: 'Fotos seleccionadas',
		count: (n: number) => (n === 1 ? '1 seleccionada' : `${n.toLocaleString('es-ES')} seleccionadas`),
		selectAll: (n: number) => `Seleccionar las ${n.toLocaleString('es-ES')}`,
		selectUnidentified: (n: number) => `Seleccionar las ${n.toLocaleString('es-ES')} sin identificar`,
		clear: 'Cancelar selección',
		year: 'Año…',
		people: 'Personas…',
		caption: 'Descripción…',
		favorite: 'Marcar como favoritas',
		unfavorite: 'Quitar de favoritas'
	},
	bulk: {
		title: (n: number) => `Editar ${photosEs(n)}`,
		year: {
			label: 'Año',
			hint: 'Por ejemplo, 1975',
			apply: (n: number) => `Poner el año a ${photosEs(n)}`,
			clear: (n: number) => `Quitar el año a ${photosEs(n)}`
		},
		caption: {
			label: 'Descripción',
			empty: 'Escribe la descripción, o quita la que tienen.',
			apply: (n: number) => `Poner la descripción a ${photosEs(n)}`,
			clear: (n: number) => `Quitar la descripción a ${photosEs(n)}`
		},
		people: {
			add: 'Añadir a todas',
			addPerson: 'Añadir persona',
			addPersonHint: 'Escribe un nombre y pulsa Intro',
			remove: 'Quitar de todas',
			removeOption: (name: string, count: number) => `${name} (${count})`,
			nobody: 'Ninguna de las fotos tiene personas.',
			removePerson: (name: string) => `Quitar a ${name}`,
			nothing: 'Elige a quién añadir o a quién quitar.',
			apply: (n: number) => `Aplicar a ${photosEs(n)}`
		},
		saving: 'Guardando…',
		progress: (done: number, total: number) =>
			`${done.toLocaleString('es-ES')} de ${total.toLocaleString('es-ES')}`,
		cancel: 'Cancelar'
	},
	notes: {
		heading: 'Datos de la foto',
		caption: 'Descripción',
		noCaption: 'Sin descripción',
		year: 'Año',
		noYear: 'Sin año',
		people: 'Personas',
		noPeople: 'Sin personas',
		edit: 'Editar',
		save: 'Guardar',
		saving: 'Guardando…',
		cancel: 'Cancelar',
		yearHint: 'Por ejemplo, 1975',
		addPerson: 'Añadir persona',
		addPersonHint: 'Escribe un nombre y pulsa Intro',
		removePerson: (name: string) => `Quitar a ${name}`,
		problem: {
			captionTooLong: (max: number) => `La descripción no puede pasar de ${max} caracteres.`,
			hasBackslash: 'No se puede usar la barra invertida (\\).',
			year: (min: number, max: number) => `El año tiene que ser un número de cuatro cifras entre ${min} y ${max}.`,
			personTooLong: (max: number) => `Un nombre no puede pasar de ${max} caracteres.`,
			tooManyPeople: 'Hay demasiadas personas en la foto: quita alguna.',
			other: 'Revisa los datos de la foto.'
		}
	},
	app: {
		title: 'Fokkelman · Fotos',
		heading: 'Fotos de la familia',
		favoriteFailed: (publicId: string) =>
			`No se pudo actualizar el favorito de ${publicId}. Inténtalo de nuevo.`,
		favoritesFailed: (photos: number) =>
			`No se pudo actualizar el favorito de ${photos} fotos. Inténtalo de nuevo.`,
		annotateFailed: (photos: number) =>
			photos === 1
				? 'No se pudieron guardar los datos de la foto. Inténtalo de nuevo.'
				: `No se pudieron guardar los datos de ${photos} fotos. Inténtalo de nuevo.`,
		annotateTooManyPeople: 'Hay demasiadas personas en la foto: quita alguna e inténtalo de nuevo.',
		annotateTooManyChanges: 'Son demasiados cambios a la vez. Hazlos en grupos más pequeños.'
	}
};

export type Messages = typeof es;

/** What the grid, the viewer and the error page need, in every language they appear in. */
export type SharedMessages = Pick<Messages, 'error' | 'grid' | 'viewer'>;

export interface DemoMessages {
	title: string;
	heading: string;
	noticeLabel: string;
	banner: string;
	bannerRest: string;
	about: string;
	search: string;
	searchPlaceholder: string;
	favorites: string;
	photos: (n: number) => string;
}

export const en: SharedMessages & { demo: DemoMessages } = {
	error: {
		title: 'Something went wrong',
		body: 'The photo library is unavailable right now. Please try again in a few minutes.',
		notFoundTitle: 'Page not found',
		notFoundBody: 'The link may be mistyped, or the photo may no longer exist.',
		retry: 'Try again',
		home: 'Back to the start'
	},
	grid: {
		empty: 'No photos match your filters.',
		open: (name, details) => (details ? `Open ${name}: ${details}` : `Open ${name}`),
		select: (name) => `Select ${name}`
	},
	viewer: {
		label: 'Photo viewer',
		close: 'Close viewer',
		previous: 'Previous photo',
		next: 'Next photo',
		favorite: 'Favorite',
		download: 'Download',
		enterFullscreen: 'Full screen',
		exitFullscreen: 'Exit full screen',
		details: 'Details',
		file: 'File',
		collection: 'Collection',
		noCollection: 'No collection',
		size: 'Size',
		dimensions: (width, height) => `${width} × ${height} px`,
		position: (index, total) => `Photo ${index} of ${total}`,
		notFound: 'Photo not found.',
		backToGallery: 'Back to the gallery'
	},
	demo: {
		title: 'Demo · Fokkelman Photo Vault',
		heading: 'Sample photo gallery',
		noticeLabel: 'Demo notice',
		banner: 'Demo mode.',
		bannerRest: 'These are public sample photos — favorites are stored only in your browser.',
		about: 'About this project',
		search: 'Search photos',
		searchPlaceholder: 'Search by file name…',
		favorites: 'Favorites',
		photos: (n) => (n === 1 ? '1 photo' : `${n.toLocaleString('en-US')} photos`)
	}
};
