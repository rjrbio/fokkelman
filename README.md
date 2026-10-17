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

Si falta alguna o tiene un formato inválido, el login se desactiva y ninguna
sesión es válida (fallo cerrado). En Netlify se definen en *Site settings →
Environment variables* y **hay que redesplegar** tras cambiarlas.

## Tests

```bash
npm run test:unit   # Vitest
npm run test:e2e    # Playwright (levanta un mock de Cloudinary, no usa red)
```

## Arquitectura en corto

- El navegador nunca ve el API secret: búsqueda, favoritos (tag `favorite`)
  y firmas de subida pasan por endpoints de servidor de SvelteKit.
- El índice de fotos se consulta a la Search API de Cloudinary y se cachea
  5 minutos; las escrituras (favoritos) parchean la caché en vez de recargarla,
  y si la API falla se sirve la copia caducada.
- Login: contraseña familiar hasheada con scrypt en una variable de entorno,
  límite de intentos por IP y sesión en cookie HttpOnly firmada con HMAC (30 días).
- Zona pública: landing (`/`) y demo interactiva (`/demo`, carpeta `demo`
  de Cloudinary, favoritos solo en localStorage del visitante).
