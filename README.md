# Fokkelman Photo Vault

Almacén de fotos privado para la familia Fokkelman: más de 3.600 fotografías
digitalizadas, con búsqueda, favoritos, descarga y subida, detrás de un login
seguro. Incluye una [demo pública](https://fokkelman.netlify.app/demo) con
fotos de muestra para que cualquiera pueda probar la app real.

**Stack**: SvelteKit + TypeScript · Cloudinary (imágenes, metadatos y búsqueda,
sin base de datos aparte) · Netlify (hosting y funciones de servidor).

## Desarrollo

```bash
npm install
cp .env.example .env   # rellenar las variables (tabla de abajo)
npm run dev
```

## Variables de entorno

| Variable | Para qué |
|---|---|
| `CLOUDINARY_CLOUD_NAME` | Nombre del cloud (no es secreto, va en las URLs de las imágenes) |
| `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Credenciales del API de Cloudinary (solo servidor) |
| `FAMILY_PASSWORD_HASH` | Hash scrypt de la contraseña familiar: `node scripts/hash-password.mjs <contraseña>` |
| `SESSION_SECRET` | Secreto aleatorio de al menos 32 caracteres para firmar sesiones: `openssl rand -hex 32` |

El login depende de dos variables: `FAMILY_PASSWORD_HASH` (si falta o no tiene
el formato `salt:key` en hexadecimal) y `SESSION_SECRET` (si falta o tiene menos
de 32 caracteres). Si cualquiera de las dos falla, el login se desactiva y
ninguna sesión es válida (fallo cerrado). Las variables `CLOUDINARY_*` no
intervienen en el login. En Netlify se definen en *Site settings →
Environment variables* y **hay que redesplegar** tras cambiarlas.

### Si el login no funciona

Si `/login` muestra *"No se puede entrar ahora: el servidor aún no está
configurado."*, busca en el log de las funciones de Netlify la línea
`[auth] sign-in disabled: <código>`:

- `missing-session-secret`: falta `SESSION_SECRET` (o está vacía).
- `weak-session-secret`: `SESSION_SECRET` tiene menos de 32 caracteres.
- `missing-password-hash`: falta `FAMILY_PASSWORD_HASH` (o está vacía).
- `malformed-password-hash`: `FAMILY_PASSWORD_HASH` no tiene el formato
  `salt:key` en hexadecimal (32 y 64 caracteres hex separados por `:`).

Un hash bien formado pero generado a partir de *otra* cadena (por ejemplo, si
el shell se comió un `!` o un `$` de la contraseña) no desactiva el login: se
ve como una contraseña mal escrita (*"Contraseña incorrecta."*). Se puede
comprobar en local con
`node scripts/hash-password.mjs --check '<contraseña>' '<hash>'`
(con comillas simples, para que el shell no toque la contraseña).

## Tests

```bash
npm run test:unit   # Vitest
npm run test:e2e    # Playwright (levanta un mock de Cloudinary, no usa red)
```

Playwright corre dos proyectos: `desktop` (Chromium de escritorio) y `mobile`
(un Chromium con pantalla táctil de 412×839, solo `tests/e2e/mobile.spec.ts`).
`tests/e2e/a11y.spec.ts` y el final de `mobile.spec.ts` pasan
[axe-core](https://github.com/dequelabs/axe-core) (el motor de la puntuación de
accesibilidad de Lighthouse) por el login, la galería, el visor, la subida, la
demo y la landing, y fallan ante cualquier fallo WCAG 2.1 A/AA. Los contrastes
de la paleta los fija `src/lib/tokens.test.ts`.

## Arquitectura en corto

- El navegador nunca ve el API secret: búsqueda, favoritos (tag `favorite`)
  y firmas de subida pasan por endpoints de servidor de SvelteKit.
- El índice de fotos se consulta a la Search API de Cloudinary y se cachea
  5 minutos en memoria, por instancia serverless (cada instancia tiene su
  propia copia); si la API falla, se sirve la copia caducada. Marcar una
  favorita parchea la copia en caché en lugar de volver a consultar el índice
  (solo la de la instancia que atendió la escritura), y solo se aceptan fotos
  que estén en el índice familiar.
- Login: contraseña familiar hasheada con scrypt en una variable de entorno,
  límite de intentos por IP de cliente y sesión en cookie HttpOnly firmada con
  HMAC (30 días). El límite de intentos vive en memoria, por instancia
  serverless: por sí solo únicamente frena los intentos de adivinación poco
  sofisticados.
- Zona pública: landing (`/`) y demo interactiva (`/demo`, carpeta `demo`
  de Cloudinary, favoritos solo en localStorage del visitante).
- Interfaz: galería oscura con los colores y medidas como variables CSS en
  `src/app.css` y la tipografía Inter autoalojada (`@fontsource-variable/inter`,
  sin Google Fonts). La rejilla son filas justificadas por la proporción real de
  cada foto (`src/lib/justifiedRows.ts`, sin recortar), que se dibujan por lotes
  de filas al hacer scroll. Las miniaturas y las versiones grandes se piden a
  Cloudinary con `c_limit` (nunca se amplía una foto).
- Visor: panel de datos, pantalla completa (botón, tecla `F` o doble toque; en
  iPhone, que no ofrece la pantalla completa del navegador, queda el modo sin
  panel), zoom con rueda, pellizco o teclas `+` `-` `0`, y precarga de las
  fotos vecinas. La versión de 2400 px solo se pide al ampliar o en pantalla
  completa; el original, solo en *Descargar*.
- Datos de cada foto: descripción, año y personas se guardan en el `context`
  de Cloudinary (claves `caption`, `year` y `people`; las personas, separadas
  por comas), sin base de datos aparte. Las reglas (límites, limpieza, mezcla de
  personas) están en `src/lib/annotations.ts`, que comparten navegador y servidor;
  `src/lib/server/context.ts` lee y escribe el formato del `context`, y
  `src/lib/server/annotate.ts` decide qué llamadas hacen falta. `POST /api/annotate`
  acepta `{ publicIds, patch }` (hasta 200 fotos por petición), escribe solo las
  claves que cambian y deja intactas las que no son de la app. Cloudinary no puede
  borrar una sola clave: al vaciar un campo se vacía el `context` de la foto y se
  escribe de nuevo entero (si lo segundo falla, se devuelve el anterior). En el
  navegador el cambio se ve al momento y se deshace con un aviso si falla
  (`src/lib/annotate.svelte.ts`). La galería se ordena por año (sin año al final)
  y el buscador mira descripción, personas, año y nombre de archivo, sin
  distinguir mayúsculas ni acentos.
- Idioma: la zona familiar (`/app`, `/login`) está en español y la landing y la
  demo en inglés. Los textos de la interfaz (familia, error, rejilla, visor,
  demo) están en `src/lib/messages.ts`; la landing tiene su texto en la propia
  página hasta la Fase 4. El hook pone el `lang` de `<html>` según la ruta.
