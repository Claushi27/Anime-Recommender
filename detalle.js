// detalle.js - Lógica REVISADA para la nueva página de detalles (Layout Horizontal + Sliders)

// --- Importaciones ---
import {
    getAnimeDetails, // Detalles completos de Jikan
    getAnimeStatistics, // Stats adicionales (aunque getAnimeDetails ya trae muchos)
    getAnimeCharacters,
    getAnimeStaff,
    getAnimeRecommendations,
    assignEmotions,
    getEmotionName,
    getEmotionColor
} from './api.js';

// --- Helper para obtener ID de URL ---
function getAnimeIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

// --- Selectores DOM ---
const detailContentContainer = document.getElementById('detail-content');
const loadingIndicator = detailContentContainer?.querySelector('.detail-loading');
const errorContainer = detailContentContainer?.querySelector('.detail-error');
const actualContent = detailContentContainer?.querySelector('.anime-detail-content');

// --- Funciones Mostrar/Ocultar Carga/Error/Contenido ---
function showDetailLoading(message = "Cargando detalles del anime...") {
    if (loadingIndicator) { loadingIndicator.textContent = message; loadingIndicator.style.display = 'block'; }
    if (errorContainer) errorContainer.style.display = 'none';
    if (actualContent) actualContent.style.display = 'none';
}

function showDetailError(message) {
    if (loadingIndicator) loadingIndicator.style.display = 'none';
    if (actualContent) actualContent.style.display = 'none';
    if (errorContainer) { errorContainer.innerHTML = `Error: ${message}`; errorContainer.style.display = 'block'; }
}

function showDetailContent() {
    if (loadingIndicator) loadingIndicator.style.display = 'none';
    if (errorContainer) errorContainer.style.display = 'none';
    if (actualContent) {
        actualContent.style.display = 'block'; // O 'flex' si .anime-detail-content es flex container
        // Pequeña animación de fade-in si se desea
        actualContent.style.opacity = '0';
        setTimeout(() => { actualContent.style.transition = 'opacity 0.5s'; actualContent.style.opacity = '1'; }, 50);
    }
}


// --- Función principal para cargar TODOS los datos ---
async function loadAnimeDetails() {
    const animeId = getAnimeIdFromUrl();

    if (!animeId) {
        showDetailError("No se especificó un ID de anime en la URL.");
        return;
    }

    showDetailLoading("Cargando información principal...");

    try {
        // Llamadas API en paralelo (Detalles es crucial, el resto puede fallar)
        const results = await Promise.allSettled([
            getAnimeDetails(animeId),       // 0: Detalles base (contiene muchos stats ya)
            getAnimeCharacters(animeId),    // 1: Personajes
            getAnimeStaff(animeId),         // 2: Staff
            getAnimeRecommendations(animeId) // 3: Recomendaciones
            //getAnimeStatistics(animeId), // Opcional, Jikan/anime/{id}/full ya trae mucho
        ]);

        // Procesar Detalles (Esencial)
        const detailsResult = results[0];
        if (detailsResult.status === 'rejected' || !detailsResult.value?.data) {
            console.error("Error fetching main details:", detailsResult.reason || "No data found");
            throw new Error(`No se pudo cargar la información principal. ${detailsResult.reason?.message || ''}`);
        }
        const anime = detailsResult.value.data;
        console.log("Anime Details (Full):", anime); // Debug: Ver datos recibidos

        // Poblar página y mostrar contenido base
        populatePage(anime);
        showDetailContent(); // Mostrar la estructura principal

        // --- Procesar y mostrar datos adicionales en sliders ---

        // Personajes
        showLoadingInSection('characters-slider', 'Cargando personajes...');
        const charactersResult = results[1];
        if (charactersResult.status === 'fulfilled' && charactersResult.value?.data) {
            displayCharacters(charactersResult.value.data);
        } else {
            console.warn("Could not fetch characters:", charactersResult.reason);
            displayErrorInSection('characters-slider', 'No se pudieron cargar los personajes.');
        }

        // Staff
        showLoadingInSection('staff-slider', 'Cargando staff...');
        const staffResult = results[2];
        if (staffResult.status === 'fulfilled' && staffResult.value?.data) {
            displayStaff(staffResult.value.data);
        } else {
            console.warn("Could not fetch staff:", staffResult.reason);
            displayErrorInSection('staff-slider', 'No se pudo cargar el staff.');
        }

        // Recomendaciones
        showLoadingInSection('recommendations-slider', 'Cargando recomendaciones...');
        const recommendationsResult = results[3];
        if (recommendationsResult.status === 'fulfilled' && recommendationsResult.value?.data) {
            // Limitar número de recomendaciones si es necesario
             const limitedRecs = recommendationsResult.value.data.slice(0, 15); // Mostrar hasta 15
            displayRecommendations(limitedRecs);
        } else {
            console.warn("Could not fetch recommendations:", recommendationsResult.reason);
             displayErrorInSection('recommendations-slider', 'No se pudieron cargar las recomendaciones.');
        }

    } catch (error) {
        console.error("Error fatal al cargar detalles del anime:", error);
        showDetailError(`No se pudo cargar la información del anime.<br><small>${error.message || 'Error desconocido'}</small>`);
    }
}


// --- Función para poblar el HTML con datos principales ---
function populatePage(anime) {
    // --- Columna Izquierda ---
    const posterImg = document.getElementById('anime-poster');
    if (posterImg) {
        posterImg.src = anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || './img/placeholder-poster.png'; // Placeholder
        posterImg.alt = `Poster de ${anime.title || 'anime'}`;
        posterImg.onerror = () => { posterImg.src = './img/placeholder-poster.png'; }; // Fallback
    }

    // --- Columna Derecha ---
    setTextContent('anime-title-main', anime.title || 'Título no disponible');
    setTextContent('anime-title-japanese', anime.title_japanese || (anime.title_synonyms && anime.title_synonyms.length > 0 ? anime.title_synonyms[0] : ''));

    // Stats
    setTextContent('anime-score', anime.score ? anime.score.toFixed(2) : 'N/A');
    setTextContent('anime-scored-by', anime.scored_by ? `(${formatNumber(anime.scored_by)} votos)` : '(N/A)');
    setTextContent('anime-rank', anime.rank ? `#${formatNumber(anime.rank)}` : '#N/A');
    setTextContent('anime-popularity', anime.popularity ? `#${formatNumber(anime.popularity)}` : '#N/A');
    setTextContent('anime-members', anime.members ? formatNumber(anime.members) : 'N/A');

    // Quick Info
    safeSetHTML('quick-info-type', `<i class="fas fa-tv"></i> ${anime.type || 'N/A'}`);
    safeSetHTML('quick-info-year', `<i class="fas fa-calendar-alt"></i> ${anime.year || anime.aired?.prop?.from?.year || 'N/A'}`);
    safeSetHTML('quick-info-status', `<i class="fas fa-broadcast-tower"></i> ${anime.status || 'N/A'}`);
    safeSetHTML('quick-info-studio', `<i class="fas fa-film"></i> ${anime.studios?.[0]?.name || 'N/A'}`);


    // Tags (Géneros y Emociones)
    const genresContainer = document.getElementById('anime-genres-tags');
    if (genresContainer) {
        genresContainer.innerHTML = anime.genres?.map(g => `<span class="tag genre-tag">${g.name}</span>`).join('') || '<span class="tag placeholder-tag">N/A</span>';
    }
    const emotionsContainer = document.getElementById('anime-emotions-tags');
    if (emotionsContainer) {
        const emotions = assignEmotions(anime.genres); // Usa la función de api.js
        emotionsContainer.innerHTML = emotions.map(e => `<span class="tag emotion-tag ${getEmotionColor(e)}">${getEmotionName(e)}</span>`).join('') || '<span class="tag placeholder-tag">N/A</span>';
    }

    // Sinopsis
    setTextContent('anime-synopsis', anime.synopsis || 'No hay sinopsis disponible.');


    // --- Columna Izquierda (Información Adicional y Títulos Alt) ---
    const infoList = document.getElementById('anime-info-list');
    if (infoList) {
        infoList.innerHTML = `
            <li><strong>Episodios:</strong> ${anime.episodes || 'N/A'}</li>
            <li><strong>Estreno:</strong> ${anime.aired?.string || 'N/A'}</li>
            <li><strong>Fuente:</strong> ${anime.source || 'N/A'}</li>
            <li><strong>Duración:</strong> ${anime.duration || 'N/A'}</li>
            <li><strong>Clasificación:</strong> ${anime.rating || 'N/A'}</li>
            ${anime.licensors && anime.licensors.length > 0 ? `<li><strong>Licenciantes:</strong> ${anime.licensors.map(l => l.name).join(', ')}</li>` : ''}
            ${anime.producers && anime.producers.length > 0 ? `<li><strong>Productores:</strong> ${anime.producers.map(p => p.name).join(', ')}</li>` : ''}
            `;
    }
     const altTitlesList = document.getElementById('anime-alt-titles');
    if (altTitlesList) {
        let altTitlesHTML = '';
        if (anime.title_english) altTitlesHTML += `<li><strong>Inglés:</strong> ${anime.title_english}</li>`;
        if (anime.title_synonyms && anime.title_synonyms.length > 0) {
            // Filtrar para no repetir el título japonés si ya está arriba
            const synonymsToShow = anime.title_synonyms.filter(s => s !== anime.title_japanese);
            if (synonymsToShow.length > 0) {
                 altTitlesHTML += `<li><strong>Sinónimos:</strong> ${synonymsToShow.join(', ')}</li>`;
            }
        }
        altTitlesList.innerHTML = altTitlesHTML || '<li>N/A</li>';
         if (!altTitlesHTML) altTitlesList.parentElement.style.display = 'none'; // Ocultar si no hay títulos
    }


    // --- Tráiler (en la sección inferior ahora) ---
    const trailerContent = document.getElementById('trailer-content');
    const trailerSection = document.getElementById('trailer-section');
    if (trailerContent && trailerSection) {
        if (anime.trailer?.embed_url) {
            // Quitar autoplay y otros parámetros si molestan
            let embedUrl = anime.trailer.embed_url;
            // Simple reemplazo para quitar autoplay=1 si existe
             embedUrl = embedUrl.replace('autoplay=1', 'autoplay=0');
            trailerContent.innerHTML = `
                <iframe src="${embedUrl}"
                        title="Anime Trailer" frameborder="0"
                        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowfullscreen></iframe>`;
            trailerSection.style.display = 'block'; // Asegurarse que la sección es visible
        } else {
            trailerContent.innerHTML = '<p>No hay tráiler disponible.</p>';
            // Opcional: ocultar toda la sección si no hay trailer
            // trailerSection.style.display = 'none';
        }
    } else {
        console.warn("Elementos del tráiler no encontrados (#trailer-content o #trailer-section)");
    }
}


// --- Funciones para Sliders Horizontales ---

function displayCharacters(characterData) {
    const slider = document.getElementById('characters-slider');
    if (!slider) return;
    slider.innerHTML = ''; // Limpiar placeholder/error

    if (!characterData || characterData.length === 0) {
        displayErrorInSection('characters-slider', 'No se encontró información de personajes.');
        return;
    }

    // Mostrar un número limitado, p.ej., los primeros 12-16
    characterData.slice(0, 16).forEach(item => {
        const character = item.character;
        // Buscar VA Japonés primero, luego Inglés como fallback
        const va = item.voice_actors?.find(v => v.language === 'Japanese') || item.voice_actors?.find(v => v.language === 'English');

        const card = document.createElement('div');
        card.className = 'character-card scroll-item'; // Añadir 'scroll-item'
        card.innerHTML = `
            <div class="card-col character-img-col">
                <img src="${character.images?.jpg?.image_url || './img/placeholder-char.png'}" alt="${character.name}" loading="lazy" onerror="this.src='./img/placeholder-char.png'">
            </div>
            <div class="card-col character-info-col">
                <span class="character-name">${character.name}</span>
                <span class="character-role">${item.role}</span>
            </div>
            ${va ? `
            <div class="card-col va-info-col">
                 <span class="va-name">${va.person.name}</span>
                 <span class="va-lang">(${va.language})</span>
            </div>
            <div class="card-col va-img-col">
                 <img src="${va.person.images?.jpg?.image_url || './img/placeholder-va.png'}" alt="${va.person.name}" loading="lazy" onerror="this.src='./img/placeholder-va.png'">
            </div>` : `
            <div class="card-col va-info-col"></div> <div class="card-col va-img-col"></div> `}
        `;
        slider.appendChild(card);
    });
}

function displayStaff(staffData) {
    const slider = document.getElementById('staff-slider');
    if (!slider) return;
    slider.innerHTML = ''; // Limpiar

    if (!staffData || staffData.length === 0) {
         displayErrorInSection('staff-slider', 'No se encontró información del staff.');
        return;
    }

    // Filtrar y limitar staff, p.ej., roles principales y hasta 10 personas
     const mainRoles = ['Director', 'Original Creator', 'Series Composition', 'Script', 'Music', 'Character Design', 'Art Director', 'Sound Director'];
     const filteredStaff = staffData.filter(s => s.positions.some(p => mainRoles.includes(p)))
                                   .slice(0, 12); // Mostrar hasta 12

    if (filteredStaff.length === 0) {
        displayErrorInSection('staff-slider', 'No se encontró staff principal.');
        return;
     }

    filteredStaff.forEach(item => {
        const person = item.person;
        const card = document.createElement('div');
        card.className = 'staff-card scroll-item'; // Añadir 'scroll-item'
        card.innerHTML = `
             <div class="staff-img">
                 <img src="${person.images?.jpg?.image_url || './img/placeholder-staff.png'}" alt="${person.name}" loading="lazy" onerror="this.src='./img/placeholder-staff.png'">
             </div>
             <div class="staff-info">
                 <span class="staff-name">${person.name}</span>
                 <span class="staff-role">${item.positions.join(', ')}</span>
             </div>
        `;
        slider.appendChild(card);
    });
}

function displayRecommendations(recommendationsData) {
    const slider = document.getElementById('recommendations-slider');
    if (!slider) return;
    slider.innerHTML = ''; // Limpiar

    if (!recommendationsData || recommendationsData.length === 0) {
        displayErrorInSection('recommendations-slider', 'No hay recomendaciones disponibles.');
        return;
    }

    recommendationsData.forEach(rec => {
        const anime = rec.entry;
        if (!anime?.mal_id || !anime.title) return;

        // Usar la estructura de tarjeta de anime estándar pero adaptada para slider
        const card = document.createElement('div');
        // Reutilizar clase anime-card y añadir scroll-item
        card.className = 'anime-card recommendation-card scroll-item';
        card.dataset.id = anime.mal_id;

        const imageUrl = anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || './img/placeholder-rec.png';

        card.innerHTML = `
            <img src="${imageUrl}" alt="${anime.title}" class="anime-card-img rec-img" loading="lazy" onerror="this.onerror=null; this.src='./img/placeholder-rec.png';">
            <div class="card-content rec-content">
                <div class="anime-name rec-name">${anime.title}</div>
                ${rec.votes ? `<div class="rec-votes">${rec.votes} recomendaciones</div>` : ''}
            </div>
          `;

        card.addEventListener('click', function() {
            // Recargar la página con el nuevo ID
            window.location.href = `detalle.html?id=${this.dataset.id}`;
        });
        slider.appendChild(card);
    });
}


// --- Helpers Adicionales ---
function setTextContent(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) { element.textContent = text ?? 'N/A'; } // Usar ?? para manejar null/undefined
    else { console.warn(`Elemento con ID '${elementId}' no encontrado.`); }
}

function safeSetHTML(elementId, html) {
     const element = document.getElementById(elementId);
    if (element) { element.innerHTML = html ?? ''; }
     else { console.warn(`Elemento con ID '${elementId}' no encontrado.`); }
}


function formatNumber(num) {
    const number = Number(num);
    if (isNaN(number)) return 'N/A';
    // Formato alemán usa puntos para miles, similar a algunos formatos latinos
    return new Intl.NumberFormat('de-DE').format(number);
}

function showLoadingInSection(containerId, message) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `<p class="loading-placeholder">${message}</p>`;
    }
}
function displayErrorInSection(containerId, message) {
     const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `<p class="error-placeholder">${message}</p>`;
    }
}


// --- Ejecutar al cargar la página ---
document.addEventListener('DOMContentLoaded', loadAnimeDetails);