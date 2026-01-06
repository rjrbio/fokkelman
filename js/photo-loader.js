// ============================================
// CARGA DINÁMICA DE FOTOS DESDE CLOUDINARY
// Sistema optimizado para 3600+ fotos
// ============================================

/**
 * Carga las fotos dinámicamente desde un JSON generado por el script Python
 * MODO RECOMENDADO: Usa este método para evitar arrays enormes en el código
 */
async function loadPhotosFromJSON() {
    try {
        const response = await fetch('fotos.json');
        if (!response.ok) {
            throw new Error('No se pudo cargar fotos.json');
        }
        
        const data = await response.json();
        
        // Actualizar configuración global
        if (data.cloudName && typeof CLOUDINARY_CLOUD_NAME !== 'undefined') {
            // Ya está configurado en config.js
        }
        
        return data.photos || [];
    } catch (error) {
        console.error('Error cargando fotos desde JSON:', error);
        return [];
    }
}

/**
 * Carga las fotos directamente desde la API de Cloudinary
 * MODO ALTERNATIVO: Útil si no tienes acceso a generar JSON
 * NOTA: Requiere configuración CORS en Cloudinary
 */
async function loadPhotosFromCloudinaryAPI() {
    console.warn('⚠️ Este método requiere que habilites CORS en tu cuenta de Cloudinary');
    
    try {
        const allPhotos = [];
        let nextCursor = null;
        
        // NOTA: Esto NO funcionará sin un proxy/backend debido a CORS
        // Es mejor usar el método loadPhotosFromJSON()
        
        do {
            const url = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/list/all.json${nextCursor ? `?next_cursor=${nextCursor}` : ''}`;
            const response = await fetch(url);
            const data = await response.json();
            
            allPhotos.push(...data.resources.map(r => r.public_id));
            nextCursor = data.next_cursor;
        } while (nextCursor);
        
        return allPhotos;
    } catch (error) {
        console.error('Error cargando desde Cloudinary API:', error);
        return [];
    }
}

/**
 * Sistema de paginación para la galería
 * Evita cargar todas las 3600 fotos a la vez
 */
class GalleryPagination {
    constructor(allPhotos, photosPerPage = 100) {
        this.allPhotos = allPhotos;
        this.photosPerPage = photosPerPage;
        this.currentPage = 1;
        this.totalPages = Math.ceil(allPhotos.length / photosPerPage);
    }
    
    getCurrentPagePhotos() {
        const start = (this.currentPage - 1) * this.photosPerPage;
        const end = start + this.photosPerPage;
        return this.allPhotos.slice(start, end);
    }
    
    nextPage() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
            return true;
        }
        return false;
    }
    
    previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            return true;
        }
        return false;
    }
    
    goToPage(pageNumber) {
        if (pageNumber >= 1 && pageNumber <= this.totalPages) {
            this.currentPage = pageNumber;
            return true;
        }
        return false;
    }
    
    getPageInfo() {
        return {
            currentPage: this.currentPage,
            totalPages: this.totalPages,
            totalPhotos: this.allPhotos.length,
            photosPerPage: this.photosPerPage,
            start: (this.currentPage - 1) * this.photosPerPage + 1,
            end: Math.min(this.currentPage * this.photosPerPage, this.allPhotos.length)
        };
    }
}

/**
 * Sistema de scroll infinito para la galería
 * Carga más fotos automáticamente al hacer scroll
 */
class InfiniteScrollGallery {
    constructor(allPhotos, initialLoad = 50, loadMore = 30) {
        this.allPhotos = allPhotos;
        this.loadedCount = 0;
        this.initialLoad = initialLoad;
        this.loadMore = loadMore;
        this.isLoading = false;
    }
    
    getInitialPhotos() {
        const photos = this.allPhotos.slice(0, this.initialLoad);
        this.loadedCount = this.initialLoad;
        return photos;
    }
    
    loadNextBatch() {
        if (this.loadedCount >= this.allPhotos.length) {
            return []; // No hay más fotos
        }
        
        const start = this.loadedCount;
        const end = Math.min(start + this.loadMore, this.allPhotos.length);
        const photos = this.allPhotos.slice(start, end);
        this.loadedCount = end;
        
        return photos;
    }
    
    hasMore() {
        return this.loadedCount < this.allPhotos.length;
    }
    
    getProgress() {
        return {
            loaded: this.loadedCount,
            total: this.allPhotos.length,
            percentage: (this.loadedCount / this.allPhotos.length * 100).toFixed(1)
        };
    }
}

/**
 * Filtrado y búsqueda de fotos
 */
class PhotoFilter {
    constructor(allPhotos) {
        this.allPhotos = allPhotos;
    }
    
    // Buscar por texto en el nombre de archivo
    searchByText(query) {
        const lowerQuery = query.toLowerCase();
        return this.allPhotos.filter(photo => 
            photo.toLowerCase().includes(lowerQuery)
        );
    }
    
    // Filtrar por carpeta/década
    filterByFolder(folderName) {
        return this.allPhotos.filter(photo => 
            photo.startsWith(folderName)
        );
    }
    
    // Obtener lista de carpetas únicas
    getUniqueFolders() {
        const folders = new Set();
        this.allPhotos.forEach(photo => {
            const parts = photo.split('/');
            if (parts.length > 1) {
                folders.add(parts[0]);
            }
        });
        return Array.from(folders).sort();
    }
    
    // Distribución uniforme (para selección de recorrido)
    getUniformDistribution(count) {
        if (this.allPhotos.length <= count) {
            return this.allPhotos;
        }
        
        const step = Math.floor(this.allPhotos.length / count);
        const selected = [];
        
        for (let i = 0; i < this.allPhotos.length && selected.length < count; i += step) {
            selected.push(this.allPhotos[i]);
        }
        
        return selected;
    }
    
    // Selección aleatoria
    getRandomSelection(count) {
        const shuffled = [...this.allPhotos].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    }
}

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.GalleryPagination = GalleryPagination;
    window.InfiniteScrollGallery = InfiniteScrollGallery;
    window.PhotoFilter = PhotoFilter;
    window.loadPhotosFromJSON = loadPhotosFromJSON;
    window.loadPhotosFromCloudinaryAPI = loadPhotosFromCloudinaryAPI;
}
