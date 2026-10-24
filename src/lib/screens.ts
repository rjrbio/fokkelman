/** A picture of the landing, as the script `npm run screenshots` writes it under `static/`. */
export interface Screen {
	src: string;
	width: number;
	height: number;
	alt: string;
}

/**
 * The sizes are what the script captures and what the landing declares on each `<img>`, so the page
 * does not jump while they load; `screens.test.ts` keeps the files and these numbers in agreement.
 */
export const SCREENS = {
	gallery: {
		src: '/screens/gallery.jpg',
		width: 1280,
		height: 800,
		alt: 'The demo gallery: sample photos in tight justified rows on a dark page, with a search box and a Favorites button.'
	},
	viewer: {
		src: '/screens/viewer.jpg',
		width: 1280,
		height: 800,
		alt: 'The photo viewer open on a landscape photo of a thatched house, with a Details panel beside it.'
	},
	phone: {
		src: '/screens/phone.jpg',
		width: 824,
		height: 1830,
		alt: 'The demo gallery on a phone: a notice, a search box and a Favorites button above photos in tight rows.'
	},
	og: {
		src: '/og.jpg',
		width: 1200,
		height: 630,
		alt: 'Fokkelman Photo Vault, a private family photo archive, beside a screenshot of its gallery.'
	}
} satisfies Record<string, Screen>;
