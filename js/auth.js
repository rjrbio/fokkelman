// ============================================
// SISTEMA DE AUTENTICACIÓN
// ============================================

const CORRECT_PASSWORD = 'Fokkelman';
const AUTH_KEY = 'fokkelman_authenticated';

/**
 * Verifica si el usuario está autenticado
 */
function isAuthenticated() {
    return sessionStorage.getItem(AUTH_KEY) === 'true';
}

/**
 * Marca al usuario como autenticado
 */
function setAuthenticated() {
    sessionStorage.setItem(AUTH_KEY, 'true');
}

/**
 * Cierra la sesión
 */
function logout() {
    sessionStorage.removeItem(AUTH_KEY);
    window.location.href = 'index.html';
}

/**
 * Verifica la contraseña ingresada
 */
function checkPassword(password) {
    return password === CORRECT_PASSWORD;
}

/**
 * Muestra el formulario de login
 */
function showLoginScreen() {
    const loginHTML = `
        <div id="loginScreen" style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, var(--cream) 0%, var(--dusty-blue) 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        ">
            <div style="
                background: var(--cream);
                border-radius: 12px;
                padding: 3rem;
                box-shadow: 0 8px 24px rgba(92, 74, 58, 0.2);
                border: 3px solid var(--soft-gold);
                max-width: 450px;
                width: 90%;
                text-align: center;
            ">
                <h1 style="
                    font-size: 2.5rem;
                    color: var(--warm-brown);
                    margin-bottom: 0.5rem;
                    font-family: Georgia, serif;
                    font-weight: normal;
                ">Fokkelman Gallery</h1>
                
                <div style="
                    font-size: 3rem; 
                    margin: 1.5rem 0;
                    color: var(--soft-gold);
                ">📸</div>
                
                <p style="
                    font-size: 1.1rem;
                    color: var(--charcoal);
                    margin-bottom: 2rem;
                    font-family: Georgia, serif;
                ">Please enter the access word</p>
                
                <form id="loginForm" onsubmit="handleLogin(event)">
                    <input 
                        type="password" 
                        id="passwordInput"
                        placeholder="Access word"
                        style="
                            width: 100%;
                            padding: 1rem 1.5rem;
                            border: 2px solid var(--warm-brown);
                            border-radius: 6px;
                            font-size: 1.1rem;
                            margin-bottom: 1.5rem;
                            font-family: Georgia, serif;
                            background: white;
                            color: var(--charcoal);
                            transition: all 0.3s ease;
                        "
                        autofocus
                    />
                    
                    <button type="submit" style="
                        width: 100%;
                        background: var(--soft-gold);
                        color: white;
                        padding: 1rem 2rem;
                        border: none;
                        border-radius: 6px;
                        font-size: 1.1rem;
                        font-weight: 600;
                        cursor: pointer;
                        font-family: Georgia, serif;
                        transition: all 0.3s ease;
                        box-shadow: 0 4px 12px rgba(201, 169, 97, 0.3);
                    ">Access to Memories</button>
                    
                    <div id="errorMessage" style="
                        color: #b91c1c;
                        margin-top: 1rem;
                        font-weight: 600;
                        display: none;
                        font-family: Georgia, serif;
                    ">❌ Incorrect access word</div>
                </form>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('afterbegin', loginHTML);
}

/**
 * Maneja el envío del formulario de login
 */
function handleLogin(event) {
    event.preventDefault();
    
    const password = document.getElementById('passwordInput').value;
    const errorMsg = document.getElementById('errorMessage');
    
    if (checkPassword(password)) {
        setAuthenticated();
        document.getElementById('loginScreen').remove();
        // Si hay una función de inicialización, llamarla
        if (typeof onAuthenticationSuccess === 'function') {
            onAuthenticationSuccess();
        }
    } else {
        errorMsg.style.display = 'block';
        document.getElementById('passwordInput').value = '';
        document.getElementById('passwordInput').focus();
        
        // Shake animation
        const form = document.getElementById('loginForm');
        form.style.animation = 'shake 0.5s';
        setTimeout(() => {
            form.style.animation = '';
        }, 500);
    }
}

/**
 * Inicializa la autenticación en la página
 */
function initAuth() {
    if (!isAuthenticated()) {
        showLoginScreen();
        return false;
    }
    return true;
}

// CSS para animación de shake
const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-10px); }
        20%, 40%, 60%, 80% { transform: translateX(10px); }
    }
`;
document.head.appendChild(style);

// Inicializar autenticación al cargar la página
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initAuth();
    });
} else {
    initAuth();
}
