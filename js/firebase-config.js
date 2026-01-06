// ============================================
// CONFIGURACIÓN DE FIREBASE
// ============================================

// TODO: Reemplaza esta configuración con la tuya de Firebase Console
// Para obtenerla, ve a: https://console.firebase.google.com/
// → Configuración del proyecto → Tus apps → Configuración

const firebaseConfig = {
    apiKey: "AIzaSyBJIWsuBia2rEo0oXJj-7RysIwyCV6HfcQ",
    authDomain: "galeria-fokkelman.firebaseapp.com",
    projectId: "galeria-fokkelman",
    storageBucket: "galeria-fokkelman.firebasestorage.app",
    messagingSenderId: "421869881760",
    appId: "1:421869881760:web:8080878291bd7c97d63cc5"
};

// Inicializar Firebase
let db = null;
let firebaseInitialized = false;

function initFirebase() {
    try {
        // Verificar que la configuración esté completa
        if (firebaseConfig.apiKey === "TU_API_KEY_AQUI") {
            console.warn('⚠️ Firebase no configurado - usando localStorage como fallback');
            console.warn('⚠️ Lee FIREBASE.md para instrucciones');
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
