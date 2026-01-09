// ============================================
// GESTIÓN DE FOTOS - CON FIREBASE Y FALLBACK A LOCALSTORAGE
// ============================================

const JOURNEY_PHOTOS_KEY = 'fokkelman_journey_photos';
const DELETED_PHOTOS_KEY = 'fokkelman_deleted_photos';
const PHOTO_DATA_KEY = 'fokkelman_photo_data';

// ============================================
// FUNCIONES DE RECORRIDO (JOURNEY)
// ============================================

/**
 * Obtiene las fotos del recorrido
 */
async function getJourneyPhotos() {
    if (firebaseInitialized) {
        try {
            const snapshot = await db.collection('journey_photos').get();
            return snapshot.docs.map(doc => doc.id);
        } catch (error) {
            console.error('Error obteniendo recorrido de Firebase:', error);
            return getJourneyPhotosLocal();
        }
    }
    return getJourneyPhotosLocal();
}

function getJourneyPhotosLocal() {
    const stored = localStorage.getItem(JOURNEY_PHOTOS_KEY);
    return stored ? JSON.parse(stored) : [];
}

/**
 * Añade una foto al recorrido
 */
async function addToJourney(photoId) {
    if (firebaseInitialized) {
        try {
            await db.collection('journey_photos').doc(photoId).set({
                addedAt: firebase.firestore.FieldValue.serverTimestamp(),
                photoId: photoId
            });
            return true;
        } catch (error) {
            console.error('Error añadiendo a Firebase:', error);
            return addToJourneyLocal(photoId);
        }
    }
    return addToJourneyLocal(photoId);
}

function addToJourneyLocal(photoId) {
    const journey = getJourneyPhotosLocal();
    if (!journey.includes(photoId)) {
        journey.push(photoId);
        localStorage.setItem(JOURNEY_PHOTOS_KEY, JSON.stringify(journey));
        return true;
    }
    return false;
}

/**
 * Elimina una foto del recorrido
 */
async function removeFromJourney(photoId) {
    if (firebaseInitialized) {
        try {
            await db.collection('journey_photos').doc(photoId).delete();
            return true;
        } catch (error) {
            console.error('Error eliminando de Firebase:', error);
            return removeFromJourneyLocal(photoId);
        }
    }
    return removeFromJourneyLocal(photoId);
}

function removeFromJourneyLocal(photoId) {
    const journey = getJourneyPhotosLocal();
    const index = journey.indexOf(photoId);
    if (index > -1) {
        journey.splice(index, 1);
        localStorage.setItem(JOURNEY_PHOTOS_KEY, JSON.stringify(journey));
        return true;
    }
    return false;
}

/**
 * Verifica si una foto está en el recorrido
 */
async function isInJourney(photoId) {
    if (firebaseInitialized) {
        try {
            const doc = await db.collection('journey_photos').doc(photoId).get();
            return doc.exists;
        } catch (error) {
            console.error('Error verificando en Firebase:', error);
            return isInJourneyLocal(photoId);
        }
    }
    return isInJourneyLocal(photoId);
}

function isInJourneyLocal(photoId) {
    return getJourneyPhotosLocal().includes(photoId);
}

// ============================================
// FUNCIONES DE FOTOS ELIMINADAS
// ============================================

/**
 * Obtiene las fotos eliminadas
 */
function getDeletedPhotos() {
    // Las fotos eliminadas son locales por usuario (no compartidas)
    const stored = localStorage.getItem(DELETED_PHOTOS_KEY);
    return stored ? JSON.parse(stored) : [];
}

/**
 * Marca una foto como eliminada
 */
async function deletePhoto(photoId) {
    // Eliminar localmente
    const deleted = getDeletedPhotos();
    if (!deleted.includes(photoId)) {
        deleted.push(photoId);
        localStorage.setItem(DELETED_PHOTOS_KEY, JSON.stringify(deleted));
        
        // También removerla del recorrido compartido
        await removeFromJourney(photoId);
        
        return true;
    }
    return false;
}

/**
 * Restaura una foto eliminada
 */
function restorePhoto(photoId) {
    const deleted = getDeletedPhotos();
    const index = deleted.indexOf(photoId);
    if (index > -1) {
        deleted.splice(index, 1);
        localStorage.setItem(DELETED_PHOTOS_KEY, JSON.stringify(deleted));
        return true;
    }
    return false;
}

/**
 * Verifica si una foto está eliminada
 */
function isDeleted(photoId) {
    return getDeletedPhotos().includes(photoId);
}

/**
 * Filtra fotos eliminadas de un array
 */
function filterDeletedPhotos(photos) {
    const deleted = getDeletedPhotos();
    return photos.filter(photo => {
        const photoId = photo.public_id || photo;
        return !deleted.includes(photoId);
    });
}

// ============================================
// FUNCIONES DE METADATOS DE FOTOS
// ============================================

/**
 * Guarda información de una foto
 */
async function savePhotoInfo(photoId, data) {
    if (firebaseInitialized) {
        try {
            await db.collection('photo_metadata').doc(photoId).set({
                description: data.description || '',
                year: data.year || '',
                place: data.place || '',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            return true;
        } catch (error) {
            console.error('Error guardando metadatos en Firebase:', error);
            return savePhotoInfoLocal(photoId, data);
        }
    }
    return savePhotoInfoLocal(photoId, data);
}

function savePhotoInfoLocal(photoId, data) {
    const photoData = getPhotoDataLocal();
    photoData[photoId] = {
        description: data.description || '',
        year: data.year || '',
        place: data.place || '',
        timestamp: new Date().toISOString()
    };
    localStorage.setItem(PHOTO_DATA_KEY, JSON.stringify(photoData));
    return true;
}

/**
 * Obtiene información de una foto
 */
async function getPhotoInfo(photoId) {
    if (firebaseInitialized) {
        try {
            const doc = await db.collection('photo_metadata').doc(photoId).get();
            if (doc.exists) {
                return doc.data();
            }
            return null;
        } catch (error) {
            console.error('Error obteniendo metadatos de Firebase:', error);
            return getPhotoInfoLocal(photoId);
        }
    }
    return getPhotoInfoLocal(photoId);
}

function getPhotoInfoLocal(photoId) {
    const photoData = getPhotoDataLocal();
    return photoData[photoId] || null;
}

function getPhotoDataLocal() {
    const stored = localStorage.getItem(PHOTO_DATA_KEY);
    return stored ? JSON.parse(stored) : {};
}

/**
 * Elimina información de una foto
 */
async function deletePhotoInfo(photoId) {
    if (firebaseInitialized) {
        try {
            await db.collection('photo_metadata').doc(photoId).delete();
            return true;
        } catch (error) {
            console.error('Error eliminando metadatos de Firebase:', error);
            return deletePhotoInfoLocal(photoId);
        }
    }
    return deletePhotoInfoLocal(photoId);
}

function deletePhotoInfoLocal(photoId) {
    const photoData = getPhotoDataLocal();
    delete photoData[photoId];
    localStorage.setItem(PHOTO_DATA_KEY, JSON.stringify(photoData));
    return true;
}

// ============================================
// FUNCIONES DE UTILIDAD
// ============================================

/**
 * Obtiene el número de fotos en el recorrido SIN información guardada
 */
async function getJourneyCount() {
    const allJourneyPhotos = await getJourneyPhotos();
    
    // Contar solo las fotos que NO tienen metadata guardada
    let count = 0;
    for (const photoId of allJourneyPhotos) {
        const info = await getPhotoInfo(photoId);
        if (!info || (!info.description && !info.year && !info.place)) {
            count++;
        }
    }
    
    return count;
}

/**
 * Limpia todos los datos (útil para debugging)
 */
async function clearAllData() {
    if (firebaseInitialized) {
        try {
            // Limpiar Firebase
            const journeySnapshot = await db.collection('journey_photos').get();
            const metadataSnapshot = await db.collection('photo_metadata').get();
            
            const batch = db.batch();
            journeySnapshot.docs.forEach(doc => batch.delete(doc.ref));
            metadataSnapshot.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            
            console.log('✓ Datos de Firebase limpiados');
        } catch (error) {
            console.error('Error limpiando Firebase:', error);
        }
    }
    
    // Limpiar localStorage
    localStorage.removeItem(JOURNEY_PHOTOS_KEY);
    localStorage.removeItem(DELETED_PHOTOS_KEY);
    localStorage.removeItem(PHOTO_DATA_KEY);
    
    console.log('✓ Datos locales limpiados');
}

/**
 * Obtiene estadísticas del sistema
 */
async function getStats() {
    const journey = await getJourneyPhotos();
    const deleted = getDeletedPhotos();
    
    return {
        journeyCount: journey.length,
        deletedCount: deleted.length,
        usingFirebase: firebaseInitialized
    };
}
