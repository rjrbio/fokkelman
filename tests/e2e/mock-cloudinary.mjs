import { createServer } from 'node:http';

const PORT = 9966;

// 80 fotos familiares (para probar el scroll infinito por filas) + 3 de demo. Una de cada cinco
// es vertical, para que las filas justificadas no sean todas iguales.
// Unas pocas ya vienen anotadas, como las dejaría una persona desde la consola de Cloudinary: una con
// descripción y personas, una solo con personas, y una con una clave ajena a la app. Ninguna lleva año
// a propósito: la galería ordena por año, y con año saldrían las primeras y moverían a todas las demás.
const SEED_CONTEXT = {
	Sample_002: { caption: 'Playa de Sitges', people: 'Ana, Luis' },
	Sample_004: { people: 'Ana' },
	Sample_006: { alt: 'texto alternativo' }
};

function createState() {
	return {
		family: Array.from({ length: 80 }, (_, i) => {
			const public_id = `Sample_${String(i + 1).padStart(3, '0')}`;
			return {
				public_id,
				folder: '',
				format: 'jpg',
				width: i % 5 === 3 ? 600 : 800,
				height: i % 5 === 3 ? 800 : 600,
				tags: [],
				...(SEED_CONTEXT[public_id] ? { context: { ...SEED_CONTEXT[public_id] } } : {})
			};
		}),
		demo: Array.from({ length: 3 }, (_, i) => ({
			public_id: `demo/sample_${i + 1}`,
			folder: 'demo',
			format: 'jpg',
			width: 800,
			height: 600,
			tags: []
		}))
	};
}

let state = createState();

function readBody(req) {
	return new Promise((resolve) => {
		let data = '';
		req.on('data', (chunk) => (data += chunk));
		req.on('end', () => resolve(data));
	});
}

const server = createServer(async (req, res) => {
	const body = await readBody(req);
	res.setHeader('Content-Type', 'application/json');

	if (req.url === '/__reset') {
		state = createState();
		res.end(JSON.stringify({}));
		return;
	}

	if (req.url?.endsWith('/resources/search')) {
		const { expression } = JSON.parse(body);
		const resources = expression.includes('-folder:demo') ? state.family : state.demo;
		// Como la API real: el contexto llega envuelto en `custom`, y solo si la foto lo tiene.
		res.end(
			JSON.stringify({
				resources: resources.map(({ context, ...photo }) =>
					context && Object.keys(context).length > 0 ? { ...photo, context: { custom: context } } : photo
				)
			})
		);
		return;
	}

	// Para que los tests vean lo que ha quedado guardado de verdad, sin pasar por la app.
	if (req.url === '/__state') {
		res.end(JSON.stringify({ family: state.family, demo: state.demo }));
		return;
	}

	if (req.url?.endsWith('/image/tags')) {
		const params = new URLSearchParams(body);
		const ids = (params.get('public_ids') ?? '').split(',');
		const command = params.get('command');
		const tag = params.get('tag');
		for (const photo of [...state.family, ...state.demo]) {
			if (!ids.includes(photo.public_id)) continue;
			if (command === 'add' && !photo.tags.includes(tag)) photo.tags.push(tag);
			if (command === 'remove') photo.tags = photo.tags.filter((t) => t !== tag);
		}
		res.end(JSON.stringify({}));
		return;
	}

	res.statusCode = 404;
	res.end(JSON.stringify({ error: `mock: unhandled ${req.method} ${req.url}` }));
});

server.listen(PORT, () => console.log(`mock cloudinary on :${PORT}`));
