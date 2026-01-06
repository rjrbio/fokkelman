# Galería Familiar Fokkelman

Galería de fotos familiar con gestión de recorridos personalizados y sincronización en la nube.

## Características

- **Galería de fotos** con paginación de 50 fotos por página
- **Sistema de autenticación** con contraseña
- **Recorrido personalizado** para guardar fotos favoritas con descripciones
- **Álbum de recuerdos** mostrando todas las fotos del recorrido
- **Sincronización Firebase** entre dispositivos de todos los miembros de la familia
- **Diseño clásico y elegante** optimizado para personas mayores

## Tecnologías

- **Frontend**: HTML5, CSS3, JavaScript vanilla
- **Almacenamiento de imágenes**: Cloudinary (cloud: dmreytypx)
- **Base de datos**: Firebase Firestore
- **Hosting**: Netlify

## Estructura del Proyecto

```
fokkelman/
├── index.html          # Página de inicio
├── galeria.html        # Galería con paginación
├── recorrido.html      # Navegación de fotos del recorrido
├── album.html          # Vista en cuadrícula del álbum
├── css/
│   └── styles.css      # Estilos principales
├── js/
│   ├── auth.js         # Sistema de autenticación
│   ├── config.js       # Configuración Cloudinary
│   ├── firebase-config.js  # Configuración Firebase
│   ├── photo-manager.js    # Gestión de fotos y recorrido
│   ├── photo-loader.js     # Carga de fotos desde JSON
│   ├── storage.js      # Gestión localStorage
│   └── lightbox.js     # Visor de imágenes
├── fotos.json          # Índice de 3659 fotos
└── netlify.toml        # Configuración de despliegue

```

## Acceso

**Contraseña**: `Fokkelman`

## Instalación Local

1. Clonar el repositorio
2. Abrir `index.html` en un navegador
3. Usar la contraseña para acceder

## Despliegue

El proyecto está configurado para despliegue en Netlify. Simplemente conectar el repositorio y Netlify se encargará del resto.

---

*Proyecto creado para la familia Fokkelman - Enero 2026*
