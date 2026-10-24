import { createHash } from 'node:crypto';
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

// Lo que la API real firma: todos los parámetros menos `file`, `api_key`, `resource_type` y la propia
// firma, ordenados, con las listas (`public_ids[]`) unidas por comas. Si la app firma mal, el test falla.
const API_KEY = 'test-key';
const API_SECRET = 'test-secret';
function signatureIsValid(params) {
	const signed = {};
	for (const [key, value] of params.entries()) {
		if (['file', 'api_key', 'resource_type', 'signature'].includes(key)) continue;
		const name = key.replace(/\[\]$/, '');
		signed[name] = name === key ? value : [...(signed[name] ? [signed[name]] : []), value].join(',');
	}
	const toSign = Object.keys(signed).sort().map((key) => `${key}=${signed[key]}`).join('&');
	return createHash('sha1').update(toSign + API_SECRET).digest('hex') === params.get('signature');
}

// `key=value|key=value`, con `\=` y `\|` dentro de los valores.
function parseContextString(text) {
	const entries = {};
	let key = '';
	let value = '';
	let inValue = false;
	let escaped = false;
	const flush = () => {
		if (key !== '' || value !== '') entries[key] = value;
		key = '';
		value = '';
		inValue = false;
	};
	for (const char of text) {
		if (escaped) {
			if (inValue) value += char;
			else key += char;
			escaped = false;
		} else if (char === '\\') escaped = true;
		else if (char === '|') flush();
		else if (char === '=' && !inValue) inValue = true;
		else if (inValue) value += char;
		else key += char;
	}
	flush();
	return entries;
}

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

	// Lo que la API de administración contesta a `resources_by_ids`: el contexto que cada foto tiene ahora
	// mismo (a diferencia de la búsqueda, sin retraso). Pide la misma autenticación Basic que la real.
	if (req.method === 'GET' && req.url?.includes('/resources/image/upload')) {
		const basic = 'Basic ' + Buffer.from(`${API_KEY}:${API_SECRET}`).toString('base64');
		if (req.headers.authorization !== basic) {
			res.statusCode = 401;
			res.end(JSON.stringify({ error: { message: 'Invalid credentials' } }));
			return;
		}
		const query = new URL(req.url, 'http://mock').searchParams;
		const ids = query.getAll('public_ids[]');
		const withContext = query.get('context') === 'true';
		// Las que no conoce, sencillamente no salen; solo lleva `context` la foto que tiene alguno.
		const resources = [...state.family, ...state.demo]
			.filter((photo) => ids.includes(photo.public_id))
			.slice(0, Number(query.get('max_results') ?? 10))
			.map(({ context, ...photo }) =>
				withContext && context && Object.keys(context).length > 0 ? { ...photo, context: { custom: context } } : photo
			);
		res.end(JSON.stringify({ resources }));
		return;
	}

	// Solo para los tests: pone el contexto de una foto sin pasar por la app, como una edición a mano en la
	// Media Library de Cloudinary que la app no ha visto.
	if (req.method === 'POST' && req.url === '/__context') {
		const { publicId, context } = JSON.parse(body);
		const photo = [...state.family, ...state.demo].find((candidate) => candidate.public_id === publicId);
		if (!photo) {
			res.statusCode = 404;
			res.end(JSON.stringify({ error: `mock: no photo ${publicId}` }));
			return;
		}
		photo.context = { ...context };
		res.end(JSON.stringify({}));
		return;
	}

	// Para que los tests vean lo que ha quedado guardado de verdad, sin pasar por la app.
	if (req.url === '/__state') {
		res.end(JSON.stringify({ family: state.family, demo: state.demo }));
		return;
	}

	if (req.url?.endsWith('/image/tags')) {
		const params = new URLSearchParams(body);
		if (!signatureIsValid(params)) {
			res.statusCode = 400;
			res.end(JSON.stringify({ error: { message: 'Invalid Signature' } }));
			return;
		}
		// One photo goes as `public_ids=a`, many as `public_ids[]=a&public_ids[]=b`.
		const ids = params.has('public_ids') ? params.get('public_ids').split(',') : params.getAll('public_ids[]');
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

	if (req.url?.endsWith('/image/context')) {
		const params = new URLSearchParams(body);
		const fail = (message) => {
			res.statusCode = 400;
			res.end(JSON.stringify({ error: { message } }));
		};
		if (!signatureIsValid(params)) return fail('Invalid Signature');
		const command = params.get('command');
		if (command !== 'add' && command !== 'remove_all') return fail(`Invalid command ${command}`);
		const ids = params.getAll('public_ids[]');
		if (ids.length === 0 || ids.length > 100) return fail('public_ids must have between 1 and 100 items');
		const entries = command === 'add' ? parseContextString(params.get('context') ?? '') : {};
		if (command === 'add' && Object.keys(entries).length === 0) return fail('context is required');
		for (const [key, value] of Object.entries(entries)) {
			if (key === '' || value === '') return fail('context keys and values cannot be empty');
			if (value.length > 255) return fail('context value is too long');
		}
		const updated = [];
		for (const photo of [...state.family, ...state.demo]) {
			if (!ids.includes(photo.public_id)) continue;
			photo.context = command === 'add' ? { ...(photo.context ?? {}), ...entries } : {};
			updated.push(photo.public_id);
		}
		res.end(JSON.stringify({ public_ids: updated }));
		return;
	}

	res.statusCode = 404;
	res.end(JSON.stringify({ error: `mock: unhandled ${req.method} ${req.url}` }));
});

server.listen(PORT, () => console.log(`mock cloudinary on :${PORT}`));
