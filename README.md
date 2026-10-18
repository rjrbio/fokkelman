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

Si `/login` muestra *"Sign-in is unavailable: the server is not configured
yet."*, busca en el log de las funciones de Netlify la línea
`[auth] sign-in disabled: <código>`:

- `missing-session-secret`: falta `SESSION_SECRET` (o está vacía).
- `weak-session-secret`: `SESSION_SECRET` tiene menos de 32 caracteres.
- `missing-password-hash`: falta `FAMILY_PASSWORD_HASH` (o está vacía).
- `malformed-password-hash`: `FAMILY_PASSWORD_HASH` no tiene el formato
  `salt:key` en hexadecimal (32 y 64 caracteres hex separados por `:`).

Un hash bien formado pero generado a partir de *otra* cadena (por ejemplo, si
el shell se comió un `!` o un `$` de la contraseña) no desactiva el login: se
ve como una contraseña mal escrita (*"Incorrect password."*). Se puede
comprobar en local con
`node scripts/hash-password.mjs --check '<contraseña>' '<hash>'`
(con comillas simples, para que el shell no toque la contraseña).

## Tests

```bash
npm run test:unit   # Vitest
npm run test:e2e    # Playwright (levanta un mock de Cloudinary, no usa red)
```

## Arquitectura en corto

- El navegador nunca ve el API secret: búsqueda, favoritos (tag `favorite`)
  y firmas de subida pasan por endpoints de servidor de SvelteKit.
- El índice de fotos se consulta a la Search API de Cloudinary y se cachea
  5 minutos en memoria; si la API falla, se sirve la copia caducada. Marcar
  una favorita parchea la copia en caché en lugar de volver a consultar el
  índice, y solo se aceptan fotos que estén en el índice familiar.
- Login: contraseña familiar hasheada con scrypt en una variable de entorno,
  límite de intentos por IP de cliente y sesión en cookie HttpOnly firmada con
  HMAC (30 días). El límite de intentos vive en memoria, por instancia
  serverless: por sí solo únicamente frena los intentos de adivinación poco
  sofisticados.
- Zona pública: landing (`/`) y demo interactiva (`/demo`, carpeta `demo`
  de Cloudinary, favoritos solo en localStorage del visitante).
