// detalle.js - Lógica REVISADA para la nueva página de detalles

// --- Importaciones ---
import {
    getAnimeDetails,
    getAnimeCharacters,
    getAnimeStaff,
    getAnimeRecommendations,
    assignEmotions,
    getEmotionName,
    getEmotionColor
} from './api.js';

// --- Helper para obtener ID de Anime de URL ---
function getAnimeIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}
const ANIME_ID_GLOBAL = getAnimeIdFromUrl(); // Guardar el ID globalmente para esta página

// --- Selectores DOM Principales ---
const detailContentContainer = document.getElementById('detail-content');
const loadingIndicator = detailContentContainer?.querySelector('.detail-loading');
const errorContainer = detailContentContainer?.querySelector('.detail-error');
const actualContent = detailContentContainer?.querySelector('.anime-detail-content');

// --- Selectores DOM para la Gestión de Lista del Usuario ---
const userAnimeStatusSection = document.getElementById('user-anime-status-section');
const manageListButton = document.getElementById('manage-list-button');
const currentUserStatusDisplay = document.getElementById('current-user-status');
const animeListForm = document.getElementById('anime-list-form');
const listStatusSelect = document.getElementById('list-status');
const listScoreInput = document.getElementById('list-score');
const listEpisodesInput = document.getElementById('list-episodes');
const saveToListBtn = document.getElementById('save-to-list-btn');
const removeFromListBtn = document.getElementById('remove-from-list-btn');
const listActionMessage = document.getElementById('list-action-message');

// --- Selectores DOM para la Gestión de Reviews del Usuario ---
const userReviewSection = document.getElementById('user-review-section');
const currentUserReviewDisplay = document.getElementById('current-user-review-display');
const animeReviewForm = document.getElementById('anime-review-form');
const reviewTextarea = document.getElementById('review-text');
const reviewRatingInput = document.getElementById('review-rating');
const reviewSpoilerCheckbox = document.getElementById('review-spoiler');
const saveReviewBtn = document.getElementById('save-review-btn');
const deleteReviewBtn = document.getElementById('delete-review-btn');
const reviewActionMessage = document.getElementById('review-action-message');
const allReviewsListContainer = document.getElementById('anime-reviews-list'); // Para reviews de OTROS usuarios


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
        actualContent.style.display = 'block';
        actualContent.style.opacity = '0';
        setTimeout(() => { actualContent.style.transition = 'opacity 0.5s'; actualContent.style.opacity = '1'; }, 50);
    }
}

// --- Función principal para cargar TODOS los datos ---
async function loadAnimeDetails() {
    if (!ANIME_ID_GLOBAL) {
        showDetailError("No se especificó un ID de anime en la URL.");
        return;
    }
    showDetailLoading("Cargando información principal...");
    try {
        const results = await Promise.allSettled([
            getAnimeDetails(ANIME_ID_GLOBAL),
            getAnimeCharacters(ANIME_ID_GLOBAL),
            getAnimeStaff(ANIME_ID_GLOBAL),
            getAnimeRecommendations(ANIME_ID_GLOBAL),
            fetch(`/api/anime/${ANIME_ID_GLOBAL}/reviews`).then(res => res.ok ? res.json() : Promise.resolve([]))
        ]);

        const detailsResult = results[0];
        if (detailsResult.status === 'rejected' || !detailsResult.value?.data) {
            throw new Error(`No se pudo cargar la información principal. ${detailsResult.reason?.message || ''}`);
        }
        const anime = detailsResult.value.data;
        populatePage(anime);
        showDetailContent();

        await checkUserLoginAndLoadListData();
        await checkUserLoginAndLoadReviewData(); 
        
        showLoadingInSection('characters-slider', 'Cargando personajes...');
        const charactersResult = results[1];
        if (charactersResult.status === 'fulfilled' && charactersResult.value?.data) {
            displayCharacters(charactersResult.value.data); // Esta es la llamada
        } else { displayErrorInSection('characters-slider', 'No se pudieron cargar los personajes.'); }

        showLoadingInSection('staff-slider', 'Cargando staff...');
        const staffResult = results[2];
        if (staffResult.status === 'fulfilled' && staffResult.value?.data) {
            displayStaff(staffResult.value.data); // Esta es la llamada
        } else { displayErrorInSection('staff-slider', 'No se pudo cargar el staff.'); }

        showLoadingInSection('recommendations-slider', 'Cargando recomendaciones...');
        const recommendationsResult = results[3];
        if (recommendationsResult.status === 'fulfilled' && recommendationsResult.value?.data) {
            displayRecommendations(recommendationsResult.value.data.slice(0, 15)); // Esta es la llamada
        } else { displayErrorInSection('recommendations-slider', 'No se pudieron cargar las recomendaciones.'); }

        const otherReviewsResult = results[4];
        if (otherReviewsResult.status === 'fulfilled' && Array.isArray(otherReviewsResult.value)) {
            displayOtherUsersReviews(otherReviewsResult.value); // Esta es la llamada
        } else {
            console.warn("No se pudieron cargar las reviews de otros usuarios:", otherReviewsResult.reason);
            if (allReviewsListContainer) displayErrorInSection('anime-reviews-list', 'No se pudieron cargar las reviews de otros usuarios.');
        }
    } catch (error) {
        console.error("Error fatal al cargar detalles del anime:", error);
        // Asegúrate de que el error.message se muestre correctamente
        let errorMessageText = "Error desconocido";
        if (error && error.message) { // Verificar si error y error.message existen
            errorMessageText = error.message;
        }
        showDetailError(`No se pudo cargar la información del anime.<br><small>${errorMessageText}</small>`);
    }
}

// --- Función para poblar el HTML con datos principales del anime (Jikan) ---
function populatePage(anime) {
    const posterImg = document.getElementById('anime-poster');
    if (posterImg) {
        posterImg.src = anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || './img/placeholder-poster.png';
        posterImg.alt = `Poster de ${anime.title || 'anime'}`;
        posterImg.onerror = () => { posterImg.src = './img/placeholder-poster.png'; };
    }
    setTextContent('anime-title-main', anime.title || 'Título no disponible');
    setTextContent('anime-title-japanese', anime.title_japanese || (anime.title_synonyms && anime.title_synonyms.length > 0 ? anime.title_synonyms[0] : ''));
    setTextContent('anime-score', anime.score ? anime.score.toFixed(2) : 'N/A');
    setTextContent('anime-scored-by', anime.scored_by ? `(${formatNumber(anime.scored_by)} votos)` : '(N/A)');
    setTextContent('anime-rank', anime.rank ? `#${formatNumber(anime.rank)}` : '#N/A');
    setTextContent('anime-popularity', anime.popularity ? `#${formatNumber(anime.popularity)}` : '#N/A');
    setTextContent('anime-members', anime.members ? formatNumber(anime.members) : 'N/A');
    safeSetHTML('quick-info-type', `<i class="fas fa-tv"></i> ${anime.type || 'N/A'}`);
    safeSetHTML('quick-info-year', `<i class="fas fa-calendar-alt"></i> ${anime.year || anime.aired?.prop?.from?.year || 'N/A'}`);
    safeSetHTML('quick-info-status', `<i class="fas fa-broadcast-tower"></i> ${anime.status || 'N/A'}`);
    safeSetHTML('quick-info-studio', `<i class="fas fa-film"></i> ${anime.studios?.[0]?.name || 'N/A'}`);
    const genresContainer = document.getElementById('anime-genres-tags');
    if (genresContainer) { genresContainer.innerHTML = anime.genres?.map(g => `<span class="tag genre-tag">${g.name}</span>`).join('') || '<span class="tag placeholder-tag">N/A</span>';}
    const emotionsContainer = document.getElementById('anime-emotions-tags');
    if (emotionsContainer) { const emotions = assignEmotions(anime.genres); emotionsContainer.innerHTML = emotions.map(e => `<span class="tag emotion-tag ${getEmotionColor(e)}">${getEmotionName(e)}</span>`).join('') || '<span class="tag placeholder-tag">N/A</span>';}
    setTextContent('anime-synopsis', anime.synopsis || 'No hay sinopsis disponible.');
    const infoList = document.getElementById('anime-info-list');
    if (infoList) { infoList.innerHTML = `<li><strong>Episodios:</strong> ${anime.episodes || 'N/A'}</li><li><strong>Estreno:</strong> ${anime.aired?.string || 'N/A'}</li><li><strong>Fuente:</strong> ${anime.source || 'N/A'}</li><li><strong>Duración:</strong> ${anime.duration || 'N/A'}</li><li><strong>Clasificación:</strong> ${anime.rating || 'N/A'}</li>${anime.licensors && anime.licensors.length > 0 ? `<li><strong>Licenciantes:</strong> ${anime.licensors.map(l => l.name).join(', ')}</li>` : ''}${anime.producers && anime.producers.length > 0 ? `<li><strong>Productores:</strong> ${anime.producers.map(p => p.name).join(', ')}</li>` : ''}`; }
    const altTitlesList = document.getElementById('anime-alt-titles');
    if (altTitlesList) { let altTitlesHTML = ''; if (anime.title_english) altTitlesHTML += `<li><strong>Inglés:</strong> ${anime.title_english}</li>`; if (anime.title_synonyms && anime.title_synonyms.length > 0) { const synonymsToShow = anime.title_synonyms.filter(s => s !== anime.title_japanese); if (synonymsToShow.length > 0) { altTitlesHTML += `<li><strong>Sinónimos:</strong> ${synonymsToShow.join(', ')}</li>`; } } altTitlesList.innerHTML = altTitlesHTML || '<li>N/A</li>'; if (!altTitlesHTML && altTitlesList.parentElement) altTitlesList.parentElement.style.display = 'none'; }
    const trailerContent = document.getElementById('trailer-content'); const trailerSection = document.getElementById('trailer-section');
    if (trailerContent && trailerSection) { if (anime.trailer?.embed_url) { let embedUrl = anime.trailer.embed_url.replace('autoplay=1', 'autoplay=0'); trailerContent.innerHTML = `<iframe src="${embedUrl}" title="Anime Trailer" frameborder="0" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`; trailerSection.style.display = 'block'; } else { trailerContent.innerHTML = '<p>No hay tráiler disponible.</p>'; } }
}

// --- Funciones para la Lista del Usuario ---
async function checkUserLoginAndLoadListData() {
    const token = localStorage.getItem('accessToken');
    if (!token) {
        if (userAnimeStatusSection) userAnimeStatusSection.style.display = 'none';
        if (manageListButton) {
            manageListButton.disabled = true;
            manageListButton.title = "Inicia sesión para gestionar tu lista";
        }
        return;
    }

    if (manageListButton) {
        manageListButton.disabled = false;
        manageListButton.title = "Gestionar este anime en tu lista";
    }
    if (userAnimeStatusSection) userAnimeStatusSection.style.display = 'block'; 

    try {
        const response = await fetch(`/api/me/animelist/${ANIME_ID_GLOBAL}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const entryData = await response.json();
            updateUserAnimeListUI(entryData);
        } else if (response.status === 404) { 
            updateUserAnimeListUI(null);
        } else {
            const errorData = await response.json();
            updateUserAnimeListUI(null, `Error: ${errorData.msg}`);
        }
    } catch (error) {
        updateUserAnimeListUI(null, 'Error de conexión al verificar tu lista.');
    }
}

function updateUserAnimeListUI(entryData, errorMessage = null) {
    if (!currentUserStatusDisplay || !animeListForm || !listActionMessage || !removeFromListBtn || !saveToListBtn || !listStatusSelect || !listScoreInput || !listEpisodesInput) return;
    listActionMessage.style.display = 'none'; 
    if (errorMessage) {
        currentUserStatusDisplay.innerHTML = `<p class="no-status">${errorMessage}</p>`;
        animeListForm.reset(); 
        removeFromListBtn.style.display = 'none';
        saveToListBtn.textContent = 'Guardar en Mi Lista';
        return;
    }
    if (entryData) {
        currentUserStatusDisplay.innerHTML = `<p><strong>Estado:</strong> ${getDisplayStatus(entryData.status)}<br><strong>Tu Puntuación:</strong> ${entryData.score !== null ? entryData.score + '/10' : 'Sin puntuar'}<br><strong>Episodios Vistos:</strong> ${entryData.episodes_watched !== null ? entryData.episodes_watched : 'N/A'}</p>`;
        listStatusSelect.value = entryData.status;
        listScoreInput.value = entryData.score || '';
        listEpisodesInput.value = entryData.episodes_watched || '';
        saveToListBtn.textContent = 'Actualizar en Mi Lista';
        removeFromListBtn.style.display = 'inline-block';
    } else {
        currentUserStatusDisplay.innerHTML = `<p class="no-status">Este anime no está en tu lista.</p>`;
        animeListForm.reset();
        saveToListBtn.textContent = 'Guardar en Mi Lista';
        removeFromListBtn.style.display = 'none';
    }
}

function getDisplayStatus(statusKey) { 
    const statusMap = { 'watching': 'Viendo', 'completed': 'Completado', 'planned': 'Planeado Ver', 'on_hold': 'En Pausa', 'dropped': 'Dejado', 'favorites': 'Favoritos' };
    return statusMap[statusKey] || statusKey;
}

function showListActionMessage(message, isSuccess = true) {
    if (!listActionMessage) return;
    listActionMessage.textContent = message;
    listActionMessage.className = `list-action-message ${isSuccess ? 'success' : 'error'}`;
    listActionMessage.style.display = 'block';
    setTimeout(() => { listActionMessage.style.display = 'none'; }, 3000);
}

// --- Funciones para la Review del Usuario Actual ---
async function checkUserLoginAndLoadReviewData() {
    const token = localStorage.getItem('accessToken');
    if (!token) {
        if (userReviewSection) userReviewSection.style.display = 'none';
        return;
    }
    if (userReviewSection) userReviewSection.style.display = 'block';
    try {
        const userDataString = localStorage.getItem('userData');
        if (!userDataString) { updateUserReviewUI(null, "No se pudo cargar datos del usuario."); return; }
        const userData = JSON.parse(userDataString);
        const currentUserID = userData.id;
        
        const response = await fetch(`/api/anime/${ANIME_ID_GLOBAL}/reviews`);
        if (response.ok) {
            const allReviews = await response.json();
            const userReview = allReviews.find(review => review.user_id === currentUserID);
            updateUserReviewUI(userReview);
        } else {
            const errorData = await response.json();
            updateUserReviewUI(null, `Error al obtener reviews: ${errorData.msg}`);
        }
    } catch (error) {
        updateUserReviewUI(null, 'Error de conexión al verificar tu review.');
    }
}

function updateUserReviewUI(reviewData, errorMessage = null) {
    if (!currentUserReviewDisplay || !animeReviewForm || !reviewActionMessage || !deleteReviewBtn || !saveReviewBtn || !reviewTextarea || !reviewRatingInput || !reviewSpoilerCheckbox) return;
    reviewActionMessage.style.display = 'none';
    const userReviewTitle = document.getElementById('user-review-title');

    if (errorMessage) {
        currentUserReviewDisplay.innerHTML = `<p class="no-status">${errorMessage}</p>`;
        animeReviewForm.reset();
        if (userReviewTitle) userReviewTitle.textContent = 'Tu Review';
        deleteReviewBtn.style.display = 'none';
        saveReviewBtn.textContent = 'Guardar Review';
        animeReviewForm.removeAttribute('data-existing-review-id');
        return;
    }
    if (reviewData) {
        currentUserReviewDisplay.innerHTML = `<h4>Tu review actual:</h4><p class="user-review-text" style="white-space: pre-wrap; background-color: #f0f1f3; padding: 10px; border-radius: 5px;">${reviewData.review_text}</p>${reviewData.rating_given !== null ? `<small>Tu nota asociada: ${reviewData.rating_given}/10</small><br>` : ''}<small>Spoiler: ${reviewData.is_spoiler ? 'Sí' : 'No'}</small>`;
        currentUserReviewDisplay.style.display = 'block';
        reviewTextarea.value = reviewData.review_text;
        reviewRatingInput.value = reviewData.rating_given || '';
        reviewSpoilerCheckbox.checked = reviewData.is_spoiler;
        if (userReviewTitle) userReviewTitle.textContent = 'Editar Tu Review';
        saveReviewBtn.textContent = 'Actualizar Review';
        deleteReviewBtn.style.display = 'inline-block';
        deleteReviewBtn.dataset.reviewId = reviewData.id;
        animeReviewForm.dataset.existingReviewId = reviewData.id;
    } else {
        currentUserReviewDisplay.innerHTML = '';
        currentUserReviewDisplay.style.display = 'none';
        animeReviewForm.reset();
        if (userReviewTitle) userReviewTitle.textContent = 'Escribe Tu Review';
        saveReviewBtn.textContent = 'Guardar Review';
        deleteReviewBtn.style.display = 'none';
        animeReviewForm.removeAttribute('data-existing-review-id');
    }
}

function showReviewActionMessage(message, isSuccess = true) {
    if (!reviewActionMessage) return;
    reviewActionMessage.textContent = message;
    reviewActionMessage.className = `review-action-message ${isSuccess ? 'success' : 'error'}`;
    reviewActionMessage.style.display = 'block';
    setTimeout(() => { reviewActionMessage.style.display = 'none'; }, 3000);
}

// --- Funciones para Reviews de Otros Usuarios ---
function displayOtherUsersReviews(reviews) {
    if (!allReviewsListContainer) return;
    allReviewsListContainer.innerHTML = '';
    if (!reviews || reviews.length === 0) {
        allReviewsListContainer.innerHTML = '<p class="no-results-placeholder">Aún no hay reviews para este anime. ¡Sé el primero!</p>';
        return;
    }
    reviews.forEach(review => {
        const reviewElement = document.createElement('div');
        reviewElement.className = 'user-review-item';
        const reviewDate = new Date(review.updated_at || review.created_at).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
        // Escapar HTML en review.review_text para seguridad básica
        const escapedReviewText = review.review_text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        reviewElement.innerHTML = `
            <div class="review-author-info">
                <strong class="review-username">${review.username || 'Anónimo'}</strong> 
                <span class="review-date">(${reviewDate})</span>
            </div>
            ${review.rating_given ? `<div class="review-rating-given">Puntuación: ${review.rating_given}/10</div>` : ''}
            ${review.is_spoiler ? '<p class="review-spoiler-warning">¡Contiene spoilers!</p>' : ''}
            <p class="review-text-content">${escapedReviewText.replace(/\n/g, '<br>')}</p>`;
        allReviewsListContainer.appendChild(reviewElement);
    });
}

async function loadAndDisplayOtherUserReviews() {
    if (!allReviewsListContainer) return;
    showLoadingInSection('anime-reviews-list', 'Actualizando reviews...');
    try {
        const response = await fetch(`/api/anime/${ANIME_ID_GLOBAL}/reviews`);
        if (response.ok) {
            const reviews = await response.json();
            displayOtherUsersReviews(reviews);
        } else { displayErrorInSection('anime-reviews-list', 'No se pudieron recargar las reviews.'); }
    } catch (e) { displayErrorInSection('anime-reviews-list', 'Error de red al recargar reviews.'); }
}

// --- Funciones para Sliders Horizontales (Asegúrate que estas funciones estén definidas) ---
function displayCharacters(characterData) {
    const slider = document.getElementById('characters-slider');
    if (!slider) return;
    slider.innerHTML = ''; 

    if (!characterData || characterData.length === 0) {
        displayErrorInSection('characters-slider', 'No se encontró información de personajes.');
        return;
    }
    characterData.slice(0, 16).forEach(item => {
        const character = item.character;
        const va = item.voice_actors?.find(v => v.language === 'Japanese') || item.voice_actors?.find(v => v.language === 'English');
        const card = document.createElement('div');
        card.className = 'character-card scroll-item';
        card.innerHTML = `
            <div class="card-col character-img-col"><img src="${character.images?.jpg?.image_url || './img/placeholder-char.png'}" alt="${character.name}" loading="lazy" onerror="this.src='./img/placeholder-char.png'"></div>
            <div class="card-col character-info-col"><span class="character-name">${character.name}</span><span class="character-role">${item.role}</span></div>
            ${va ? `<div class="card-col va-info-col"><span class="va-name">${va.person.name}</span><span class="va-lang">(${va.language})</span></div><div class="card-col va-img-col"><img src="${va.person.images?.jpg?.image_url || './img/placeholder-va.png'}" alt="${va.person.name}" loading="lazy" onerror="this.src='./img/placeholder-va.png'"></div>` : `<div class="card-col va-info-col"></div> <div class="card-col va-img-col"></div> `}
        `;
        slider.appendChild(card);
    });
}

function displayStaff(staffData) {
    const slider = document.getElementById('staff-slider');
    if (!slider) return;
    slider.innerHTML = '';

    if (!staffData || staffData.length === 0) {
         displayErrorInSection('staff-slider', 'No se encontró información del staff.');
        return;
    }
     const mainRoles = ['Director', 'Original Creator', 'Series Composition', 'Script', 'Music', 'Character Design', 'Art Director', 'Sound Director'];
     const filteredStaff = staffData.filter(s => s.positions.some(p => mainRoles.includes(p))).slice(0, 12);
    if (filteredStaff.length === 0) {
        displayErrorInSection('staff-slider', 'No se encontró staff principal.');
        return;
     }
    filteredStaff.forEach(item => {
        const person = item.person;
        const card = document.createElement('div');
        card.className = 'staff-card scroll-item';
        card.innerHTML = `
             <div class="staff-img"><img src="${person.images?.jpg?.image_url || './img/placeholder-staff.png'}" alt="${person.name}" loading="lazy" onerror="this.src='./img/placeholder-staff.png'"></div>
             <div class="staff-info"><span class="staff-name">${person.name}</span><span class="staff-role">${item.positions.join(', ')}</span></div>
        `;
        slider.appendChild(card);
    });
}

function displayRecommendations(recommendationsData) {
    const slider = document.getElementById('recommendations-slider');
    if (!slider) return;
    slider.innerHTML = '';

    if (!recommendationsData || recommendationsData.length === 0) {
        displayErrorInSection('recommendations-slider', 'No hay recomendaciones disponibles.');
        return;
    }
    recommendationsData.forEach(rec => {
        const anime = rec.entry;
        if (!anime?.mal_id || !anime.title) return;
        const card = document.createElement('div');
        card.className = 'anime-card recommendation-card scroll-item';
        card.dataset.id = anime.mal_id;
        const imageUrl = anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || './img/placeholder-rec.png';
        card.innerHTML = `
            <img src="${imageUrl}" alt="${anime.title}" class="anime-card-img rec-img" loading="lazy" onerror="this.onerror=null; this.src='./img/placeholder-rec.png';">
            <div class="rec-content"> {/* Corregido: Quitar clase card-content si no existe y usar solo rec-content */}
                <div class="anime-name rec-name">${anime.title}</div>
                ${rec.votes ? `<div class="rec-votes">${rec.votes} recomendaciones</div>` : ''}
            </div>
          `;
        card.addEventListener('click', function() {
            window.location.href = `detalle.html?id=${this.dataset.id}`;
        });
        slider.appendChild(card);
    });
}


// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    loadAnimeDetails(); // Carga principal

    // Event listener para el botón de gestionar lista
    if (manageListButton && userAnimeStatusSection && animeListForm) {
        manageListButton.addEventListener('click', () => {
            if (localStorage.getItem('accessToken')) {
                if (userAnimeStatusSection.style.display === 'block') { // Asegurarse que la sección está visible
                    // Toggle para el formulario dentro de la sección
                    animeListForm.style.display = animeListForm.style.display === 'none' ? 'block' : 'none';
                }
            } else {
                alert("Debes iniciar sesión para gestionar tu lista.");
                // Aquí podrías llamar a la función que abre el modal de login desde auth.js si la tienes global
                // Ejemplo: if (typeof openLoginModalFunctionGlobal !== 'undefined') openLoginModalFunctionGlobal();
            }
        });
    }

    // Event listener para el formulario de la lista de anime
    if (animeListForm) {
        animeListForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const token = localStorage.getItem('accessToken');
            if (!token) { showListActionMessage('Debes iniciar sesión.', false); return; }
            const formData = new FormData(animeListForm);
            const data = {
                anime_mal_id: parseInt(ANIME_ID_GLOBAL),
                status: formData.get('status'),
                score: listScoreInput.value ? parseInt(listScoreInput.value) : null,
                episodes_watched: listEpisodesInput.value ? parseInt(listEpisodesInput.value) : null
            };
            let method = 'POST'; let url = `/api/me/animelist`;
            const existingEntryResponse = await fetch(`/api/me/animelist/${ANIME_ID_GLOBAL}`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (existingEntryResponse.ok) { method = 'PUT'; url = `/api/me/animelist/${ANIME_ID_GLOBAL}`; }
            try {
                const response = await fetch(url, { method: method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(data) });
                const responseData = await response.json();
                if (response.ok) {
                    showListActionMessage(method === 'POST' ? 'Anime añadido.' : 'Lista actualizada.', true);
                    updateUserAnimeListUI(responseData);
                } else { showListActionMessage(responseData.msg || 'Error al guardar.', false); }
            } catch (error) { showListActionMessage('Error de conexión al guardar.', false); }
        });
    }

    // Event listener para el botón de quitar de la lista
    if (removeFromListBtn) {
        removeFromListBtn.addEventListener('click', async () => {
            const token = localStorage.getItem('accessToken');
            if (!token) { showListActionMessage('Debes iniciar sesión.', false); return; }
            if (!confirm('¿Eliminar este anime de tu lista?')) return;
            try {
                const response = await fetch(`/api/me/animelist/${ANIME_ID_GLOBAL}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
                const responseData = await response.json();
                if (response.ok) {
                    showListActionMessage('Anime eliminado de tu lista.', true);
                    updateUserAnimeListUI(null);
                } else { showListActionMessage(responseData.msg || 'Error al eliminar.', false); }
            } catch (error) { showListActionMessage('Error de conexión al eliminar.', false); }
        });
    }

    // Event listener para el formulario de review
    if (animeReviewForm) {
        animeReviewForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const token = localStorage.getItem('accessToken');
            if (!token) { showReviewActionMessage('Debes iniciar sesión para reseñar.', false); return; }
            const reviewText = reviewTextarea.value;
            const ratingGiven = reviewRatingInput.value ? parseInt(reviewRatingInput.value) : null;
            const isSpoiler = reviewSpoilerCheckbox.checked;
            if (!reviewText.trim()) { showReviewActionMessage('La review no puede estar vacía.', false); return; }
            const payload = { review_text: reviewText, rating_given: ratingGiven, is_spoiler: isSpoiler };
            let method = 'POST'; let url = `/api/anime/${ANIME_ID_GLOBAL}/reviews`;
            const existingReviewId = animeReviewForm.dataset.existingReviewId;
            if (existingReviewId) { method = 'PUT'; url = `/api/reviews/${existingReviewId}`; }
            try {
                const response = await fetch(url, { method: method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(payload) });
                const responseData = await response.json();
                if (response.ok) {
                    showReviewActionMessage(method === 'POST' ? 'Review creada.' : 'Review actualizada.', true);
                    updateUserReviewUI(responseData);
                    loadAndDisplayOtherUserReviews(); 
                } else { showReviewActionMessage(responseData.msg || 'Error al guardar review.', false); }
            } catch (error) { showReviewActionMessage('Error de conexión al guardar review.', false); }
        });
    }

    // Event listener para el botón de eliminar review
    if (deleteReviewBtn) {
        deleteReviewBtn.addEventListener('click', async () => {
            const token = localStorage.getItem('accessToken');
            const reviewId = deleteReviewBtn.dataset.reviewId;
            if (!token || !reviewId) { showReviewActionMessage('No se puede eliminar.', false); return; }
            if (!confirm('¿Eliminar tu review?')) return;
            try {
                const response = await fetch(`/api/reviews/${reviewId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
                const responseData = await response.json();
                if (response.ok) {
                    showReviewActionMessage('Review eliminada.', true);
                    updateUserReviewUI(null);
                    loadAndDisplayOtherUserReviews();
                } else { showReviewActionMessage(responseData.msg || 'Error al eliminar review.', false); }
            } catch (error) { showReviewActionMessage('Error de conexión al eliminar review.', false); }
        });
    }
});

// --- Helpers Adicionales ---
function setTextContent(elementId, text) { const element = document.getElementById(elementId); if (element) { element.textContent = text ?? 'N/A'; } else { console.warn(`Elemento ID '${elementId}' no encontrado.`); } }
function safeSetHTML(elementId, html) { const element = document.getElementById(elementId); if (element) { element.innerHTML = html ?? ''; } else { console.warn(`Elemento ID '${elementId}' no encontrado.`); } }
function formatNumber(num) { const number = Number(num); if (isNaN(number)) return 'N/A'; return new Intl.NumberFormat('de-DE').format(number); }
function showLoadingInSection(containerId, message) { const container = document.getElementById(containerId); if (container) { container.innerHTML = `<p class="loading-placeholder">${message}</p>`; } }
function displayErrorInSection(containerId, message) { const container = document.getElementById(containerId); if (container) { container.innerHTML = `<p class="error-placeholder">${message}</p>`; } }