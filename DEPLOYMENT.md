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
3. Actualizar el enlace "demo pública" del README (hoy apunta al repo de
   GitHub como placeholder) para que apunte a la URL real de `/demo` en
   producción.

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
