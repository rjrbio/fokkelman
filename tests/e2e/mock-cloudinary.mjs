import { createServer } from 'node:http';

const PORT = 9966;

// 80 fotos familiares (para probar el scroll infinito: primer lote = 60) + 3 de demo
function createState() {
	return {
		family: Array.from({ length: 80 }, (_, i) => ({
			public_id: `Sample_${String(i + 1).padStart(3, '0')}`,
			folder: '',
			format: 'jpg',
			width: 800,
			height: 600,
			tags: []
		})),
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
		res.end(JSON.stringify({ resources }));
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
