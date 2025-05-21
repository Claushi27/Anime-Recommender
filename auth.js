// En main.js (o un nuevo auth.js que importarías en index.html)

document.addEventListener('DOMContentLoaded', () => {
    // --- Selectores para Modales ---
    const loginModal = document.getElementById('login-modal');
    const registerModal = document.getElementById('register-modal');
    
    const openLoginModalBtn = document.getElementById('open-login-btn'); // Asume que tienes este botón en tu header
    const openRegisterModalBtn = document.getElementById('open-register-btn'); // Asume que tienes este botón
    const authButtonsContainer = document.getElementById('auth-buttons');
    const userProfileControlsContainer = document.getElementById('user-profile-controls');
    const usernameDisplay = document.getElementById('username-display');
    const userAvatarImg = document.getElementById('user-avatar-img'); // Si tienes un avatar
    const logoutBtn = document.getElementById('logout-btn');
    const closeButtons = document.querySelectorAll('.modal-close-btn');
    const showRegisterLink = document.getElementById('show-register-modal');
    const showLoginLink = document.getElementById('show-login-modal');

    // --- Funciones para Modales ---
    function openModal(modal) {
        if (modal) modal.style.display = 'block';
    }

    function closeModal(modal) {
        if (modal) modal.style.display = 'none';
    }

    // --- Event Listeners ---
    if (openLoginModalBtn) {
        openLoginModalBtn.addEventListener('click', (e) => {
            e.preventDefault();
            closeModal(registerModal); // Cierra el otro si está abierto
            openModal(loginModal);
        });
    }

    if (openRegisterModalBtn) {
        openRegisterModalBtn.addEventListener('click', (e) => {
            e.preventDefault();
            closeModal(loginModal); // Cierra el otro si está abierto
            openModal(registerModal);
        });
    }

    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            const modalId = button.dataset.modalId;
            if (modalId) {
                closeModal(document.getElementById(modalId));
            }
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

    // Cerrar modal si se hace clic fuera del contenido del modal
    window.addEventListener('click', (event) => {
        if (event.target === loginModal) {
            closeModal(loginModal);
        }
        if (event.target === registerModal) {
            closeModal(registerModal);
        }
    });
    function updateLoginStatusUI() {
        const token = localStorage.getItem('accessToken'); // O sessionStorage
        const userData = JSON.parse(localStorage.getItem('userData')); // Asumiendo que guardas datos del usuario
    
        if (token && userData) {
            // Usuario logueado
            if (authButtonsContainer) authButtonsContainer.style.display = 'none';
            if (userProfileControlsContainer) userProfileControlsContainer.style.display = 'flex'; // O el display original que quieras
            if (usernameDisplay && userData.username) usernameDisplay.textContent = userData.username;
            // Aquí podrías actualizar el userAvatarImg.src si tienes esa info
        } else {
            // Usuario no logueado
            if (authButtonsContainer) authButtonsContainer.style.display = 'flex'; // O el display original
            if (userProfileControlsContainer) userProfileControlsContainer.style.display = 'none';
            if (usernameDisplay) usernameDisplay.textContent = '';
        }
    }
    
    // Llamar al cargar la página
    document.addEventListener('DOMContentLoaded', () => {
        updateLoginStatusUI(); 
        // ... resto de tu código de DOMContentLoaded ...
    
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                localStorage.removeItem('accessToken');
                localStorage.removeItem('userData');
                updateLoginStatusUI();
                // Opcional: Redirigir a la página de inicio o recargar
                // window.location.href = 'index.html'; 
            });
        }
    });
    
    // Lógica de envío de formularios (vendrá después)
    // const loginForm = document.getElementById('login-form');
    // const registerForm = document.getElementById('register-form');
    // ...

});