// ============================================
// LIGHTBOX (VISOR DE FOTOS)
// ============================================

/**
 * Abre el lightbox con una imagen
 * @param {string} imageUrl - URL de la imagen a mostrar
 */
function openLightbox(imageUrl) {
    const lightbox = document.getElementById('lightbox');
    const img = document.getElementById('lightboxImg');
    
    if (!lightbox || !img) {
        console.error('Elementos del lightbox no encontrados');
        return;
    }
    
    img.src = imageUrl;
    lightbox.classList.add('active');
    
    // Prevenir scroll del body cuando el lightbox está abierto
    document.body.style.overflow = 'hidden';
}

/**
 * Cierra el lightbox
 */
function closeLightbox() {
    const lightbox = document.getElementById('lightbox');
    
    if (!lightbox) {
        console.error('Elemento lightbox no encontrado');
        return;
    }
    
    lightbox.classList.remove('active');
    
    // Restaurar scroll del body
    document.body.style.overflow = '';
}

/**
 * Inicializar eventos del lightbox
 */
function initLightbox() {
    // Cerrar lightbox con tecla ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeLightbox();
        }
    });

    // Cerrar lightbox al hacer clic fuera de la imagen
    const lightbox = document.getElementById('lightbox');
    if (lightbox) {
        lightbox.addEventListener('click', (e) => {
            if (e.target.id === 'lightbox') {
                closeLightbox();
            }
        });
    }
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLightbox);
} else {
    initLightbox();
}
