// ============================================
// SISTEMA DE ALMACENAMIENTO DE DATOS
// ============================================

/**
 * NOTA: Este es un almacenamiento temporal en memoria del navegador
 * Para persistencia real entre sesiones y dispositivos, necesitarás 
 * integrar Firebase, Supabase u otro servicio de backend
 */

// Objeto para almacenar información de las fotos
let photoData = {};

/**
 * Inicializar datos desde localStorage
 */
function initStorage() {
    const savedData = localStorage.getItem('fokkelman_photo_data');
    if (savedData) {
        try {
            photoData = JSON.parse(savedData);
        } catch (error) {
            console.error('Error al cargar datos:', error);
            photoData = {};
        }
    }
}

/**
 * Guardar información de una foto
 * @param {string} photoId - ID de la foto (public_id de Cloudinary)
 * @param {Object} data - Datos de la foto (description, year, place)
 */
function savePhotoInfo(photoId, data) {
    photoData[photoId] = {
        description: data.description || '',
        year: data.year || '',
        place: data.place || '',
        timestamp: new Date().toISOString()
    };
    
    // Guardar en localStorage
    localStorage.setItem('fokkelman_photo_data', JSON.stringify(photoData));
    
    console.log('Datos guardados:', photoData[photoId]);
}

/**
 * Obtener información de una foto
 * @param {string} photoId - ID de la foto (public_id de Cloudinary)
 * @returns {Object|null} Información de la foto o null si no existe
 */
function getPhotoInfo(photoId) {
    return photoData[photoId] || null;
}

/**
 * Eliminar información de una foto (para editar)
 * @param {string} photoId - ID de la foto (public_id de Cloudinary)
 */
function deletePhotoInfo(photoId) {
    delete photoData[photoId];
    localStorage.setItem('fokkelman_photo_data', JSON.stringify(photoData));
}

/**
 * Exportar todos los datos a JSON (para backup)
 * @returns {string} JSON con todos los datos
 */
function exportData() {
    return JSON.stringify(photoData, null, 2);
}

/**
 * Importar datos desde JSON
 * @param {string} jsonData - Datos en formato JSON
 */
function importData(jsonData) {
    try {
        photoData = JSON.parse(jsonData);
        localStorage.setItem('fokkelman_photo_data', JSON.stringify(photoData));
        return true;
    } catch (error) {
        console.error('Error al importar datos:', error);
        return false;
    }
}

// Inicializar al cargar el script
initStorage();
