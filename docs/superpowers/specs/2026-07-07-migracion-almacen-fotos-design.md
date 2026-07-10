# Migración: Galería Fokkelman → Almacén de fotos familiar

**Fecha**: 2026-07-07
**Estado**: diseño aprobado en sesión de brainstorming, pendiente de plan de implementación
**Implementación prevista**: Claude Sonnet/Opus siguiendo el plan derivado de este spec

## 1. Contexto y objetivo

El proyecto actual es un sitio estático (HTML + JavaScript vanilla) pensado como
"recorrido de recuerdos" para usuarios mayores. Los usuarios reales no quieren ese
concepto: quieren un **almacén de fotos estilo Google Photos** — encontrar, ver,
descargar y subir fotos con fluidez.

Se reescribe la aplicación completa. **Lo único que se conserva es Cloudinary como
almacén de imágenes** (cloud `dmreytypx`, ~3.659 fotos ya subidas) y su CDN de
entrega con transformaciones.

Objetivo secundario: el autor es desarrollador junior en búsqueda activa de empleo.
La web debe tener una **zona pública** que un reclutador pueda ver y tocar sin
acceder a las fotos privadas de la familia.

## 2. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Concepto | Almacén estilo Google Photos (grid, búsqueda, visor, favoritos, descarga, subida) |
| Stack | SvelteKit + TypeScript |
| Hosting | Netlify (adaptador oficial de SvelteKit), mismo sitio/URL actual |
| Login | Contraseña familiar única, verificada en servidor, cookie de sesión firmada |
| Datos | Cloudinary como única fuente de verdad (tags + carpetas); sin base de datos |
| Índice de fotos | Vivo: Search API de Cloudinary desde el servidor, con caché (~5 min) |
| Firebase | Se apaga; sus datos (recorrido y metadatos) se **descartan** |
| `fotos.json` + script Python | Desaparecen |
| Idioma UI | Inglés |
| Zona pública | Landing de presentación + demo interactiva con fotos de muestra |

## 3. Arquitectura

```
Navegador ──▶ SvelteKit en Netlify (SSR + endpoints de servidor)
                 │ caché de índice ~5 min
                 ▼
          Cloudinary Search/Admin API   (requiere API secret: solo servidor)

Imágenes: navegador ──▶ res.cloudinary.com (CDN, transformaciones) — sin cambios

Subida: navegador ──▶ endpoint /api/upload-signature ──▶ firma
        navegador ──▶ api.cloudinary.com (subida firmada directa)
                       └─▶ invalida caché del índice
```

- El cliente **nunca** ve el API secret ni llama a APIs privadas de Cloudinary.
- Miniaturas con `f_auto,q_auto,w_400` (aprox.); descarga del original mediante
  URL de entrega sin transformación (con `fl_attachment` para forzar descarga).
- Caché del índice: en memoria por instancia de función con TTL de ~5 minutos,
  invalidada tras subida o cambio de favorito. Si la Search API falla o se agota
  la cuota, se sirve la copia caducada (stale-while-error).
- Límite relevante: plan gratuito de Cloudinary ≈ 500 llamadas Admin/Search por
  hora. Con caché de 5 min y uso familiar, el consumo esperado es de un orden de
  magnitud por debajo del límite.

## 4. Modelo de datos en Cloudinary

| Dato | Mecanismo en Cloudinary |
|---|---|
| Colecciones navegables | Carpetas / prefijos de `public_id` existentes (`Fokkelman10_…`, etc.) |
| Favoritos (compartidos por la familia) | Tag `favorite` en la foto |
| Fotos de la demo pública | Carpeta `demo/` con ~30–50 imágenes de dominio público |

- El índice familiar **excluye** la carpeta `demo/`.
- No hay favoritos por persona: con contraseña única no existe identidad
  individual. Es una limitación aceptada y documentada.
- Los metadatos contextuales de Cloudinary (descripción, año, lugar) quedan
  disponibles para funciones futuras, pero **no** se usan en esta versión.

## 5. Autenticación

- Contraseña familiar almacenada como **hash** en variable de entorno de Netlify
  (`FAMILY_PASSWORD_HASH`), junto a `SESSION_SECRET` para firmar sesiones.
- `POST /login`: verifica el hash en servidor; si es correcta, emite cookie
  `HttpOnly; Secure; SameSite=Lax` con token firmado (HMAC) y caducidad de 30 días.
- Hook de servidor de SvelteKit: toda ruta privada sin sesión válida redirige a
  `/login` (conservando la ruta de destino).
- Mitigación de fuerza bruta: retardo progresivo tras intentos fallidos
  (best-effort en funciones sin estado; suficiente para el modelo de amenaza).
- Error de login genérico, sin distinguir causas.
- La contraseña **nunca** aparece en código cliente ni en el repositorio.

## 6. Páginas y funcionalidades

### Zona pública (sin login)

- **`/` — Landing**: presentación del proyecto para visitantes/reclutadores:
  qué es, stack (SvelteKit, TypeScript, Cloudinary, Netlify), decisiones de
  arquitectura en breve, enlace al repositorio de GitHub. Botones:
  `Try the demo`, `GitHub`, `Family sign in`.
- **`/demo` — Demo interactiva**: la misma galería real (mismos componentes)
  cargada con las fotos públicas de la carpeta `demo/`. Sin login. Subida
  desactivada. Los favoritos de la demo se guardan solo en `localStorage` del
  visitante — nunca tocan los tags de Cloudinary.
- **`/login`** — formulario de contraseña familiar.

### Zona familiar (protegida)

- **`/app` — Galería**:
  - Cuadrícula de miniaturas con scroll infinito (lotes de ~60) y lazy loading.
  - Barra superior: selector de colección (carpetas), buscador por nombre de
    archivo, filtro `Favorites`, botón `Upload`, `Log out`.
  - Contador de fotos visible.
- **Visor** (`/app/photo/[id]`, ruta superpuesta tipo lightbox, URL compartible
  dentro de la familia):
  - Anterior/siguiente con flechas, teclado y swipe.
  - Acciones: marcar/desmarcar favorito, descargar original, cerrar.
  - Carga progresiva (miniatura ampliada mientras llega la versión grande).
- **Subida** (modal): selección múltiple o arrastrar; firma obtenida del
  servidor; subida directa a Cloudinary. Destino: la colección seleccionada en
  ese momento en la galería, o la carpeta `family_uploads/` si se está viendo
  "todas las fotos". Progreso y reintento por archivo; al terminar,
  invalidación de caché y refresco del grid.

### Diseño visual

Interfaz limpia y neutra tipo Google Photos (fondo claro, la cuadrícula es la
protagonista), en inglés, con objetivos táctiles y tipografía generosos porque
parte de la familia es mayor. Se abandona la estética vintage. La landing pública
sí puede tener más personalidad (es un escaparate profesional).

## 7. Manejo de errores

- Fallo o cuota agotada de la Search API → servir índice cacheado aunque esté
  caducado + aviso discreto en la UI. La galería nunca queda en blanco por un
  fallo transitorio.
- Errores de subida: reportados por archivo, con reintento individual.
- Sesión caducada: redirección a `/login` conservando el destino.
- Errores de servidor tipados (código + mensaje) consumidos por la UI como toasts.

## 8. Testing

- **Unitario (Vitest)**:
  - Módulo de sesión: emisión y verificación de tokens firmados, caducidad.
  - Servicio Cloudinary: búsqueda paginada, generación de firmas de subida,
    lógica de caché e invalidación (API simulada).
- **E2E (Playwright)**, contra mock de Cloudinary:
  1. Login correcto e incorrecto.
  2. Carga de galería y scroll infinito.
  3. Marcar/desmarcar favorito.
  4. Subir una foto.

## 9. Plan de transición (sin cortar el servicio)

1. Desarrollo en rama nueva; el sitio actual sigue publicado en Netlify.
2. Preparación: subir fotos de muestra a la carpeta `demo/`; configurar en
   Netlify las variables `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`,
   `CLOUDINARY_CLOUD_NAME`, `FAMILY_PASSWORD_HASH`, `SESSION_SECRET`.
3. *Branch deploy* de Netlify como entorno de pruebas con las fotos reales.
4. **Cutover**: merge a `main` → misma URL sirve la app nueva. En el mismo cambio
   se eliminan del repo los archivos antiguos (HTML, `js/`, `css/`, `fotos.json`,
   configuración obsoleta).
5. **Desmantelamiento** (post-cutover):
   - Eliminar el *unsigned upload preset* de Cloudinary.
   - **Rotar el API secret de Cloudinary** (hubo credenciales expuestas en el
     historial de git — ver commit `bbc65b5`).
   - Fijar una contraseña familiar nueva (la actual se considera comprometida:
     viajaba al cliente).
   - Borrar el proyecto de Firebase.
6. El repositorio queda **público** en GitHub como parte del porfolio (sin
   secretos: todo por variables de entorno).

## 10. Fuera de alcance (esta versión)

- Edición de descripciones/metadatos por foto.
- Álbumes creados por usuarios, comentarios, detección de caras.
- Borrado de fotos desde la web.
- Favoritos por persona (requeriría cuentas individuales).
- Interfaz multi-idioma.

Los metadatos y tags de Cloudinary dejan todas estas puertas abiertas sin
migraciones futuras.

## 11. Coste

Sin coste: planes gratuitos actuales de Netlify y Cloudinary; se elimina la
dependencia de Firebase en lugar de sustituirla por otro servicio.
