/** The picture a link preview shows. `src` starts with `/` and is served by this site. */
export interface SeoImage {
	src: string;
	width: number;
	height: number;
	alt: string;
}

export interface SeoInput {
	/** Origin of the request (`page.url.origin`), so the tags are right on localhost, previews and production. */
	origin: string;
	path: string;
	title: string;
	description: string;
	image: SeoImage;
}

/** One `<meta>`: Open Graph tags carry `property`, the rest carry `name`. */
export interface MetaTag {
	name?: string;
	property?: string;
	content: string;
}

export interface Seo {
	canonical: string;
	tags: MetaTag[];
}

const SITE_NAME = 'Fokkelman Photo Vault';

/** Canonical address and the Open Graph / Twitter tags of a public page. */
export function pageSeo({ origin, path, title, description, image }: SeoInput): Seo {
	const base = origin.replace(/\/+$/, '');
	const canonical = base + (path.startsWith('/') ? path : `/${path}`);
	const imageUrl = base + image.src;

	return {
		canonical,
		tags: [
			{ name: 'description', content: description },
			{ property: 'og:type', content: 'website' },
			{ property: 'og:site_name', content: SITE_NAME },
			{ property: 'og:title', content: title },
			{ property: 'og:description', content: description },
			{ property: 'og:url', content: canonical },
			{ property: 'og:image', content: imageUrl },
			{ property: 'og:image:width', content: String(image.width) },
			{ property: 'og:image:height', content: String(image.height) },
			{ property: 'og:image:alt', content: image.alt },
			{ name: 'twitter:card', content: 'summary_large_image' },
			{ name: 'twitter:title', content: title },
			{ name: 'twitter:description', content: description },
			{ name: 'twitter:image', content: imageUrl },
			{ name: 'twitter:image:alt', content: image.alt }
		]
	};
}
