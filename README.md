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
