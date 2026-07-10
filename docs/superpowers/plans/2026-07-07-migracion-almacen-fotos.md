# Fokkelman Photo Vault — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reescribir la galería familiar como un almacén de fotos estilo Google Photos (SvelteKit + TypeScript en Netlify) con login seguro en servidor, Cloudinary como única fuente de verdad, y una zona pública (landing + demo) para reclutadores.

**Architecture:** App SvelteKit con SSR y endpoints de servidor en Netlify. El navegador nunca ve el API secret: búsqueda, tags y firmas de subida pasan por el servidor, que cachea el índice de fotos ~5 min con fallback a copia caducada. Las imágenes se sirven directamente desde el CDN de Cloudinary con transformaciones.

**Tech Stack:** SvelteKit 2 + Svelte 5 (runes), TypeScript strict, `@sveltejs/adapter-netlify`, Vitest (unit), Playwright (e2e), `node:crypto` (sesiones scrypt/HMAC y firmas SHA-1 de Cloudinary). **Sin** SDK de Cloudinary, **sin** base de datos, **sin** Firebase.

**Spec:** `docs/superpowers/specs/2026-07-07-migracion-almacen-fotos-design.md`

## Global Constraints

- Rama de trabajo: `rewrite/photo-vault` (el sitio viejo sigue en `main` hasta el cutover).
- **Prerrequisito**: árbol de trabajo limpio. Hay cambios sin commitear en `README.md` y `fotos.json` — pedir al usuario que los commitee o descarte antes de empezar.
- Node ≥ 20 (local: v24.15.0). Gestor de paquetes: npm.
- TypeScript `strict`. Svelte 5 con runes (`$state`, `$derived`, `$props`, `$effect`).
- Todo texto de UI en **inglés**. Documentación (README/DEPLOYMENT) en español.
- Variables de entorno (nombres exactos): `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_API_BASE` (opcional, default `https://api.cloudinary.com` — se sobrescribe en tests/e2e), `FAMILY_PASSWORD_HASH`, `SESSION_SECRET`. Leerlas siempre vía `$env/dynamic/private`.
- Cookie de sesión: nombre `fokkelman_session`, HttpOnly, Secure, SameSite=Lax, 30 días.
- Convenciones Cloudinary: tag `favorite` para favoritos; carpeta `demo` para las fotos públicas de muestra; carpeta `family_uploads` como destino por defecto de subidas. El índice familiar **excluye** la carpeta `demo`.
- Caché del índice: TTL 5 minutos, invalidable, sirve copia caducada si la API falla (stale-while-error).
- Nunca escribir secretos en el repo. `.env` está en `.gitignore`.
- Commits: convencionales (`feat:`, `test:`, `docs:`, `chore:`), uno por tarea como mínimo (el patrón TDD de cada tarea indica cuándo).
- Comandos de test: `npm run test:unit` (Vitest) y `npm run test:e2e` (Playwright). Antes de cada commit: `npm run check` debe pasar.
- URL del repo público (landing): `https://github.com/rjrbio/fokkelman`.

## File Structure

```
fokkelman/
├── package.json / svelte.config.js / vite.config.ts / tsconfig.json
├── netlify.toml                      # build SvelteKit (reemplaza al del sitio viejo)
├── .env.example                      # nombres de variables, sin valores reales
├── playwright.config.ts
├── scripts/hash-password.mjs         # genera FAMILY_PASSWORD_HASH
├── static/favicon.svg                # se conserva del sitio viejo
├── src/
│   ├── app.html / app.css / app.d.ts
│   ├── hooks.server.ts               # guard de autenticación
│   ├── lib/
│   │   ├── types.ts                  # Photo, PhotoIndex
│   │   ├── cdn.ts                    # URLs de res.cloudinary.com (puro, sin env)
│   │   ├── filterPhotos.ts           # filtros de galería (puro)
│   │   ├── demoFavorites.ts          # favoritos de la demo en localStorage
│   │   ├── components/
│   │   │   ├── TopBar.svelte         # colecciones, búsqueda, favoritos, upload, logout
│   │   │   ├── PhotoGrid.svelte      # cuadrícula con scroll infinito
│   │   │   ├── Lightbox.svelte       # visor (reutilizado por app y demo)
│   │   │   └── UploadModal.svelte
│   │   └── server/
│   │       ├── session.ts            # tokens HMAC + scrypt de contraseña
│   │       ├── guard.ts              # isPrivatePath (puro)
│   │       ├── cloudinary.ts         # cliente REST: search, tags, firmas
│   │       ├── photoIndex.ts         # caché genérica con TTL y stale
│   │       └── photos.ts             # wiring: config desde env + cachés singleton
│   └── routes/
│       ├── +layout.svelte            # importa app.css
│       ├── +page.svelte              # landing pública
│       ├── login/+page.svelte / +page.server.ts
│       ├── logout/+server.ts
│       ├── demo/+page.svelte / +page.server.ts
│       ├── app/
│       │   ├── +layout.server.ts     # carga índice familiar (depends 'app:photos')
│       │   ├── +layout.svelte        # TopBar + PhotoGrid + UploadModal
│       │   ├── +page.svelte          # vacío (la galería vive en el layout)
│       │   ├── +error.svelte
│       │   └── photo/[...id]/+page.svelte   # lightbox superpuesto
│       └── api/
│           ├── favorite/+server.ts
│           ├── upload-signature/+server.ts
│           └── refresh-index/+server.ts
├── tests/e2e/
│   ├── mock-cloudinary.mjs           # servidor HTTP que simula la API de Cloudinary
│   ├── helpers.ts                    # login(), stubImages()
│   └── login.spec.ts / gallery.spec.ts / favorite.spec.ts / upload.spec.ts
├── DEPLOYMENT.md                     # checklist de deploy, cutover y desmantelamiento
└── README.md                         # reescrito
```

Los tests unitarios van co-ubicados: `src/lib/foo.test.ts` junto a `src/lib/foo.ts`.

---

### Task 1: Scaffold del proyecto SvelteKit en rama nueva

**Files:**
- Delete: `album.html`, `galeria.html`, `index.html`, `recorrido.html`, `CONFIGURATION.md`, `SECURITY.md`, `.netlifyignore`, `.env.example` (viejo), `fotos.json`, `netlify.toml` (viejo), `js/` (completo), `css/` (completo)
- Create: proyecto SvelteKit en la raíz + `netlify.toml`, `.env.example` (nuevo), `src/app.css`, `src/routes/+layout.svelte`
- Move: `favicon.svg` → `static/favicon.svg`

**Interfaces:**
- Consumes: nada (primera tarea).
- Produces: proyecto compilable con `npm run build` y `npm run check`; scripts npm `test:unit`; alias `$lib`; adaptador Netlify configurado. Todas las tareas posteriores asumen esta base.

- [ ] **Step 1: Verificar árbol limpio y crear la rama**

```bash
git status --porcelain
```
Expected: sin salida. Si `README.md` o `fotos.json` aparecen modificados, PARAR y pedir al usuario que los commitee o descarte (`git checkout -- README.md fotos.json`).

```bash
git checkout -b rewrite/photo-vault
```

- [ ] **Step 2: Eliminar los archivos del sitio viejo**

```bash
git rm album.html galeria.html index.html recorrido.html CONFIGURATION.md SECURITY.md .netlifyignore .env.example fotos.json netlify.toml
git rm -r js css
git commit -m "chore: retirar el sitio estático antiguo (la app nueva lo sustituye)"
```

`README.md`, `favicon.svg` y `docs/` se conservan de momento.

- [ ] **Step 3: Generar el proyecto SvelteKit**

```bash
npx sv create . --template minimal --types ts --no-add-ons --install npm
```
Nota: el directorio no está vacío; confirmar el prompt de "directory not empty" con yes. Si la CLI pidiera opciones interactivas, elegir: template *minimal*, *TypeScript*, sin add-ons, instalar con npm.

```bash
npm install -D @sveltejs/adapter-netlify vitest @playwright/test
```

- [ ] **Step 4: Configurar adaptador Netlify, Vitest y archivos base**

`svelte.config.js` (reemplazar contenido):

```js
import adapter from '@sveltejs/adapter-netlify';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: { adapter: adapter() }
};

export default config;
```

`vite.config.ts` (reemplazar contenido):

```ts
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ['src/**/*.test.ts'],
		environment: 'node'
	}
});
```

`netlify.toml` (nuevo):

```toml
[build]
  command = "npm run build"
  publish = "build"

[build.environment]
  NODE_VERSION = "20"
```

`.env.example` (nuevo):

```bash
# Cloudinary (API secret: Dashboard → Settings → API Keys)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Hash de la contraseña familiar: node scripts/hash-password.mjs <password>
FAMILY_PASSWORD_HASH=

# Secreto aleatorio para firmar sesiones: openssl rand -hex 32
SESSION_SECRET=

# Solo para tests/desarrollo contra mock (dejar vacío en producción)
# CLOUDINARY_API_BASE=
```

Mover el favicon y crear el layout raíz con estilos globales:

```bash
mkdir -p static && git mv favicon.svg static/favicon.svg
```

`src/app.css` (nuevo):

```css
:root {
	--bg: #ffffff;
	--surface: #f1f3f4;
	--text: #202124;
	--text-dim: #5f6368;
	--accent: #1a73e8;
	--danger: #d93025;
	--radius: 8px;
}

* {
	box-sizing: border-box;
}

body {
	margin: 0;
	background: var(--bg);
	color: var(--text);
	font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
	font-size: 16px;
}

button {
	font: inherit;
	cursor: pointer;
}
```

`src/routes/+layout.svelte` (nuevo):

```svelte
<script lang="ts">
	import '../app.css';
	let { children } = $props();
</script>

{@render children()}
```

`src/app.html`: dejar el generado por `sv create`, pero asegurar el favicon y el título dentro de `<head>`:

```html
<link rel="icon" href="%sveltekit.assets%/favicon.svg" />
<title>Fokkelman Photo Vault</title>
```

En `package.json`, añadir a `"scripts"`:

```json
"test:unit": "vitest run",
"test:e2e": "playwright test"
```

- [ ] **Step 5: Verificar que compila y commitear**

```bash
echo ".env" >> .gitignore
npm run check
npm run build
```
Expected: ambos terminan sin errores (el build genera `build/` y `.netlify/`).

Comprobar que `.gitignore` (el generado por sv create + nuestra línea) cubre `.env`, `node_modules`, `build`, `.netlify`, `.svelte-kit`, `test-results`.

```bash
git add -A
git commit -m "feat: scaffold SvelteKit + TypeScript con adaptador de Netlify"
```

---

### Task 2: Tipos del dominio y helpers de URLs del CDN

**Files:**
- Create: `src/lib/types.ts`
- Create: `src/lib/cdn.ts`
- Test: `src/lib/cdn.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `interface Photo { publicId: string; folder: string; format: string; width: number; height: number; favorite: boolean }`
  - `interface PhotoIndex { photos: Photo[]; fetchedAt: number; stale: boolean }`
  - `thumbUrl(cloudName: string, photo: Photo): string`
  - `fullUrl(cloudName: string, photo: Photo): string`
  - `downloadUrl(cloudName: string, photo: Photo): string`

Las funciones son puras (el cloud name llega como argumento desde los `load` de servidor; no leen env). `f_auto` exige URLs **sin** extensión, salvo la de descarga, que la lleva junto con `fl_attachment` para forzar el Content-Disposition.

- [ ] **Step 1: Escribir el test que falla**

`src/lib/cdn.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { downloadUrl, fullUrl, thumbUrl } from './cdn';
import type { Photo } from './types';

const photo: Photo = {
	publicId: 'family_uploads/abc123',
	folder: 'family_uploads',
	format: 'jpg',
	width: 1200,
	height: 800,
	favorite: false
};

describe('cdn urls', () => {
	it('builds a square auto-format thumbnail without extension', () => {
		expect(thumbUrl('democloud', photo)).toBe(
			'https://res.cloudinary.com/democloud/image/upload/c_fill,f_auto,q_auto,w_400,h_400/family_uploads/abc123'
		);
	});

	it('builds a large view url without extension', () => {
		expect(fullUrl('democloud', photo)).toBe(
			'https://res.cloudinary.com/democloud/image/upload/f_auto,q_auto,w_1600/family_uploads/abc123'
		);
	});

	it('builds a download url with attachment flag and original extension', () => {
		expect(downloadUrl('democloud', photo)).toBe(
			'https://res.cloudinary.com/democloud/image/upload/fl_attachment/family_uploads/abc123.jpg'
		);
	});
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

```bash
npx vitest run src/lib/cdn.test.ts
```
Expected: FAIL — no existe `./cdn`.

- [ ] **Step 3: Implementar tipos y helpers**

`src/lib/types.ts`:

```ts
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
```

`src/lib/cdn.ts`:

```ts
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
```

- [ ] **Step 4: Verificar que pasa**

```bash
npx vitest run src/lib/cdn.test.ts
```
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
npm run check
git add src/lib/types.ts src/lib/cdn.ts src/lib/cdn.test.ts
git commit -m "feat: tipos Photo/PhotoIndex y helpers de URLs del CDN"
```

---

### Task 3: Sesiones firmadas y verificación de contraseña

**Files:**
- Create: `src/lib/server/session.ts`
- Create: `scripts/hash-password.mjs`
- Test: `src/lib/server/session.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `SESSION_COOKIE = 'fokkelman_session'` (const string)
  - `SESSION_TTL_S = 2592000` (30 días, const number)
  - `createSessionToken(secret: string, now?: number): string` — token `"<expEpochSeconds>.<hmacSha256Hex>"`
  - `verifySessionToken(token: string | undefined, secret: string, now?: number): boolean`
  - `hashPassword(password: string, saltHex?: string): string` — formato `"<saltHex>:<scryptKeyHex>"`
  - `verifyPassword(password: string, stored: string): boolean`

- [ ] **Step 1: Escribir el test que falla**

`src/lib/server/session.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
	createSessionToken,
	hashPassword,
	SESSION_TTL_S,
	verifyPassword,
	verifySessionToken
} from './session';

const SECRET = 'unit-test-secret';

describe('session tokens', () => {
	it('accepts a freshly created token', () => {
		const token = createSessionToken(SECRET);
		expect(verifySessionToken(token, SECRET)).toBe(true);
	});

	it('rejects a tampered token', () => {
		const token = createSessionToken(SECRET);
		const [exp] = token.split('.');
		const forged = `${Number(exp) + 9999}.${token.split('.')[1]}`;
		expect(verifySessionToken(forged, SECRET)).toBe(false);
	});

	it('rejects a token signed with another secret', () => {
		const token = createSessionToken('other-secret');
		expect(verifySessionToken(token, SECRET)).toBe(false);
	});

	it('rejects an expired token', () => {
		const past = Date.now() - (SESSION_TTL_S + 60) * 1000;
		const token = createSessionToken(SECRET, past);
		expect(verifySessionToken(token, SECRET)).toBe(false);
	});

	it('rejects undefined and malformed tokens', () => {
		expect(verifySessionToken(undefined, SECRET)).toBe(false);
		expect(verifySessionToken('garbage', SECRET)).toBe(false);
		expect(verifySessionToken('123.', SECRET)).toBe(false);
	});
});

describe('password hashing', () => {
	it('verifies the correct password against its hash', () => {
		const stored = hashPassword('correct horse');
		expect(verifyPassword('correct horse', stored)).toBe(true);
	});

	it('rejects a wrong password', () => {
		const stored = hashPassword('correct horse');
		expect(verifyPassword('wrong pony', stored)).toBe(false);
	});

	it('rejects a malformed stored hash without throwing', () => {
		expect(verifyPassword('anything', 'not-a-valid-hash')).toBe(false);
		expect(verifyPassword('anything', '')).toBe(false);
	});
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

```bash
npx vitest run src/lib/server/session.test.ts
```
Expected: FAIL — no existe `./session`.

- [ ] **Step 3: Implementar el módulo**

`src/lib/server/session.ts`:

```ts
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'fokkelman_session';
export const SESSION_TTL_S = 60 * 60 * 24 * 30;

function sign(payload: string, secret: string): string {
	return createHmac('sha256', secret).update(payload).digest('hex');
}

export function createSessionToken(secret: string, now: number = Date.now()): string {
	const exp = Math.floor(now / 1000) + SESSION_TTL_S;
	return `${exp}.${sign(String(exp), secret)}`;
}

export function verifySessionToken(
	token: string | undefined,
	secret: string,
	now: number = Date.now()
): boolean {
	if (!token) return false;
	const [expStr, sig] = token.split('.');
	if (!expStr || !sig) return false;
	const expected = Buffer.from(sign(expStr, secret));
	const actual = Buffer.from(sig);
	if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;
	return Number(expStr) > Math.floor(now / 1000);
}

export function hashPassword(
	password: string,
	saltHex: string = randomBytes(16).toString('hex')
): string {
	const key = scryptSync(password.normalize(), saltHex, 32).toString('hex');
	return `${saltHex}:${key}`;
}

export function verifyPassword(password: string, stored: string): boolean {
	const [saltHex, keyHex] = stored.split(':');
	if (!saltHex || !keyHex) return false;
	const expected = Buffer.from(keyHex, 'hex');
	if (expected.length !== 32) return false;
	const actual = scryptSync(password.normalize(), saltHex, 32);
	return timingSafeEqual(actual, expected);
}
```

`scripts/hash-password.mjs` (autocontenido a propósito: no puede importar TS; el formato `salt:key` DEBE coincidir con `session.ts`):

```js
import { randomBytes, scryptSync } from 'node:crypto';

const password = process.argv[2];
if (!password) {
	console.error('Usage: node scripts/hash-password.mjs <password>');
	process.exit(1);
}
const salt = randomBytes(16).toString('hex');
const key = scryptSync(password.normalize(), salt, 32).toString('hex');
console.log(`${salt}:${key}`);
```

- [ ] **Step 4: Verificar que pasa**

```bash
npx vitest run src/lib/server/session.test.ts
node scripts/hash-password.mjs test-password
```
Expected: PASS (8 tests) y el script imprime una línea `hex:hex`.

- [ ] **Step 5: Commit**

```bash
npm run check
git add src/lib/server/session.ts src/lib/server/session.test.ts scripts/hash-password.mjs
git commit -m "feat: sesiones firmadas con HMAC y hash scrypt de la contraseña familiar"
```

---

### Task 4: Cliente REST de Cloudinary (search, tags, firmas de subida)

**Files:**
- Create: `src/lib/server/cloudinary.ts`
- Test: `src/lib/server/cloudinary.test.ts`

**Interfaces:**
- Consumes: `Photo` de `$lib/types`.
- Produces:
  - `interface CloudinaryConfig { cloudName: string; apiKey: string; apiSecret: string; apiBase: string; fetchFn: typeof fetch }`
  - `signParams(params: Record<string, string | number>, apiSecret: string): string` — firma SHA-1 del algoritmo de Cloudinary (params ordenados alfabéticamente, `k=v` unidos por `&`, + secret)
  - `interface UploadSignature { cloudName: string; apiKey: string; timestamp: number; folder: string; signature: string }`
  - `createUploadSignature(cfg: CloudinaryConfig, folder: string, now?: number): UploadSignature`
  - `setFavorite(cfg: CloudinaryConfig, publicId: string, favorite: boolean): Promise<void>`
  - `searchAllPhotos(cfg: CloudinaryConfig, expression: string): Promise<Photo[]>` — pagina con `next_cursor` hasta agotar

`fetchFn` va inyectado en la config para poder testear sin red y para que el wiring use el `fetch` global. `apiBase` permite apuntar al mock en tests/e2e.

- [ ] **Step 1: Escribir el test que falla**

`src/lib/server/cloudinary.test.ts`:

```ts
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
	createUploadSignature,
	searchAllPhotos,
	setFavorite,
	signParams,
	type CloudinaryConfig
} from './cloudinary';

function makeConfig(fetchFn: typeof fetch): CloudinaryConfig {
	return {
		cloudName: 'testcloud',
		apiKey: 'key123',
		apiSecret: 'secret123',
		apiBase: 'https://api.example',
		fetchFn
	};
}

const jsonResponse = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('signParams', () => {
	it('sorts params alphabetically and signs with sha1(query + secret)', () => {
		const expected = createHash('sha1')
			.update('folder=family_uploads&timestamp=1700000000' + 'secret123')
			.digest('hex');
		expect(signParams({ timestamp: 1700000000, folder: 'family_uploads' }, 'secret123')).toBe(
			expected
		);
	});
});

describe('createUploadSignature', () => {
	it('returns everything the browser needs for a signed upload', () => {
		const cfg = makeConfig(fetch);
		const sig = createUploadSignature(cfg, 'family_uploads', 1700000000000);
		expect(sig).toEqual({
			cloudName: 'testcloud',
			apiKey: 'key123',
			timestamp: 1700000000,
			folder: 'family_uploads',
			signature: signParams({ folder: 'family_uploads', timestamp: 1700000000 }, 'secret123')
		});
	});
});

describe('setFavorite', () => {
	it('POSTs a signed add-tag command', async () => {
		const fetchFn = vi.fn().mockResolvedValue(jsonResponse({}));
		await setFavorite(makeConfig(fetchFn as typeof fetch), 'pic1', true);

		const [url, init] = fetchFn.mock.calls[0];
		expect(url).toBe('https://api.example/v1_1/testcloud/image/tags');
		const body = init.body as URLSearchParams;
		expect(body.get('command')).toBe('add');
		expect(body.get('tag')).toBe('favorite');
		expect(body.get('public_ids')).toBe('pic1');
		expect(body.get('api_key')).toBe('key123');
		expect(body.get('signature')).toHaveLength(40);
	});

	it('sends remove when favorite=false and throws on HTTP error', async () => {
		const fetchFn = vi.fn().mockResolvedValue(jsonResponse({}, 500));
		await expect(
			setFavorite(makeConfig(fetchFn as typeof fetch), 'pic1', false)
		).rejects.toThrow('Cloudinary tags API failed: 500');
		const body = fetchFn.mock.calls[0][1].body as URLSearchParams;
		expect(body.get('command')).toBe('remove');
	});
});

describe('searchAllPhotos', () => {
	it('paginates with next_cursor and maps resources to Photo', async () => {
		const fetchFn = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse({
					resources: [
						{ public_id: 'a1', folder: '', format: 'jpg', width: 10, height: 20, tags: ['favorite'] }
					],
					next_cursor: 'cursor-2'
				})
			)
			.mockResolvedValueOnce(
				jsonResponse({
					resources: [{ public_id: 'demo/b2', folder: 'demo', format: 'png', width: 30, height: 40 }]
				})
			);

		const photos = await searchAllPhotos(makeConfig(fetchFn as typeof fetch), 'resource_type:image');

		expect(fetchFn).toHaveBeenCalledTimes(2);
		const secondBody = JSON.parse(fetchFn.mock.calls[1][1].body as string);
		expect(secondBody.next_cursor).toBe('cursor-2');
		expect(photos).toEqual([
			{ publicId: 'a1', folder: '', format: 'jpg', width: 10, height: 20, favorite: true },
			{ publicId: 'demo/b2', folder: 'demo', format: 'png', width: 30, height: 40, favorite: false }
		]);
	});

	it('throws on HTTP error', async () => {
		const fetchFn = vi.fn().mockResolvedValue(jsonResponse({}, 401));
		await expect(
			searchAllPhotos(makeConfig(fetchFn as typeof fetch), 'resource_type:image')
		).rejects.toThrow('Cloudinary search failed: 401');
	});
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

```bash
npx vitest run src/lib/server/cloudinary.test.ts
```
Expected: FAIL — no existe `./cloudinary`.

- [ ] **Step 3: Implementar el cliente**

`src/lib/server/cloudinary.ts`:

```ts
import { createHash } from 'node:crypto';
import type { Photo } from '$lib/types';

export interface CloudinaryConfig {
	cloudName: string;
	apiKey: string;
	apiSecret: string;
	/** default https://api.cloudinary.com; en tests/e2e apunta al mock */
	apiBase: string;
	fetchFn: typeof fetch;
}

export function signParams(params: Record<string, string | number>, apiSecret: string): string {
	const toSign = Object.keys(params)
		.sort()
		.map((k) => `${k}=${params[k]}`)
		.join('&');
	return createHash('sha1').update(toSign + apiSecret).digest('hex');
}

export interface UploadSignature {
	cloudName: string;
	apiKey: string;
	timestamp: number;
	folder: string;
	signature: string;
}

export function createUploadSignature(
	cfg: CloudinaryConfig,
	folder: string,
	now: number = Date.now()
): UploadSignature {
	const timestamp = Math.floor(now / 1000);
	return {
		cloudName: cfg.cloudName,
		apiKey: cfg.apiKey,
		timestamp,
		folder,
		signature: signParams({ folder, timestamp }, cfg.apiSecret)
	};
}

export async function setFavorite(
	cfg: CloudinaryConfig,
	publicId: string,
	favorite: boolean
): Promise<void> {
	const params = {
		command: favorite ? 'add' : 'remove',
		public_ids: publicId,
		tag: 'favorite',
		timestamp: Math.floor(Date.now() / 1000)
	};
	const body = new URLSearchParams({
		command: params.command,
		public_ids: params.public_ids,
		tag: params.tag,
		timestamp: String(params.timestamp),
		api_key: cfg.apiKey,
		signature: signParams(params, cfg.apiSecret)
	});
	const res = await cfg.fetchFn(`${cfg.apiBase}/v1_1/${cfg.cloudName}/image/tags`, {
		method: 'POST',
		body
	});
	if (!res.ok) throw new Error(`Cloudinary tags API failed: ${res.status}`);
}

interface SearchResource {
	public_id: string;
	folder?: string;
	format: string;
	width: number;
	height: number;
	tags?: string[];
}

export async function searchAllPhotos(
	cfg: CloudinaryConfig,
	expression: string
): Promise<Photo[]> {
	const photos: Photo[] = [];
	const auth = 'Basic ' + Buffer.from(`${cfg.apiKey}:${cfg.apiSecret}`).toString('base64');
	let nextCursor: string | undefined;
	do {
		const res = await cfg.fetchFn(`${cfg.apiBase}/v1_1/${cfg.cloudName}/resources/search`, {
			method: 'POST',
			headers: { Authorization: auth, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				expression,
				max_results: 500,
				with_field: ['tags'],
				sort_by: [{ public_id: 'asc' }],
				...(nextCursor ? { next_cursor: nextCursor } : {})
			})
		});
		if (!res.ok) throw new Error(`Cloudinary search failed: ${res.status}`);
		const data = (await res.json()) as { resources: SearchResource[]; next_cursor?: string };
		for (const r of data.resources) {
			photos.push({
				publicId: r.public_id,
				folder: r.folder ?? '',
				format: r.format,
				width: r.width,
				height: r.height,
				favorite: (r.tags ?? []).includes('favorite')
			});
		}
		nextCursor = data.next_cursor;
	} while (nextCursor);
	return photos;
}
```

- [ ] **Step 4: Verificar que pasa**

```bash
npx vitest run src/lib/server/cloudinary.test.ts
```
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
npm run check
git add src/lib/server/cloudinary.ts src/lib/server/cloudinary.test.ts
git commit -m "feat: cliente REST de Cloudinary con búsqueda paginada, tags y firmas"
```

---

### Task 5: Caché del índice con TTL, invalidación y stale-while-error

**Files:**
- Create: `src/lib/server/photoIndex.ts`
- Create: `src/lib/server/photos.ts`
- Test: `src/lib/server/photoIndex.test.ts`

**Interfaces:**
- Consumes: `Photo`, `PhotoIndex` de `$lib/types`; `searchAllPhotos`, `CloudinaryConfig` de `./cloudinary` (Task 4).
- Produces:
  - `interface IndexCache { get(): Promise<PhotoIndex>; invalidate(): void }`
  - `createIndexCache(fetcher: () => Promise<Photo[]>, ttlMs?: number, nowFn?: () => number): IndexCache` (TTL default 300 000 ms)
  - En `photos.ts` (wiring, sin lógica testable propia): `cloudinaryConfig(): CloudinaryConfig`, `getFamilyIndex(): Promise<PhotoIndex>`, `getDemoIndex(): Promise<PhotoIndex>`, `invalidateFamilyIndex(): void`, `DEMO_FOLDER = 'demo'`, `UPLOAD_FOLDER = 'family_uploads'`

Nota de diseño: no se deduplican fetches concurrentes (YAGNI a escala familiar; lo peor es una llamada extra a la Search API).

- [ ] **Step 1: Escribir el test que falla**

`src/lib/server/photoIndex.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createIndexCache } from './photoIndex';
import type { Photo } from '$lib/types';

const photo = (publicId: string): Photo => ({
	publicId,
	folder: '',
	format: 'jpg',
	width: 1,
	height: 1,
	favorite: false
});

describe('createIndexCache', () => {
	it('fetches once and serves from cache within the TTL', async () => {
		let now = 0;
		const fetcher = vi.fn().mockResolvedValue([photo('a')]);
		const cache = createIndexCache(fetcher, 5000, () => now);

		const first = await cache.get();
		now = 4000;
		const second = await cache.get();

		expect(fetcher).toHaveBeenCalledTimes(1);
		expect(first).toEqual({ photos: [photo('a')], fetchedAt: 0, stale: false });
		expect(second.stale).toBe(false);
	});

	it('refetches after the TTL expires', async () => {
		let now = 0;
		const fetcher = vi.fn().mockResolvedValue([photo('a')]);
		const cache = createIndexCache(fetcher, 5000, () => now);

		await cache.get();
		now = 6000;
		const result = await cache.get();

		expect(fetcher).toHaveBeenCalledTimes(2);
		expect(result.fetchedAt).toBe(6000);
	});

	it('serves the stale copy when the refetch fails', async () => {
		let now = 0;
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce([photo('a')])
			.mockRejectedValueOnce(new Error('rate limited'));
		const cache = createIndexCache(fetcher, 5000, () => now);

		await cache.get();
		now = 6000;
		const result = await cache.get();

		expect(result).toEqual({ photos: [photo('a')], fetchedAt: 0, stale: true });
	});

	it('throws when there is no cached copy and the fetch fails', async () => {
		const fetcher = vi.fn().mockRejectedValue(new Error('down'));
		const cache = createIndexCache(fetcher, 5000, () => 0);
		await expect(cache.get()).rejects.toThrow('down');
	});

	it('invalidate() forces the next get to refetch', async () => {
		let now = 0;
		const fetcher = vi.fn().mockResolvedValue([photo('a')]);
		const cache = createIndexCache(fetcher, 5000, () => now);

		await cache.get();
		cache.invalidate();
		await cache.get();

		expect(fetcher).toHaveBeenCalledTimes(2);
	});
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

```bash
npx vitest run src/lib/server/photoIndex.test.ts
```
Expected: FAIL — no existe `./photoIndex`.

- [ ] **Step 3: Implementar caché y wiring**

`src/lib/server/photoIndex.ts`:

```ts
import type { Photo, PhotoIndex } from '$lib/types';

export interface IndexCache {
	get(): Promise<PhotoIndex>;
	invalidate(): void;
}

export function createIndexCache(
	fetcher: () => Promise<Photo[]>,
	ttlMs = 5 * 60_000,
	nowFn: () => number = () => Date.now()
): IndexCache {
	let cached: { photos: Photo[]; fetchedAt: number } | null = null;

	return {
		async get(): Promise<PhotoIndex> {
			const now = nowFn();
			if (cached && now - cached.fetchedAt < ttlMs) {
				return { ...cached, stale: false };
			}
			try {
				const photos = await fetcher();
				cached = { photos, fetchedAt: now };
				return { photos, fetchedAt: now, stale: false };
			} catch (err) {
				if (cached) return { ...cached, stale: true };
				throw err;
			}
		},
		invalidate() {
			cached = null;
		}
	};
}
```

`src/lib/server/photos.ts`:

```ts
import { env } from '$env/dynamic/private';
import { searchAllPhotos, type CloudinaryConfig } from './cloudinary';
import { createIndexCache } from './photoIndex';

export const DEMO_FOLDER = 'demo';
export const UPLOAD_FOLDER = 'family_uploads';

export function cloudinaryConfig(): CloudinaryConfig {
	return {
		cloudName: env.CLOUDINARY_CLOUD_NAME ?? '',
		apiKey: env.CLOUDINARY_API_KEY ?? '',
		apiSecret: env.CLOUDINARY_API_SECRET ?? '',
		apiBase: env.CLOUDINARY_API_BASE || 'https://api.cloudinary.com',
		fetchFn: fetch
	};
}

const familyCache = createIndexCache(() =>
	searchAllPhotos(cloudinaryConfig(), `resource_type:image AND -folder:${DEMO_FOLDER}`)
);
const demoCache = createIndexCache(() =>
	searchAllPhotos(cloudinaryConfig(), `resource_type:image AND folder:${DEMO_FOLDER}`)
);

export const getFamilyIndex = () => familyCache.get();
export const getDemoIndex = () => demoCache.get();
export const invalidateFamilyIndex = () => familyCache.invalidate();
```

- [ ] **Step 4: Verificar que pasa**

```bash
npx vitest run src/lib/server/photoIndex.test.ts
```
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
npm run check
git add src/lib/server/photoIndex.ts src/lib/server/photoIndex.test.ts src/lib/server/photos.ts
git commit -m "feat: caché del índice de fotos con TTL, stale-while-error y wiring de env"
```

---

### Task 6: Guard de autenticación, login y logout

**Files:**
- Create: `src/lib/server/guard.ts`
- Create: `src/hooks.server.ts`
- Create: `src/routes/login/+page.server.ts`
- Create: `src/routes/login/+page.svelte`
- Create: `src/routes/logout/+server.ts`
- Modify: `src/app.d.ts`
- Test: `src/lib/server/guard.test.ts`

**Interfaces:**
- Consumes: `SESSION_COOKIE`, `SESSION_TTL_S`, `createSessionToken`, `verifySessionToken`, `verifyPassword` de `$lib/server/session` (Task 3).
- Produces:
  - `isPrivatePath(pathname: string): boolean` — true para `/app`, `/app/*` y `/api/*`
  - `event.locals.authed: boolean` disponible en toda la app
  - Rutas: `POST /login` (form action default, campo `password`), `POST /logout`
  - Comportamiento del guard del que dependen las tareas 7-10: página privada sin sesión → redirect 303 a `/login?next=<path>`; endpoint `/api/*` sin sesión → 401

- [ ] **Step 1: Escribir el test que falla**

`src/lib/server/guard.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isPrivatePath } from './guard';

describe('isPrivatePath', () => {
	it('protects the app and the api', () => {
		expect(isPrivatePath('/app')).toBe(true);
		expect(isPrivatePath('/app/photo/family_uploads/x')).toBe(true);
		expect(isPrivatePath('/api/favorite')).toBe(true);
	});

	it('leaves public routes open', () => {
		expect(isPrivatePath('/')).toBe(false);
		expect(isPrivatePath('/demo')).toBe(false);
		expect(isPrivatePath('/login')).toBe(false);
		expect(isPrivatePath('/apple')).toBe(false);
	});
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

```bash
npx vitest run src/lib/server/guard.test.ts
```
Expected: FAIL — no existe `./guard`.

- [ ] **Step 3: Implementar guard, hook y rutas**

`src/lib/server/guard.ts`:

```ts
export function isPrivatePath(pathname: string): boolean {
	return pathname === '/app' || pathname.startsWith('/app/') || pathname.startsWith('/api/');
}
```

`src/app.d.ts` (añadir `authed` a `Locals`):

```ts
declare global {
	namespace App {
		interface Locals {
			authed: boolean;
		}
	}
}

export {};
```

`src/hooks.server.ts`:

```ts
import { error, redirect, type Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { isPrivatePath } from '$lib/server/guard';
import { SESSION_COOKIE, verifySessionToken } from '$lib/server/session';

export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get(SESSION_COOKIE);
	event.locals.authed = verifySessionToken(token, env.SESSION_SECRET ?? '');

	if (!event.locals.authed && isPrivatePath(event.url.pathname)) {
		if (event.url.pathname.startsWith('/api/')) error(401, 'Unauthorized');
		redirect(303, `/login?next=${encodeURIComponent(event.url.pathname)}`);
	}
	return resolve(event);
};
```

`src/routes/login/+page.server.ts` (el retardo progresivo por IP es best-effort: el `Map` vive por instancia de función, suficiente para el modelo de amenaza familiar):

```ts
import { fail, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import {
	createSessionToken,
	SESSION_COOKIE,
	SESSION_TTL_S,
	verifyPassword
} from '$lib/server/session';
import type { Actions, PageServerLoad } from './$types';

const failedAttempts = new Map<string, number>();

export const load: PageServerLoad = ({ locals }) => {
	if (locals.authed) redirect(303, '/app');
};

export const actions: Actions = {
	default: async ({ request, cookies, getClientAddress, url }) => {
		const form = await request.formData();
		const password = String(form.get('password') ?? '');
		const ip = getClientAddress();

		const failed = failedAttempts.get(ip) ?? 0;
		if (failed > 0) await new Promise((r) => setTimeout(r, Math.min(failed, 6) * 500));

		if (!verifyPassword(password, env.FAMILY_PASSWORD_HASH ?? '')) {
			failedAttempts.set(ip, failed + 1);
			return fail(400, { incorrect: true });
		}

		failedAttempts.delete(ip);
		cookies.set(SESSION_COOKIE, createSessionToken(env.SESSION_SECRET ?? ''), {
			path: '/',
			httpOnly: true,
			secure: true,
			sameSite: 'lax',
			maxAge: SESSION_TTL_S
		});

		const next = url.searchParams.get('next');
		redirect(303, next && next.startsWith('/') ? next : '/app');
	}
};
```

`src/routes/login/+page.svelte`:

```svelte
<script lang="ts">
	import { enhance } from '$app/forms';
	let { form } = $props();
</script>

<svelte:head><title>Sign in · Fokkelman Photo Vault</title></svelte:head>

<main>
	<form method="POST" use:enhance>
		<h1>Fokkelman Photo Vault</h1>
		<p>Enter the family password to continue.</p>
		<input
			type="password"
			name="password"
			placeholder="Family password"
			autocomplete="current-password"
			required
		/>
		<button type="submit">Sign in</button>
		{#if form?.incorrect}<p class="error" role="alert">Incorrect password.</p>{/if}
	</form>
</main>

<style>
	main {
		min-height: 100vh;
		display: grid;
		place-items: center;
		background: var(--surface);
	}
	form {
		background: var(--bg);
		padding: 2.5rem;
		border-radius: var(--radius);
		box-shadow: 0 1px 4px rgb(0 0 0 / 0.15);
		display: grid;
		gap: 1rem;
		width: min(90vw, 380px);
	}
	h1 {
		margin: 0;
		font-size: 1.4rem;
	}
	p {
		margin: 0;
		color: var(--text-dim);
	}
	input {
		font: inherit;
		padding: 0.75rem;
		border: 1px solid var(--text-dim);
		border-radius: var(--radius);
	}
	button {
		padding: 0.75rem;
		border: none;
		border-radius: var(--radius);
		background: var(--accent);
		color: white;
		font-weight: 600;
	}
	.error {
		color: var(--danger);
	}
</style>
```

`src/routes/logout/+server.ts`:

```ts
import { redirect } from '@sveltejs/kit';
import { SESSION_COOKIE } from '$lib/server/session';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = ({ cookies }) => {
	cookies.delete(SESSION_COOKIE, { path: '/' });
	redirect(303, '/');
};
```

- [ ] **Step 4: Verificar que pasa**

```bash
npx vitest run src/lib/server/guard.test.ts
npm run check
```
Expected: PASS (2 tests) y `check` sin errores. El flujo completo de login se verifica end-to-end en la Task 12.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/guard.ts src/lib/server/guard.test.ts src/hooks.server.ts src/app.d.ts src/routes/login src/routes/logout
git commit -m "feat: guard de sesión, página de login y logout"
```

---

### Task 7: Galería con filtros y scroll infinito

**Files:**
- Create: `src/lib/filterPhotos.ts`
- Create: `src/lib/components/TopBar.svelte`
- Create: `src/lib/components/PhotoGrid.svelte`
- Create: `src/routes/app/+layout.server.ts`
- Create: `src/routes/app/+layout.svelte`
- Create: `src/routes/app/+page.svelte`
- Create: `src/routes/app/+error.svelte`
- Test: `src/lib/filterPhotos.test.ts`

**Interfaces:**
- Consumes: `Photo` de `$lib/types`; `thumbUrl` de `$lib/cdn` (Task 2); `getFamilyIndex` de `$lib/server/photos` (Task 5).
- Produces:
  - `interface GalleryFilters { folder: string; query: string; favoritesOnly: boolean }`
  - `filterPhotos(photos: Photo[], filters: GalleryFilters): Photo[]`
  - `filtersFromSearchParams(params: URLSearchParams): GalleryFilters` — lee `folder`, `q`, `fav` (la Task 8 la reutiliza para que prev/next del visor siga el orden filtrado)
  - `uniqueFolders(photos: Photo[]): string[]`
  - Layout data de `/app` (del `+layout.server.ts`, con `depends('app:photos')`): `{ photos: Photo[]; fetchedAt: number; stale: boolean; cloudName: string }` — las tareas 8 y 9 la leen vía `page.data`
  - Componentes: `TopBar` props `{ folders: string[]; filters: GalleryFilters; total: number; stale: boolean; onUpload?: () => void }`; `PhotoGrid` props `{ photos: Photo[]; cloudName: string; onOpen: (publicId: string) => void }`

- [ ] **Step 1: Escribir el test que falla**

`src/lib/filterPhotos.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { filterPhotos, filtersFromSearchParams, uniqueFolders } from './filterPhotos';
import type { Photo } from './types';

const photo = (publicId: string, folder = '', favorite = false): Photo => ({
	publicId,
	folder,
	format: 'jpg',
	width: 1,
	height: 1,
	favorite
});

const photos = [
	photo('Fokkelman10_001_ab'),
	photo('family_uploads/beach_x1', 'family_uploads', true),
	photo('family_uploads/BEACH_x2', 'family_uploads')
];

describe('filterPhotos', () => {
	it('returns everything with empty filters', () => {
		expect(filterPhotos(photos, { folder: '', query: '', favoritesOnly: false })).toHaveLength(3);
	});

	it('filters by exact folder', () => {
		const result = filterPhotos(photos, { folder: 'family_uploads', query: '', favoritesOnly: false });
		expect(result.map((p) => p.publicId)).toEqual([
			'family_uploads/beach_x1',
			'family_uploads/BEACH_x2'
		]);
	});

	it('filters by case-insensitive substring of publicId', () => {
		const result = filterPhotos(photos, { folder: '', query: 'beach', favoritesOnly: false });
		expect(result).toHaveLength(2);
	});

	it('filters favorites only, combinable with the rest', () => {
		const result = filterPhotos(photos, { folder: 'family_uploads', query: 'beach', favoritesOnly: true });
		expect(result.map((p) => p.publicId)).toEqual(['family_uploads/beach_x1']);
	});
});

describe('filtersFromSearchParams', () => {
	it('reads folder, q and fav', () => {
		expect(filtersFromSearchParams(new URLSearchParams('folder=demo&q=cat&fav=1'))).toEqual({
			folder: 'demo',
			query: 'cat',
			favoritesOnly: true
		});
	});

	it('defaults to empty filters', () => {
		expect(filtersFromSearchParams(new URLSearchParams())).toEqual({
			folder: '',
			query: '',
			favoritesOnly: false
		});
	});
});

describe('uniqueFolders', () => {
	it('returns sorted unique non-root folders', () => {
		expect(uniqueFolders(photos)).toEqual(['family_uploads']);
	});
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

```bash
npx vitest run src/lib/filterPhotos.test.ts
```
Expected: FAIL — no existe `./filterPhotos`.

- [ ] **Step 3: Implementar la lógica pura**

`src/lib/filterPhotos.ts`:

```ts
import type { Photo } from './types';

export interface GalleryFilters {
	folder: string;
	query: string;
	favoritesOnly: boolean;
}

export function filterPhotos(photos: Photo[], filters: GalleryFilters): Photo[] {
	const q = filters.query.trim().toLowerCase();
	return photos.filter(
		(p) =>
			(!filters.folder || p.folder === filters.folder) &&
			(!filters.favoritesOnly || p.favorite) &&
			(!q || p.publicId.toLowerCase().includes(q))
	);
}

export function filtersFromSearchParams(params: URLSearchParams): GalleryFilters {
	return {
		folder: params.get('folder') ?? '',
		query: params.get('q') ?? '',
		favoritesOnly: params.get('fav') === '1'
	};
}

export function uniqueFolders(photos: Photo[]): string[] {
	return [...new Set(photos.map((p) => p.folder).filter(Boolean))].sort();
}
```

- [ ] **Step 4: Verificar que pasa**

```bash
npx vitest run src/lib/filterPhotos.test.ts
```
Expected: PASS (7 tests).

- [ ] **Step 5: Cargar el índice en el layout de /app**

`src/routes/app/+layout.server.ts`:

```ts
import { env } from '$env/dynamic/private';
import { getFamilyIndex } from '$lib/server/photos';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ depends }) => {
	depends('app:photos');
	const index = await getFamilyIndex();
	return { ...index, cloudName: env.CLOUDINARY_CLOUD_NAME ?? '' };
};
```

`src/routes/app/+error.svelte`:

```svelte
<script lang="ts">
	import { page } from '$app/state';
</script>

<main>
	<h1>Something went wrong</h1>
	<p>{page.error?.message ?? 'The photo library is unavailable right now. Please try again in a few minutes.'}</p>
	<a href="/app">Try again</a>
</main>

<style>
	main {
		min-height: 60vh;
		display: grid;
		place-content: center;
		gap: 0.5rem;
		text-align: center;
	}
</style>
```

- [ ] **Step 6: Componentes TopBar y PhotoGrid**

`src/lib/components/TopBar.svelte` (los cambios de filtro navegan con `goto` para que la URL sea compartible; `keepFocus` evita perder el foco al teclear):

```svelte
<script lang="ts">
	import { goto } from '$app/navigation';
	import type { GalleryFilters } from '$lib/filterPhotos';

	let {
		folders,
		filters,
		total,
		stale,
		onUpload
	}: {
		folders: string[];
		filters: GalleryFilters;
		total: number;
		stale: boolean;
		onUpload?: () => void;
	} = $props();

	function apply(patch: Partial<GalleryFilters>) {
		const next = { ...filters, ...patch };
		const params = new URLSearchParams();
		if (next.folder) params.set('folder', next.folder);
		if (next.query) params.set('q', next.query);
		if (next.favoritesOnly) params.set('fav', '1');
		const qs = params.toString();
		goto(`/app${qs ? `?${qs}` : ''}`, { keepFocus: true, noScroll: false });
	}
</script>

<header>
	<a class="brand" href="/app">Fokkelman Photo Vault</a>

	<select
		aria-label="Collection"
		value={filters.folder}
		onchange={(e) => apply({ folder: e.currentTarget.value })}
	>
		<option value="">All collections</option>
		{#each folders as folder (folder)}
			<option value={folder}>{folder}</option>
		{/each}
	</select>

	<input
		type="search"
		placeholder="Search by file name…"
		aria-label="Search photos"
		value={filters.query}
		oninput={(e) => apply({ query: e.currentTarget.value })}
	/>

	<button
		class="chip"
		aria-pressed={filters.favoritesOnly}
		onclick={() => apply({ favoritesOnly: !filters.favoritesOnly })}
	>
		★ Favorites
	</button>

	<span class="count">{total.toLocaleString('en-US')} photos</span>
	{#if stale}<span class="stale" title="Showing a cached copy">offline copy</span>{/if}

	{#if onUpload}<button class="upload" onclick={onUpload}>Upload</button>{/if}

	<form method="POST" action="/logout">
		<button class="chip" type="submit">Log out</button>
	</form>
</header>

<style>
	header {
		position: sticky;
		top: 0;
		z-index: 10;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
		padding: 0.6rem 1rem;
		background: var(--bg);
		border-bottom: 1px solid var(--surface);
	}
	.brand {
		font-weight: 700;
		color: var(--text);
		text-decoration: none;
		margin-right: 0.5rem;
	}
	select,
	input {
		font: inherit;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--surface);
		border-radius: var(--radius);
		background: var(--surface);
	}
	input {
		flex: 1;
		min-width: 160px;
	}
	.chip {
		padding: 0.5rem 0.9rem;
		border: 1px solid var(--surface);
		border-radius: 999px;
		background: var(--bg);
	}
	.chip[aria-pressed='true'] {
		background: var(--accent);
		color: white;
		border-color: var(--accent);
	}
	.upload {
		padding: 0.5rem 1.1rem;
		border: none;
		border-radius: 999px;
		background: var(--accent);
		color: white;
		font-weight: 600;
	}
	.count {
		color: var(--text-dim);
		font-size: 0.9rem;
	}
	.stale {
		color: var(--danger);
		font-size: 0.85rem;
	}
</style>
```

`src/lib/components/PhotoGrid.svelte`:

```svelte
<script lang="ts">
	import { thumbUrl } from '$lib/cdn';
	import type { Photo } from '$lib/types';

	let {
		photos,
		cloudName,
		onOpen
	}: {
		photos: Photo[];
		cloudName: string;
		onOpen: (publicId: string) => void;
	} = $props();

	const BATCH = 60;
	let visibleCount = $state(BATCH);
	let sentinel = $state<HTMLElement>();

	// Al cambiar la lista (filtros), volver al primer lote
	$effect(() => {
		void photos;
		visibleCount = BATCH;
	});

	$effect(() => {
		if (!sentinel) return;
		const io = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting) {
					visibleCount = Math.min(visibleCount + BATCH, photos.length);
				}
			},
			{ rootMargin: '600px' }
		);
		io.observe(sentinel);
		return () => io.disconnect();
	});
</script>

{#if photos.length === 0}
	<p class="empty">No photos match your filters.</p>
{:else}
	<div class="grid" data-testid="photo-grid">
		{#each photos.slice(0, visibleCount) as photo (photo.publicId)}
			<button class="cell" onclick={() => onOpen(photo.publicId)} aria-label="Open {photo.publicId}">
				<img src={thumbUrl(cloudName, photo)} alt={photo.publicId} loading="lazy" />
				{#if photo.favorite}<span class="star" aria-hidden="true">★</span>{/if}
			</button>
		{/each}
	</div>
	{#if visibleCount < photos.length}
		<div bind:this={sentinel} class="sentinel" data-testid="grid-sentinel"></div>
	{/if}
{/if}

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
		gap: 4px;
		padding: 4px;
	}
	.cell {
		position: relative;
		padding: 0;
		border: none;
		background: var(--surface);
		aspect-ratio: 1;
		overflow: hidden;
		border-radius: 4px;
	}
	.cell img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.star {
		position: absolute;
		bottom: 6px;
		left: 8px;
		color: white;
		text-shadow: 0 1px 3px rgb(0 0 0 / 0.7);
		font-size: 1.1rem;
	}
	.sentinel {
		height: 1px;
	}
	.empty {
		padding: 3rem;
		text-align: center;
		color: var(--text-dim);
	}
</style>
```

- [ ] **Step 7: Layout y página de /app**

`src/routes/app/+layout.svelte` (la cuadrícula vive aquí para que la ruta del visor la mantenga debajo del lightbox; el botón Upload se cablea en la Task 9 — de momento no se pasa `onUpload`):

```svelte
<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import PhotoGrid from '$lib/components/PhotoGrid.svelte';
	import TopBar from '$lib/components/TopBar.svelte';
	import { filterPhotos, filtersFromSearchParams, uniqueFolders } from '$lib/filterPhotos';

	let { data, children } = $props();

	const filters = $derived(filtersFromSearchParams(page.url.searchParams));
	const filtered = $derived(filterPhotos(data.photos, filters));
</script>

<svelte:head><title>Fokkelman Photo Vault</title></svelte:head>

<TopBar
	folders={uniqueFolders(data.photos)}
	{filters}
	total={filtered.length}
	stale={data.stale}
/>

<PhotoGrid
	photos={filtered}
	cloudName={data.cloudName}
	onOpen={(publicId) => goto(`/app/photo/${publicId}${page.url.search}`)}
/>

{@render children()}
```

`src/routes/app/+page.svelte`:

```svelte
<!-- La galería se renderiza en +layout.svelte; esta ruta no añade contenido propio. -->
```

- [ ] **Step 8: Verificar y commitear**

```bash
npm run check
npm run test:unit
```
Expected: check sin errores; todos los tests unitarios PASS. La verificación visual llega con la suite e2e (Task 12); si se dispone de credenciales reales en `.env`, `npm run dev` y abrir `http://localhost:5173/app` debe mostrar la cuadrícula con las ~3.659 fotos.

```bash
git add src/lib/filterPhotos.ts src/lib/filterPhotos.test.ts src/lib/components/TopBar.svelte src/lib/components/PhotoGrid.svelte src/routes/app
git commit -m "feat: galería con colecciones, búsqueda, favoritos y scroll infinito"
```

---

### Task 8: Visor lightbox y endpoint de favoritos

**Files:**
- Create: `src/lib/components/Lightbox.svelte`
- Create: `src/routes/app/photo/[...id]/+page.svelte`
- Create: `src/routes/api/favorite/+server.ts`

**Interfaces:**
- Consumes: layout data de `/app` vía `page.data` (Task 7); `filterPhotos`, `filtersFromSearchParams` (Task 7); `fullUrl`, `thumbUrl`, `downloadUrl` (Task 2); `setFavorite` (Task 4); `cloudinaryConfig`, `invalidateFamilyIndex` (Task 5).
- Produces:
  - `POST /api/favorite` con JSON `{ publicId: string; favorite: boolean }` → 204 (o 400 si el body es inválido). La demo NO usa este endpoint.
  - Componente `Lightbox` con props `{ photo: Photo; cloudName: string; favorite: boolean; onClose: () => void; onPrev?: () => void; onNext?: () => void; onToggleFavorite: () => void }` — reutilizado tal cual por la demo (Task 10).
  - Ruta `/app/photo/[...id]` (rest param: los `public_id` con carpeta llevan `/`).

- [ ] **Step 1: Endpoint de favoritos**

`src/routes/api/favorite/+server.ts`:

```ts
import { json } from '@sveltejs/kit';
import { setFavorite } from '$lib/server/cloudinary';
import { cloudinaryConfig, invalidateFamilyIndex } from '$lib/server/photos';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json().catch(() => null)) as {
		publicId?: unknown;
		favorite?: unknown;
	} | null;

	if (!body || typeof body.publicId !== 'string' || typeof body.favorite !== 'boolean') {
		return json({ message: 'publicId (string) and favorite (boolean) are required' }, { status: 400 });
	}

	await setFavorite(cloudinaryConfig(), body.publicId, body.favorite);
	invalidateFamilyIndex();
	return new Response(null, { status: 204 });
};
```

- [ ] **Step 2: Componente Lightbox**

`src/lib/components/Lightbox.svelte` (carga progresiva: la miniatura se muestra ampliada y borrosa hasta que llega la grande; swipe táctil con Pointer Events):

```svelte
<script lang="ts">
	import { downloadUrl, fullUrl, thumbUrl } from '$lib/cdn';
	import type { Photo } from '$lib/types';

	let {
		photo,
		cloudName,
		favorite,
		onClose,
		onPrev,
		onNext,
		onToggleFavorite
	}: {
		photo: Photo;
		cloudName: string;
		favorite: boolean;
		onClose: () => void;
		onPrev?: () => void;
		onNext?: () => void;
		onToggleFavorite: () => void;
	} = $props();

	let fullLoaded = $state(false);
	let pointerStartX = $state<number | null>(null);

	$effect(() => {
		void photo.publicId;
		fullLoaded = false;
	});

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
		if (e.key === 'ArrowLeft') onPrev?.();
		if (e.key === 'ArrowRight') onNext?.();
	}

	function onpointerdown(e: PointerEvent) {
		pointerStartX = e.clientX;
	}

	function onpointerup(e: PointerEvent) {
		if (pointerStartX === null) return;
		const dx = e.clientX - pointerStartX;
		pointerStartX = null;
		if (dx > 50) onPrev?.();
		if (dx < -50) onNext?.();
	}
</script>

<svelte:window {onkeydown} />

<div class="overlay" role="dialog" aria-modal="true" aria-label="Photo viewer" {onpointerdown} {onpointerup}>
	<div class="stage">
		{#if !fullLoaded}
			<img class="placeholder" src={thumbUrl(cloudName, photo)} alt="" aria-hidden="true" />
		{/if}
		<img
			class="full"
			class:visible={fullLoaded}
			src={fullUrl(cloudName, photo)}
			alt={photo.publicId}
			onload={() => (fullLoaded = true)}
		/>
	</div>

	<div class="toolbar">
		<button
			class="action"
			aria-pressed={favorite}
			aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
			onclick={onToggleFavorite}
		>
			{favorite ? '★' : '☆'} Favorite
		</button>
		<a class="action" href={downloadUrl(cloudName, photo)} download>⬇ Download</a>
		<button class="action" aria-label="Close viewer" onclick={onClose}>✕ Close</button>
	</div>

	{#if onPrev}
		<button class="nav prev" aria-label="Previous photo" onclick={onPrev}>‹</button>
	{/if}
	{#if onNext}
		<button class="nav next" aria-label="Next photo" onclick={onNext}>›</button>
	{/if}
</div>

<style>
	.overlay {
		position: fixed;
		inset: 0;
		z-index: 100;
		background: rgb(0 0 0 / 0.92);
		display: grid;
		place-items: center;
		touch-action: pan-y;
	}
	.stage {
		position: relative;
		width: 100vw;
		height: 100vh;
		display: grid;
		place-items: center;
	}
	.stage img {
		max-width: 100vw;
		max-height: 100vh;
		object-fit: contain;
	}
	.placeholder {
		position: absolute;
		filter: blur(8px);
	}
	.full {
		opacity: 0;
		transition: opacity 0.2s;
	}
	.full.visible {
		opacity: 1;
	}
	.toolbar {
		position: fixed;
		top: 0;
		right: 0;
		display: flex;
		gap: 0.5rem;
		padding: 0.75rem;
	}
	.action {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.6rem 1rem;
		border: none;
		border-radius: 999px;
		background: rgb(255 255 255 / 0.15);
		color: white;
		text-decoration: none;
		font: inherit;
	}
	.action[aria-pressed='true'] {
		background: var(--accent);
	}
	.nav {
		position: fixed;
		top: 50%;
		transform: translateY(-50%);
		border: none;
		background: rgb(255 255 255 / 0.15);
		color: white;
		font-size: 2.5rem;
		line-height: 1;
		padding: 0.75rem 1rem;
		border-radius: 999px;
	}
	.prev {
		left: 1rem;
	}
	.next {
		right: 1rem;
	}
</style>
```

- [ ] **Step 3: Ruta del visor**

`src/routes/app/photo/[...id]/+page.svelte` (prev/next recorren la **lista filtrada** en el mismo orden que la cuadrícula; los filtros viajan en la query string):

```svelte
<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import Lightbox from '$lib/components/Lightbox.svelte';
	import { filterPhotos, filtersFromSearchParams } from '$lib/filterPhotos';
	import type { Photo } from '$lib/types';

	const photos = $derived(page.data.photos as Photo[]);
	const cloudName = $derived(page.data.cloudName as string);
	const list = $derived(filterPhotos(photos, filtersFromSearchParams(page.url.searchParams)));
	const index = $derived(list.findIndex((p) => p.publicId === page.params.id));
	const photo = $derived(index >= 0 ? list[index] : undefined);

	function goTo(i: number) {
		goto(`/app/photo/${list[i].publicId}${page.url.search}`, {
			replaceState: true,
			noScroll: true
		});
	}

	async function toggleFavorite() {
		if (!photo) return;
		const res = await fetch('/api/favorite', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ publicId: photo.publicId, favorite: !photo.favorite })
		});
		if (res.ok) await invalidate('app:photos');
		else alert('Could not update the favorite. Please try again.');
	}
</script>

{#if photo}
	<Lightbox
		{photo}
		{cloudName}
		favorite={photo.favorite}
		onClose={() => goto(`/app${page.url.search}`, { noScroll: true })}
		onPrev={index > 0 ? () => goTo(index - 1) : undefined}
		onNext={index < list.length - 1 ? () => goTo(index + 1) : undefined}
		onToggleFavorite={toggleFavorite}
	/>
{:else}
	<div class="missing">
		<p>Photo not found.</p>
		<a href="/app">Back to the gallery</a>
	</div>
{/if}

<style>
	.missing {
		position: fixed;
		inset: 0;
		z-index: 100;
		background: rgb(0 0 0 / 0.92);
		color: white;
		display: grid;
		place-content: center;
		gap: 0.5rem;
		text-align: center;
	}
	.missing a {
		color: white;
	}
</style>
```

- [ ] **Step 4: Verificar y commitear**

```bash
npm run check
npm run test:unit
```
Expected: sin errores. El flujo favorito + visor se cubre end-to-end en la Task 12.

```bash
git add src/lib/components/Lightbox.svelte src/routes/app/photo src/routes/api/favorite
git commit -m "feat: visor lightbox con navegación, descarga y favoritos"
```

---

### Task 9: Subida firmada de fotos

**Files:**
- Create: `src/routes/api/upload-signature/+server.ts`
- Create: `src/routes/api/refresh-index/+server.ts`
- Create: `src/lib/components/UploadModal.svelte`
- Modify: `src/routes/app/+layout.svelte` (cablear botón Upload y modal)

**Interfaces:**
- Consumes: `createUploadSignature` (Task 4); `cloudinaryConfig`, `getFamilyIndex`, `invalidateFamilyIndex`, `UPLOAD_FOLDER` (Task 5); `TopBar.onUpload` (Task 7).
- Produces:
  - `POST /api/upload-signature` con JSON `{ folder?: string }` → JSON `UploadSignature` (`{ cloudName, apiKey, timestamp, folder, signature }`). Solo firma carpetas permitidas: `family_uploads` o una carpeta ya existente en el índice; cualquier otra cosa cae a `family_uploads`.
  - `POST /api/refresh-index` → 204; invalida la caché del servidor (el navegador sube directo a Cloudinary, así que el servidor no se entera solo).
  - Componente `UploadModal` con props `{ folder: string; onClose: (uploadedCount: number) => void }`.

- [ ] **Step 1: Endpoints**

`src/routes/api/upload-signature/+server.ts`:

```ts
import { json } from '@sveltejs/kit';
import { createUploadSignature } from '$lib/server/cloudinary';
import { cloudinaryConfig, getFamilyIndex, UPLOAD_FOLDER } from '$lib/server/photos';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json().catch(() => null)) as { folder?: unknown } | null;
	const requested = typeof body?.folder === 'string' ? body.folder : '';

	const index = await getFamilyIndex();
	const allowed = new Set([UPLOAD_FOLDER, ...index.photos.map((p) => p.folder).filter(Boolean)]);
	const folder = allowed.has(requested) ? requested : UPLOAD_FOLDER;

	return json(createUploadSignature(cloudinaryConfig(), folder));
};
```

`src/routes/api/refresh-index/+server.ts`:

```ts
import { invalidateFamilyIndex } from '$lib/server/photos';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = () => {
	invalidateFamilyIndex();
	return new Response(null, { status: 204 });
};
```

- [ ] **Step 2: Componente UploadModal**

`src/lib/components/UploadModal.svelte` (XHR en vez de fetch por el evento de progreso; reintento individual por archivo fallido):

```svelte
<script lang="ts">
	interface UploadItem {
		file: File;
		status: 'pending' | 'uploading' | 'done' | 'error';
		progress: number;
	}

	let { folder, onClose }: { folder: string; onClose: (uploadedCount: number) => void } = $props();

	let items = $state<UploadItem[]>([]);
	let busy = $state(false);

	const doneCount = $derived(items.filter((i) => i.status === 'done').length);

	function addFiles(files: FileList | null) {
		if (!files) return;
		for (const file of files) {
			if (file.type.startsWith('image/')) items.push({ file, status: 'pending', progress: 0 });
		}
	}

	async function uploadOne(item: UploadItem) {
		item.status = 'uploading';
		item.progress = 0;
		try {
			const sigRes = await fetch('/api/upload-signature', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ folder })
			});
			if (!sigRes.ok) throw new Error('signature failed');
			const sig = (await sigRes.json()) as {
				cloudName: string;
				apiKey: string;
				timestamp: number;
				folder: string;
				signature: string;
			};

			const form = new FormData();
			form.append('file', item.file);
			form.append('api_key', sig.apiKey);
			form.append('timestamp', String(sig.timestamp));
			form.append('signature', sig.signature);
			form.append('folder', sig.folder);

			await new Promise<void>((resolve, reject) => {
				const xhr = new XMLHttpRequest();
				xhr.open('POST', `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`);
				xhr.upload.onprogress = (e) => {
					if (e.lengthComputable) item.progress = Math.round((e.loaded / e.total) * 100);
				};
				xhr.onload = () =>
					xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`HTTP ${xhr.status}`));
				xhr.onerror = () => reject(new Error('network error'));
				xhr.send(form);
			});
			item.status = 'done';
		} catch {
			item.status = 'error';
		}
	}

	async function uploadAll() {
		busy = true;
		for (const item of items) {
			if (item.status === 'pending' || item.status === 'error') await uploadOne(item);
		}
		busy = false;
	}

	async function close() {
		if (doneCount > 0) await fetch('/api/refresh-index', { method: 'POST' });
		onClose(doneCount);
	}
</script>

<div class="backdrop" role="dialog" aria-modal="true" aria-label="Upload photos">
	<div class="modal">
		<h2>Upload photos</h2>
		<p class="hint">Destination: <strong>{folder || 'family_uploads'}</strong></p>

		<label
			class="dropzone"
			ondragover={(e) => e.preventDefault()}
			ondrop={(e) => {
				e.preventDefault();
				addFiles(e.dataTransfer?.files ?? null);
			}}
		>
			Drag photos here or click to choose
			<input
				type="file"
				accept="image/*"
				multiple
				onchange={(e) => addFiles(e.currentTarget.files)}
			/>
		</label>

		{#if items.length > 0}
			<ul>
				{#each items as item (item.file.name + item.file.size)}
					<li>
						<span class="name">{item.file.name}</span>
						{#if item.status === 'uploading'}
							<progress max="100" value={item.progress}></progress>
						{:else if item.status === 'done'}
							<span class="ok">Done</span>
						{:else if item.status === 'error'}
							<span class="ko">Failed</span>
							<button onclick={() => uploadOne(item)}>Retry</button>
						{:else}
							<span class="dim">Waiting</span>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}

		<footer>
			<button class="primary" onclick={uploadAll} disabled={busy || items.length === 0}>
				{busy ? 'Uploading…' : 'Upload all'}
			</button>
			<button onclick={close} disabled={busy}>Close</button>
		</footer>
	</div>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 200;
		background: rgb(0 0 0 / 0.5);
		display: grid;
		place-items: center;
	}
	.modal {
		background: var(--bg);
		border-radius: var(--radius);
		padding: 1.5rem;
		width: min(92vw, 480px);
		max-height: 85vh;
		overflow: auto;
		display: grid;
		gap: 1rem;
	}
	h2 {
		margin: 0;
	}
	.hint {
		margin: 0;
		color: var(--text-dim);
	}
	.dropzone {
		border: 2px dashed var(--text-dim);
		border-radius: var(--radius);
		padding: 2rem;
		text-align: center;
		color: var(--text-dim);
		cursor: pointer;
	}
	.dropzone input {
		display: none;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.5rem;
	}
	li {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.name {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.ok {
		color: #188038;
	}
	.ko {
		color: var(--danger);
	}
	.dim {
		color: var(--text-dim);
	}
	footer {
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
	}
	footer button {
		padding: 0.6rem 1.2rem;
		border-radius: var(--radius);
		border: 1px solid var(--surface);
		background: var(--bg);
	}
	footer .primary {
		background: var(--accent);
		border-color: var(--accent);
		color: white;
	}
</style>
```

- [ ] **Step 3: Cablear el modal en el layout de /app**

Modificar `src/routes/app/+layout.svelte` — añadir a su `<script>`:

```ts
	import { invalidate } from '$app/navigation';
	import UploadModal from '$lib/components/UploadModal.svelte';

	let showUpload = $state(false);

	async function onUploadClosed(uploadedCount: number) {
		showUpload = false;
		if (uploadedCount > 0) await invalidate('app:photos');
	}
```

Y en el markup: pasar `onUpload={() => (showUpload = true)}` al `<TopBar …>` existente, y añadir tras el `<PhotoGrid …>`:

```svelte
{#if showUpload}
	<UploadModal folder={filters.folder} onClose={onUploadClosed} />
{/if}
```

- [ ] **Step 4: Verificar y commitear**

```bash
npm run check
npm run test:unit
```
Expected: sin errores. Flujo cubierto end-to-end en Task 12.

```bash
git add src/routes/api/upload-signature src/routes/api/refresh-index src/lib/components/UploadModal.svelte src/routes/app/+layout.svelte
git commit -m "feat: subida firmada con progreso, reintentos y refresco del índice"
```

---

### Task 10: Demo pública con favoritos locales

**Files:**
- Create: `src/lib/demoFavorites.ts`
- Create: `src/routes/demo/+page.server.ts`
- Create: `src/routes/demo/+page.svelte`
- Test: `src/lib/demoFavorites.test.ts`

**Interfaces:**
- Consumes: `getDemoIndex` (Task 5); `PhotoGrid`, `Lightbox` (Tasks 7-8); `filterPhotos` (Task 7).
- Produces:
  - `getDemoFavorites(storage?: Pick<Storage, 'getItem' | 'setItem'>): Set<string>`
  - `toggleDemoFavorite(publicId: string, storage?: Pick<Storage, 'getItem' | 'setItem'>): Set<string>` — persiste en la clave `demo_favorites` y devuelve el set actualizado
  - Ruta pública `/demo`: la galería real con las fotos de la carpeta `demo`, sin login, sin subida; favoritos solo en el navegador del visitante (nunca tocan los tags de Cloudinary).

- [ ] **Step 1: Escribir el test que falla**

`src/lib/demoFavorites.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getDemoFavorites, toggleDemoFavorite } from './demoFavorites';

function fakeStorage(initial: Record<string, string> = {}) {
	const data = new Map(Object.entries(initial));
	return {
		getItem: (k: string) => data.get(k) ?? null,
		setItem: (k: string, v: string) => void data.set(k, v)
	};
}

describe('demo favorites', () => {
	it('starts empty', () => {
		expect(getDemoFavorites(fakeStorage()).size).toBe(0);
	});

	it('toggles a favorite on and off, persisting to storage', () => {
		const storage = fakeStorage();
		expect(toggleDemoFavorite('demo/cat', storage).has('demo/cat')).toBe(true);
		expect(getDemoFavorites(storage).has('demo/cat')).toBe(true);
		expect(toggleDemoFavorite('demo/cat', storage).has('demo/cat')).toBe(false);
	});

	it('survives corrupted storage content', () => {
		const storage = fakeStorage({ demo_favorites: 'not json{{' });
		expect(getDemoFavorites(storage).size).toBe(0);
	});
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

```bash
npx vitest run src/lib/demoFavorites.test.ts
```
Expected: FAIL — no existe `./demoFavorites`.

- [ ] **Step 3: Implementar módulo y páginas**

`src/lib/demoFavorites.ts`:

```ts
const KEY = 'demo_favorites';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export function getDemoFavorites(storage: StorageLike = localStorage): Set<string> {
	try {
		const parsed: unknown = JSON.parse(storage.getItem(KEY) ?? '[]');
		return new Set(Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : []);
	} catch {
		return new Set();
	}
}

export function toggleDemoFavorite(
	publicId: string,
	storage: StorageLike = localStorage
): Set<string> {
	const favorites = getDemoFavorites(storage);
	if (favorites.has(publicId)) favorites.delete(publicId);
	else favorites.add(publicId);
	storage.setItem(KEY, JSON.stringify([...favorites]));
	return favorites;
}
```

`src/routes/demo/+page.server.ts`:

```ts
import { env } from '$env/dynamic/private';
import { getDemoIndex } from '$lib/server/photos';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const index = await getDemoIndex();
	return { ...index, cloudName: env.CLOUDINARY_CLOUD_NAME ?? '' };
};
```

`src/routes/demo/+page.svelte` (el estado del visor es local — no hay ruta por foto en la demo; los favoritos locales se inyectan sobre los `Photo` antes de filtrar, así `filterPhotos` y `PhotoGrid` funcionan sin cambios):

```svelte
<script lang="ts">
	import { browser } from '$app/environment';
	import Lightbox from '$lib/components/Lightbox.svelte';
	import PhotoGrid from '$lib/components/PhotoGrid.svelte';
	import { getDemoFavorites, toggleDemoFavorite } from '$lib/demoFavorites';
	import { filterPhotos } from '$lib/filterPhotos';

	let { data } = $props();

	let favorites = $state(browser ? getDemoFavorites() : new Set<string>());
	let query = $state('');
	let favoritesOnly = $state(false);
	let openId = $state<string | null>(null);

	const decorated = $derived(
		data.photos.map((p) => ({ ...p, favorite: favorites.has(p.publicId) }))
	);
	const filtered = $derived(filterPhotos(decorated, { folder: '', query, favoritesOnly }));
	const index = $derived(filtered.findIndex((p) => p.publicId === openId));
	const openPhoto = $derived(index >= 0 ? filtered[index] : undefined);
</script>

<svelte:head><title>Demo · Fokkelman Photo Vault</title></svelte:head>

<div class="banner">
	<strong>Demo mode.</strong> These are public sample photos — favorites are stored only in your
	browser. <a href="/">About this project</a>
</div>

<header>
	<input type="search" placeholder="Search by file name…" aria-label="Search photos" bind:value={query} />
	<button class="chip" aria-pressed={favoritesOnly} onclick={() => (favoritesOnly = !favoritesOnly)}>
		★ Favorites
	</button>
	<span class="count">{filtered.length} photos</span>
</header>

<PhotoGrid photos={filtered} cloudName={data.cloudName} onOpen={(publicId) => (openId = publicId)} />

{#if openPhoto}
	<Lightbox
		photo={openPhoto}
		cloudName={data.cloudName}
		favorite={openPhoto.favorite}
		onClose={() => (openId = null)}
		onPrev={index > 0 ? () => (openId = filtered[index - 1].publicId) : undefined}
		onNext={index < filtered.length - 1 ? () => (openId = filtered[index + 1].publicId) : undefined}
		onToggleFavorite={() => (favorites = toggleDemoFavorite(openPhoto.publicId))}
	/>
{/if}

<style>
	.banner {
		padding: 0.6rem 1rem;
		background: #fef7e0;
		color: #5f4b00;
		font-size: 0.95rem;
	}
	.banner a {
		color: inherit;
	}
	header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.6rem 1rem;
		border-bottom: 1px solid var(--surface);
	}
	input {
		flex: 1;
		min-width: 160px;
		font: inherit;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--surface);
		border-radius: var(--radius);
		background: var(--surface);
	}
	.chip {
		padding: 0.5rem 0.9rem;
		border: 1px solid var(--surface);
		border-radius: 999px;
		background: var(--bg);
	}
	.chip[aria-pressed='true'] {
		background: var(--accent);
		color: white;
		border-color: var(--accent);
	}
	.count {
		color: var(--text-dim);
		font-size: 0.9rem;
	}
</style>
```

- [ ] **Step 4: Verificar que pasa y commitear**

```bash
npx vitest run src/lib/demoFavorites.test.ts
npm run check
```
Expected: PASS (3 tests), check sin errores.

```bash
git add src/lib/demoFavorites.ts src/lib/demoFavorites.test.ts src/routes/demo
git commit -m "feat: demo pública con fotos de muestra y favoritos en localStorage"
```

---

### Task 11: Landing pública

**Files:**
- Create: `src/routes/+page.svelte` (sustituye a la generada por sv create)

**Interfaces:**
- Consumes: nada (página estática).
- Produces: landing en `/` con los tres CTAs: `Try the demo` → `/demo`, `GitHub` → `https://github.com/rjrbio/fokkelman`, `Family sign in` → `/login`.

Es el escaparate profesional del autor (desarrollador junior en búsqueda de empleo): debe explicar qué es el proyecto y cómo está construido, con más personalidad visual que la app.

- [ ] **Step 1: Implementar la landing**

`src/routes/+page.svelte` (reemplazar el contenido generado por sv create):

```svelte
<svelte:head>
	<title>Fokkelman Photo Vault — a private family photo archive</title>
	<meta
		name="description"
		content="A private family photo vault built with SvelteKit, TypeScript and Cloudinary. Try the interactive demo."
	/>
</svelte:head>

<main>
	<section class="hero">
		<p class="kicker">A personal project by rjrbio</p>
		<h1>Fokkelman Photo Vault</h1>
		<p class="lede">
			A private photo archive for my family: 3,600+ digitized photographs, searchable and
			organized, behind a secure login. The family photos are private — but you can try the real
			app with public sample photos.
		</p>
		<nav class="cta">
			<a class="primary" href="/demo">Try the demo</a>
			<a class="secondary" href="https://github.com/rjrbio/fokkelman">GitHub</a>
			<a class="tertiary" href="/login">Family sign in</a>
		</nav>
	</section>

	<section class="details">
		<article>
			<h2>What it does</h2>
			<ul>
				<li>Infinite-scroll gallery over 3,600+ photos, served through Cloudinary's CDN</li>
				<li>Full-screen viewer with keyboard, swipe, favorites and original download</li>
				<li>Signed direct-to-Cloudinary uploads with per-file progress</li>
				<li>Search and collection filters, shareable via URL</li>
			</ul>
		</article>
		<article>
			<h2>How it's built</h2>
			<ul>
				<li><strong>SvelteKit + TypeScript</strong> with server routes on Netlify</li>
				<li><strong>Cloudinary as the single source of truth</strong>: folders, tags and its Search API — no separate database</li>
				<li>Server-side session auth: scrypt-hashed password, HMAC-signed HttpOnly cookie</li>
				<li>Photo index cached server-side (5 min TTL) with stale-on-error fallback</li>
				<li>Tested with Vitest (unit) and Playwright (end-to-end against a Cloudinary mock)</li>
			</ul>
		</article>
		<article>
			<h2>Why it's interesting</h2>
			<p>
				This is a full rewrite of my first project (static HTML + vanilla JS with client-side
				auth). The redesign moves every secret server-side, replaces Firebase with Cloudinary's
				own metadata, and turns a hand-generated JSON index into a live, cached one.
			</p>
		</article>
	</section>
</main>

<style>
	main {
		max-width: 960px;
		margin: 0 auto;
		padding: 4rem 1.5rem;
	}
	.hero {
		text-align: center;
		margin-bottom: 4rem;
	}
	.kicker {
		text-transform: uppercase;
		letter-spacing: 0.12em;
		font-size: 0.8rem;
		color: var(--text-dim);
	}
	h1 {
		font-size: clamp(2.2rem, 6vw, 3.5rem);
		margin: 0.5rem 0 1rem;
	}
	.lede {
		max-width: 620px;
		margin: 0 auto 2rem;
		color: var(--text-dim);
		font-size: 1.15rem;
		line-height: 1.6;
	}
	.cta {
		display: flex;
		gap: 0.75rem;
		justify-content: center;
		flex-wrap: wrap;
	}
	.cta a {
		padding: 0.8rem 1.6rem;
		border-radius: 999px;
		text-decoration: none;
		font-weight: 600;
	}
	.primary {
		background: var(--accent);
		color: white;
	}
	.secondary {
		border: 1px solid var(--text-dim);
		color: var(--text);
	}
	.tertiary {
		color: var(--text-dim);
	}
	.details {
		display: grid;
		gap: 2rem;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
	}
	article h2 {
		font-size: 1.1rem;
	}
	article ul {
		padding-left: 1.2rem;
		color: var(--text-dim);
		line-height: 1.7;
	}
	article p {
		color: var(--text-dim);
		line-height: 1.7;
	}
</style>
```

Nota: en `kicker` se usa el handle de GitHub (`rjrbio`) porque es el único nombre verificable en el repo; si el usuario prefiere su nombre real, lo indicará en revisión. No inventar datos personales.

- [ ] **Step 2: Verificar y commitear**

```bash
npm run check
```
Expected: sin errores.

```bash
git add src/routes/+page.svelte
git commit -m "feat: landing pública con presentación del proyecto y acceso a la demo"
```

---

### Task 12: Suite end-to-end con mock de Cloudinary

**Files:**
- Create: `tests/e2e/mock-cloudinary.mjs`
- Create: `tests/e2e/helpers.ts`
- Create: `tests/e2e/login.spec.ts`
- Create: `tests/e2e/gallery.spec.ts`
- Create: `tests/e2e/favorite.spec.ts`
- Create: `tests/e2e/upload.spec.ts`
- Create: `playwright.config.ts`

**Interfaces:**
- Consumes: `hashPassword` de `./src/lib/server/session` (import relativo — el config de Playwright no resuelve `$lib`); toda la app (Tasks 6-9); `CLOUDINARY_API_BASE` (Task 5) para apuntar el servidor al mock.
- Produces: `npm run test:e2e` verde con los 4 flujos del spec. Contraseña de test: `test-password` (solo existe aquí).

Cómo se mockea: las llamadas **del servidor** (search, tags) van al mock HTTP local vía `CLOUDINARY_API_BASE`; las peticiones **del navegador** (imágenes del CDN y subida) se interceptan con `page.route`.

- [ ] **Step 1: Servidor mock de Cloudinary**

`tests/e2e/mock-cloudinary.mjs`:

```js
import { createServer } from 'node:http';

const PORT = 9966;

// 80 fotos familiares (para probar el scroll infinito: primer lote = 60) + 3 de demo
const state = {
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
```

- [ ] **Step 2: Configuración de Playwright y helpers**

`playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';
import { hashPassword } from './src/lib/server/session';

const appEnv = {
	CLOUDINARY_CLOUD_NAME: 'testcloud',
	CLOUDINARY_API_KEY: 'test-key',
	CLOUDINARY_API_SECRET: 'test-secret',
	CLOUDINARY_API_BASE: 'http://127.0.0.1:9966',
	SESSION_SECRET: 'e2e-session-secret',
	FAMILY_PASSWORD_HASH: hashPassword('test-password')
};

export default defineConfig({
	testDir: 'tests/e2e',
	use: { baseURL: 'http://localhost:5199' },
	webServer: [
		{
			command: 'node tests/e2e/mock-cloudinary.mjs',
			port: 9966,
			reuseExistingServer: !process.env.CI
		},
		{
			command: 'npm run dev -- --port 5199',
			port: 5199,
			env: appEnv,
			reuseExistingServer: false
		}
	]
});
```

`tests/e2e/helpers.ts` (PNG 1×1 para toda imagen del CDN — sin red externa en los tests):

```ts
import type { Page } from '@playwright/test';

const TINY_PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
	'base64'
);

export async function stubCdnImages(page: Page): Promise<void> {
	await page.route('https://res.cloudinary.com/**', (route) =>
		route.fulfill({ contentType: 'image/png', body: TINY_PNG })
	);
}

export async function login(page: Page): Promise<void> {
	await page.goto('/login');
	await page.getByPlaceholder('Family password').fill('test-password');
	await page.getByRole('button', { name: 'Sign in' }).click();
	await page.waitForURL('**/app');
}
```

- [ ] **Step 3: Los 4 specs**

`tests/e2e/login.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { login, stubCdnImages } from './helpers';

test.beforeEach(async ({ page }) => stubCdnImages(page));

test('rejects a wrong password with a generic error', async ({ page }) => {
	await page.goto('/login');
	await page.getByPlaceholder('Family password').fill('nope');
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByRole('alert')).toHaveText('Incorrect password.');
	expect(page.url()).toContain('/login');
});

test('signs in with the family password and lands on the gallery', async ({ page }) => {
	await login(page);
	await expect(page.getByText('80 photos')).toBeVisible();
});

test('redirects an anonymous visitor from /app to /login', async ({ page }) => {
	await page.goto('/app');
	await page.waitForURL('**/login?next=%2Fapp');
});
```

`tests/e2e/gallery.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { login, stubCdnImages } from './helpers';

test('loads the first batch and grows on scroll', async ({ page }) => {
	await stubCdnImages(page);
	await login(page);

	const cells = page.getByTestId('photo-grid').getByRole('button');
	await expect(cells).toHaveCount(60);

	await page.getByTestId('grid-sentinel').scrollIntoViewIfNeeded();
	await expect(cells).toHaveCount(80);
});
```

`tests/e2e/favorite.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { login, stubCdnImages } from './helpers';

test('marks a photo as favorite and finds it with the filter', async ({ page }) => {
	await stubCdnImages(page);
	await login(page);

	await page.getByRole('button', { name: 'Open Sample_001' }).click();
	const favButton = page.getByRole('button', { name: 'Add to favorites' });
	await favButton.click();
	await expect(page.getByRole('button', { name: 'Remove from favorites' })).toBeVisible();

	await page.getByRole('button', { name: 'Close viewer' }).click();
	await page.getByRole('button', { name: '★ Favorites' }).click();
	await expect(page.getByText('1 photos')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Open Sample_001' })).toBeVisible();
});
```

`tests/e2e/upload.spec.ts` (la subida del navegador se intercepta con `page.route`; se comprueba que el modal informa del éxito y que al cerrar se refresca el índice):

```ts
import { expect, test } from '@playwright/test';
import { login, stubCdnImages } from './helpers';

test('uploads a photo with a server-issued signature', async ({ page }) => {
	await stubCdnImages(page);
	await page.route('https://api.cloudinary.com/v1_1/testcloud/image/upload', (route) =>
		route.fulfill({
			contentType: 'application/json',
			body: JSON.stringify({ public_id: 'family_uploads/e2e_new', format: 'jpg' })
		})
	);
	await login(page);

	await page.getByRole('button', { name: 'Upload' }).click();
	await page.setInputFiles('input[type=file]', {
		name: 'holiday.jpg',
		mimeType: 'image/jpeg',
		buffer: Buffer.from('fake-image-bytes')
	});
	await page.getByRole('button', { name: 'Upload all' }).click();
	await expect(page.getByText('Done')).toBeVisible();

	const refresh = page.waitForRequest('**/api/refresh-index');
	await page.getByRole('button', { name: 'Close', exact: true }).click();
	await refresh;
});
```

- [ ] **Step 4: Ejecutar la suite**

```bash
npx playwright install chromium
npm run test:e2e
```
Expected: 6 tests PASS en los 4 archivos. Si un selector no casa, ajustar el **selector del test** solo tras confirmar en la UI real cuál es el accesible-name correcto (no debilitar los asserts).

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts tests/e2e
git commit -m "test: suite e2e de login, galería, favoritos y subida contra mock de Cloudinary"
```

---

### Task 13: Documentación, deploy y checklist de cutover

**Files:**
- Create: `DEPLOYMENT.md`
- Modify: `README.md` (reescritura completa)

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: documentación para operar la app y ejecutar el cutover. Los pasos marcados **[MANUAL]** los hace el usuario (requieren cuentas/consolas); el agente solo los documenta.

- [ ] **Step 1: Escribir DEPLOYMENT.md**

`DEPLOYMENT.md`:

```markdown
# Deploy y cutover

## Variables de entorno (Netlify → Site settings → Environment variables)

| Variable | Valor |
|---|---|
| `CLOUDINARY_CLOUD_NAME` | `dmreytypx` |
| `CLOUDINARY_API_KEY` | Dashboard de Cloudinary → Settings → API Keys |
| `CLOUDINARY_API_SECRET` | Ídem (**rotarlo antes**, ver checklist) |
| `FAMILY_PASSWORD_HASH` | `node scripts/hash-password.mjs <nueva-contraseña>` |
| `SESSION_SECRET` | `openssl rand -hex 32` |

`CLOUDINARY_API_BASE` NO se define en producción (usa el default).

## Preparación (antes del cutover) — [MANUAL]

1. Rotar el API secret en Cloudinary (Settings → API Keys → Regenerate):
   hubo credenciales en el historial de git (commit bbc65b5).
2. Elegir una contraseña familiar NUEVA (la anterior viajaba al navegador:
   se considera comprometida) y generar su hash.
3. Subir 30-50 fotos de dominio público a la carpeta `demo` del cloud
   (Cloudinary → Media Library → carpeta `demo`). Sugerencia: fotos
   históricas de Wikimedia Commons / Library of Congress (public domain).
4. Configurar las variables de entorno de arriba en Netlify.
5. En Netlify: activar branch deploys para `rewrite/photo-vault` y probar
   la app completa en la URL del branch deploy (login real, galería con
   las 3.659 fotos, favoritos, subida, demo).

## Cutover

1. Merge de `rewrite/photo-vault` a `main` → Netlify publica la app nueva
   en la URL de siempre.
2. Verificar en producción: `/` (landing), `/demo`, login y galería.

## Desmantelamiento (después del cutover) — [MANUAL]

- [ ] Eliminar el *unsigned upload preset* en Cloudinary
      (Settings → Upload → Upload presets).
- [ ] Verificar que el API secret rotado es el único válido.
- [ ] Borrar el proyecto de Firebase (console.firebase.google.com →
      Project settings → Delete project). Sus datos se descartan por
      decisión de diseño.
- [ ] Hacer público el repo de GitHub (Settings → Danger Zone) — no
      contiene secretos; todo va por variables de entorno.
- [ ] Comunicar la nueva contraseña a la familia.
```

- [ ] **Step 2: Reescribir README.md**

`README.md` (reemplazar todo el contenido):

```markdown
# Fokkelman Photo Vault

Almacén de fotos privado para la familia Fokkelman: más de 3.600 fotografías
digitalizadas, con búsqueda, favoritos, descarga y subida — detrás de un login
seguro. Incluye una [demo pública](https://github.com/rjrbio/fokkelman) con
fotos de muestra para que cualquiera pueda probar la app real.

**Stack**: SvelteKit + TypeScript · Cloudinary (imágenes, metadatos y búsqueda,
sin base de datos aparte) · Netlify (hosting y funciones de servidor).

## Desarrollo

```bash
npm install
cp .env.example .env   # rellenar credenciales (ver DEPLOYMENT.md)
npm run dev
```

## Tests

```bash
npm run test:unit   # Vitest
npm run test:e2e    # Playwright (levanta un mock de Cloudinary, no usa red)
```

## Arquitectura en corto

- El navegador nunca ve el API secret: búsqueda, favoritos (tag `favorite`)
  y firmas de subida pasan por endpoints de servidor de SvelteKit.
- El índice de fotos se consulta a la Search API de Cloudinary y se cachea
  5 minutos, con fallback a la copia caducada si la API falla.
- Login: contraseña familiar hasheada con scrypt en una variable de entorno;
  sesión en cookie HttpOnly firmada con HMAC (30 días).
- Zona pública: landing (`/`) y demo interactiva (`/demo`, carpeta `demo`
  de Cloudinary, favoritos solo en localStorage del visitante).

Ver `DEPLOYMENT.md` para deploy y operaciones.
```

Nota: el enlace "demo pública" del README debe apuntar a la URL real de Netlify una vez conocida (en el cutover); hasta entonces apunta al repo.

- [ ] **Step 3: Verificación final completa y commit**

```bash
npm run check
npm run test:unit
npm run test:e2e
npm run build
```
Expected: todo verde.

```bash
git add DEPLOYMENT.md README.md
git commit -m "docs: README y guía de deploy/cutover de la nueva app"
```

- [ ] **Step 4: Entrega**

La rama `rewrite/photo-vault` queda lista. NO hacer merge a `main`: el cutover lo decide el usuario tras probar el branch deploy (pasos [MANUAL] de DEPLOYMENT.md).

---

## Verificación global del plan

Cobertura del spec → tareas: concepto Google Photos (7, 8, 9) · login seguro (3, 6) · Cloudinary única fuente de verdad (4, 5) · índice vivo con caché y stale (5) · favoritos compartidos por tag (4, 8) · subida firmada + preset unsigned eliminado (9, 13) · landing + demo para reclutadores (10, 11) · errores (5, 7-error page, 9-retry) · testing unit + e2e (2-5, 7, 10, 12) · transición sin corte y desmantelamiento (1, 13).





