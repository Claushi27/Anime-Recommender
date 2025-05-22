// profile.js

import { getAnimeDetails } from './api.js'; // Para obtener detalles de cada anime

document.addEventListener('DOMContentLoaded', () => {
    // La lógica de auth.js ya debería haber actualizado el header si el usuario está logueado.
    // Aquí verificamos si realmente hay un token para cargar el perfil.
    const token = localStorage.getItem('accessToken');
    const userDataString = localStorage.getItem('userData');

    if (!token || !userDataString) {
        // No está logueado, redirigir al inicio o mostrar mensaje
        alert("Debes iniciar sesión para ver tu perfil.");
        window.location.href = 'index.html';
        return;
    }

    const userData = JSON.parse(userDataString);
    const profileUsernameGreeting = document.getElementById('profile-username-greeting');
    if (profileUsernameGreeting && userData.username) {
        profileUsernameGreeting.textContent = `Bienvenido, ${userData.username}. Gestiona tus listas y actividad.`;
    }

    setupTabs();
    loadUserAnimeLists();
});

function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-navigation .tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Quitar active de todos los botones y contenidos
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Añadir active al botón clickeado y al contenido correspondiente
            button.classList.add('active');
            const tabId = button.dataset.tab;
            const activeContent = document.getElementById(`tab-content-${tabId}`);
            if (activeContent) {
                activeContent.classList.add('active');
            }
        });
    });
}

async function loadUserAnimeLists() {
    const token = localStorage.getItem('accessToken');
    if (!token) return; // Ya debería estar manejado, pero por si acaso

    try {
        const response = await fetch('/api/me/animelist', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Error al cargar las listas de anime:", errorData.msg);
            // Mostrar error en todas las pestañas
            document.querySelectorAll('.anime-list-grid').forEach(grid => {
                grid.innerHTML = `<p class="empty-list">Error al cargar tu lista: ${errorData.msg || 'Intenta de nuevo.'}</p>`;
            });
            return;
        }

        const animeListEntries = await response.json();
        console.log("Entradas de lista recibidas:", animeListEntries);

        // Limpiar contenedores de listas
        document.querySelectorAll('.anime-list-grid').forEach(grid => grid.innerHTML = '');

        if (animeListEntries.length === 0) {
            document.querySelectorAll('.anime-list-grid').forEach(grid => {
                grid.innerHTML = '<p class="empty-list">Aún no tienes animes en esta categoría de tu lista.</p>';
            });
            // Dejamos la primera pestaña activa por defecto si no hay nada, pero vacía.
             // Asegurar que la pestaña "Viendo" se muestre vacía si es el caso
            const watchingListContainer = document.getElementById('watching-list');
            if (watchingListContainer.innerHTML === '') { // Solo si realmente está vacía
                watchingListContainer.innerHTML = '<p class="empty-list">Aún no tienes animes en esta categoría de tu lista.</p>';
            }
            return;
        }
        
        // Agrupar animes por estado
        const listsByStatus = {
            watching: [], completed: [], planned: [],
            on_hold: [], dropped: [], favorites: []
        };

        animeListEntries.forEach(entry => {
            if (listsByStatus[entry.status]) {
                listsByStatus[entry.status].push(entry);
            }
            // Si un anime es 'favorites', podría estar también en otra lista (ej. 'completed' y 'favorites')
            // Tu modelo actual tiene 'favorites' como un estado mutuamente excluyente.
            // Si quisieras que 'favorites' sea una marca adicional, el modelo de datos y la lógica cambiarían.
        });
        
        // Renderizar cada lista
        for (const status in listsByStatus) {
            const container = document.getElementById(`${status}-list`);
            if (container) {
                if (listsByStatus[status].length > 0) {
                    renderAnimeList(container, listsByStatus[status]);
                } else {
                    container.innerHTML = '<p class="empty-list">Aún no tienes animes en esta categoría de tu lista.</p>';
                }
            }
        }

    } catch (error) {
        console.error("Error de red o al procesar listas:", error);
        document.querySelectorAll('.anime-list-grid').forEach(grid => {
            grid.innerHTML = `<p class="empty-list">Ocurrió un error al cargar tus listas.</p>`;
        });
    }
}

async function renderAnimeList(containerElement, entries) {
    containerElement.innerHTML = ''; // Limpiar
    if (entries.length === 0) {
        containerElement.innerHTML = '<p class="empty-list">Nada aquí aún.</p>';
        return;
    }

    for (const entry of entries) {
        // Para cada entrada, necesitamos los detalles del anime (imagen, título)
        // Esto puede ser LENTO si hay muchos animes. Considera una optimización futura.
        try {
            // Intenta obtener datos del JSON local primero si tienes una forma de buscarlo por ID
            // o llama a Jikan API
            const animeDetails = await getAnimeDetails(entry.anime_mal_id); // Desde api.js
            
            if (animeDetails && animeDetails.data) {
                const anime = animeDetails.data;
                const card = document.createElement('div');
                card.className = 'profile-anime-card';
                card.innerHTML = `
                    <a href="detalle.html?id=${anime.mal_id}">
                        <img src="${anime.images?.jpg?.image_url || './img/placeholder-card.png'}" alt="${anime.title || 'Anime'}">
                    </a>
                    <div class="info">
                        <div class="title" title="${anime.title || 'N/A'}">${anime.title || 'N/A'}</div>
                        <div class="user-status">Estado: ${getDisplayStatus(entry.status)}</div>
                        <div class="user-score">Puntuación: ${entry.score !== null ? `<strong>${entry.score}/10</strong>` : 'N/A'}</div>
                        ${entry.episodes_watched !== null ? `<div class="user-episodes">Ep. Vistos: ${entry.episodes_watched}</div>` : ''}
                        <div class="actions">
                            <button class="edit-entry-btn" data-anime-id="${anime.mal_id}" data-entry-id="${entry.id}">Editar</button>
                            </div>
                    </div>
                `;
                // Event listener para el botón de editar (redirige a detalle.html por ahora)
                card.querySelector('.edit-entry-btn')?.addEventListener('click', () => {
                    window.location.href = `detalle.html?id=${anime.mal_id}`; // Lleva a la página de detalles para editar
                });
                containerElement.appendChild(card);
            } else {
                console.warn(`No se encontraron detalles para el anime con ID: ${entry.anime_mal_id}`);
                // Podrías mostrar una tarjeta placeholder para este caso
            }
        } catch (error) {
            console.error(`Error al obtener detalles para el anime ${entry.anime_mal_id}:`, error);
            // Podrías mostrar una tarjeta de error para este anime específico
        }
    }
}

// Helper para traducir status (ya lo tienes en detalle.js, lo repetimos aquí por si acaso o lo importas)
function getDisplayStatus(statusKey) { 
    const statusMap = { 'watching': 'Viendo', 'completed': 'Completado', 'planned': 'Planeado Ver', 'on_hold': 'En Pausa', 'dropped': 'Dejado', 'favorites': 'Favoritos' };
    return statusMap[statusKey] || statusKey;
}