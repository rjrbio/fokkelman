// ============================================
// CONFIGURACIÓN GLOBAL - FAMILIA FOKKELMAN
// ============================================

// Cloudinary Cloud Name (configurado en config.env.js)
const CLOUD_NAME = typeof ENV_CONFIG !== 'undefined' ? ENV_CONFIG.CLOUDINARY_CLOUD_NAME : 'your-cloud-name';
const CLOUDINARY_CLOUD_NAME = CLOUD_NAME; // Alias para compatibilidad

// Array de fotos para el RECORRIDO (selección especial)
// NOTA: Este array se carga desde fotos.json automáticamente
// Solo necesitas editarlo si quieres una selección manual específica
const journeyPhotos = [
    // Las fotos se cargarán dinámicamente desde Cloudinary
    // O puedes añadirlas manualmente aquí si prefieres
];

// Array de TODAS las fotos para la GALERÍA
// NOTA: Este array se carga desde fotos.json automáticamente
const allPhotos = [
    // Las fotos se cargarán dinámicamente desde fotos.json
];

/**
 * Función helper para generar URLs de Cloudinary
 * @param {string} photoPath - Ruta de la foto
 * @param {string} transformation - Transformaciones de Cloudinary
 * @returns {string} URL completa de Cloudinary
 */
function getCloudinaryUrl(photoPath, transformation = '') {
    return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${transformation}${photoPath}`;
}
