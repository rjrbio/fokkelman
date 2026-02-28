// ============================================
// CONFIGURACIÓN DE FIREBASE
// ============================================

// Configuración de Firebase (lee de config.env.js si está disponible)
const firebaseConfig = typeof ENV_CONFIG !== 'undefined' ? {
    apiKey: ENV_CONFIG.FIREBASE_API_KEY,
    authDomain: ENV_CONFIG.FIREBASE_AUTH_DOMAIN,
    projectId: ENV_CONFIG.FIREBASE_PROJECT_ID,
    storageBucket: ENV_CONFIG.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: ENV_CONFIG.FIREBASE_MESSAGING_SENDER_ID,
    appId: ENV_CONFIG.FIREBASE_APP_ID
} : {
    apiKey: "YOUR_API_KEY_HERE",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.firebasestorage.app",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abc123def456"
};

// Inicializar Firebase
let db = null;
let firebaseInitialized = false;

function initFirebase() {
    try {
        // Verificar que la configuración esté completa
        if (firebaseConfig.apiKey === "YOUR_API_KEY_HERE") {
            console.warn('⚠️ Firebase not configured - using localStorage as fallback');
            console.warn('⚠️ Create js/config.env.js from .env.example template');
            return false;
        }
        
        // Inicializar Firebase
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        firebaseInitialized = true;
        
        console.log('✓ Firebase inicializado correctamente');
        return true;
        
    } catch (error) {
        console.error('Error inicializando Firebase:', error);
        console.warn('⚠️ Usando localStorage como fallback');
        return false;
    }
}

// Inicializar cuando Firebase esté disponible
if (typeof firebase !== 'undefined') {
    initFirebase();
} else {
    console.warn('⚠️ Firebase SDK no cargado - usando localStorage');
}
