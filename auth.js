// auth.js

document.addEventListener('DOMContentLoaded', () => {
    // --- Selectores ---
    const loginModal = document.getElementById('login-modal');
    const registerModal = document.getElementById('register-modal');
    
    const openLoginModalBtn = document.getElementById('open-login-btn');
    const openRegisterModalBtn = document.getElementById('open-register-btn');

    const closeButtons = document.querySelectorAll('.modal-close-btn');
    const showRegisterLink = document.getElementById('show-register-modal-link');
    const showLoginLink = document.getElementById('show-login-modal-link');

    const authButtonsContainer = document.getElementById('auth-buttons');
    const userProfileControlsContainer = document.getElementById('user-profile-controls');
    const usernameDisplay = document.getElementById('username-display');
    const logoutBtn = document.getElementById('logout-btn');

    const loginForm = document.getElementById('login-form');
    const loginErrorMessage = document.getElementById('login-error-message');

    // --- 👈 NUEVO: Selectores para el Formulario de Registro ---
    const registerForm = document.getElementById('register-form');
    const registerErrorMessage = document.getElementById('register-error-message');

    // --- Funciones para Modales ---
    function openModal(modal) {
        if (modal) {
            modal.style.display = 'block';
            // Limpiar mensajes de error previos al abrir
            if (loginErrorMessage) loginErrorMessage.style.display = 'none'; 
            if (registerErrorMessage) registerErrorMessage.style.display = 'none'; // 👈 Limpiar error de registro
        }
    }

    function closeModal(modal) {
        if (modal) modal.style.display = 'none';
    }

    // --- Función para actualizar UI de Login/Logout ---
    function updateLoginStatusUI() {
        const token = localStorage.getItem('accessToken');
        const userDataString = localStorage.getItem('userData');
    
        if (token && userDataString) {
            const userData = JSON.parse(userDataString);
            if (authButtonsContainer) authButtonsContainer.style.display = 'none';
            if (userProfileControlsContainer) userProfileControlsContainer.style.display = 'flex'; 
            if (usernameDisplay && userData.username) {
                // 👈 NUEVO: Hacer que el nombre de usuario sea un enlace al perfil
                usernameDisplay.innerHTML = `<a href="profile.html" style="color: inherit; text-decoration: none;">${userData.username}</a>`;
                usernameDisplay.title = "Ir a mi perfil"; // Tooltip opcional
            }
        } else {
            // ... (lógica para usuario no logueado se mantiene igual) ...
            if (authButtonsContainer) authButtonsContainer.style.display = 'flex'; 
            if (userProfileControlsContainer) userProfileControlsContainer.style.display = 'none';
            if (usernameDisplay) usernameDisplay.textContent = '';
        }
    }
    
    updateLoginStatusUI(); // Llamar al cargar la página

    // --- Event Listeners para abrir/cerrar modales ---
    if (openLoginModalBtn) {
        openLoginModalBtn.addEventListener('click', (e) => {
            e.preventDefault();
            closeModal(registerModal); 
            openModal(loginModal);
        });
    }
    if (openRegisterModalBtn) {
        openRegisterModalBtn.addEventListener('click', (e) => {
            e.preventDefault();
            closeModal(loginModal); 
            openModal(registerModal);
        });
    }
    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            const modalId = button.dataset.modalId;
            if (modalId) closeModal(document.getElementById(modalId));
        });
    });
    if (showRegisterLink) {
        showRegisterLink.addEventListener('click', (e) => {
            e.preventDefault();
            closeModal(loginModal);
            openModal(registerModal);
        });
    }
    if (showLoginLink) {
        showLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            closeModal(registerModal);
            openModal(loginModal);
        });
    }
    window.addEventListener('click', (event) => {
        if (event.target === loginModal) closeModal(loginModal);
        if (event.target === registerModal) closeModal(registerModal);
    });

    // --- Lógica para el Formulario de Login ---
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault(); 
            if (loginErrorMessage) loginErrorMessage.style.display = 'none';

            const formData = new FormData(loginForm);
            const data = Object.fromEntries(formData.entries());

            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });

                const responseData = await response.json();

                if (response.ok) {
                    console.log('Login exitoso:', responseData);
                    localStorage.setItem('accessToken', responseData.access_token);
                    localStorage.setItem('userData', JSON.stringify(responseData.user));
                    
                    updateLoginStatusUI(); 
                    closeModal(loginModal); 
                    loginForm.reset();
                } else {
                    if (loginErrorMessage) {
                        loginErrorMessage.textContent = responseData.msg || 'Error en el login.';
                        loginErrorMessage.style.display = 'block';
                    }
                    console.error('Error en login:', responseData);
                }
            } catch (error) {
                console.error('Error de red o al procesar el login:', error);
                if (loginErrorMessage) {
                    loginErrorMessage.textContent = 'Error de conexión. Intenta de nuevo.';
                    loginErrorMessage.style.display = 'block';
                }
            }
        });
    }

    // --- Lógica para el Botón de Logout ---
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('userData');
            updateLoginStatusUI(); 
            console.log('Usuario deslogueado');
        });
    }

    // --- 👈 NUEVO: Lógica para el Formulario de Registro ---
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // Prevenir envío tradicional
            if (registerErrorMessage) registerErrorMessage.style.display = 'none'; // Ocultar errores previos

            const formData = new FormData(registerForm);
            const data = Object.fromEntries(formData.entries());

            // Validación simple de frontend para contraseñas
            if (data.password !== data.confirm_password) {
                if (registerErrorMessage) {
                    registerErrorMessage.textContent = 'Las contraseñas no coinciden.';
                    registerErrorMessage.style.display = 'block';
                }
                return; // No enviar la petición
            }

            // Payload para enviar al backend (sin confirm_password)
            const payload = {
                username: data.username,
                email: data.email,
                password: data.password
            };

            try {
                const response = await fetch('/api/auth/register', { // URL del endpoint de registro
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                const responseData = await response.json();

                if (response.ok) { // HTTP 201 Created
                    console.log('Registro exitoso:', responseData);
                    alert('¡Registro exitoso! Ahora puedes iniciar sesión.'); // Mensaje simple
                    closeModal(registerModal); // Cerrar modal de registro
                    registerForm.reset(); // Limpiar formulario
                    openModal(loginModal); // Opcional: Abrir modal de login automáticamente
                } else {
                    // Mostrar mensaje de error de la API
                    if (registerErrorMessage) {
                        registerErrorMessage.textContent = responseData.msg || 'Error en el registro.';
                        registerErrorMessage.style.display = 'block';
                    }
                    console.error('Error en registro:', responseData);
                }
            } catch (error) {
                console.error('Error de red o al procesar el registro:', error);
                if (registerErrorMessage) {
                    registerErrorMessage.textContent = 'Error de conexión. Intenta de nuevo.';
                    registerErrorMessage.style.display = 'block';
                }
            }
        });
    }
});