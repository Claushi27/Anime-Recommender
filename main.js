// main.js - Script principal (CON PAGINACIÓN PARA EMOCIONES Y GÉNEROS)

// --- Importaciones ---
import {
  searchAnime,
  getPopularAnime,
  getSeasonalAnime,
  getAnimeDetails,
  getAnimeByGenre, // <-- Importa la versión modificada para paginación Jikan
  assignEmotions,
  getEmotionName,
  getEmotionColor,
  getRecommendationsByEmotion // <-- Importa la versión modificada para paginación Backend
} from './api.js';

// --- Elementos DOM ---
const searchBar = document.querySelector('.search-bar input');
const animeSlideContainer = document.querySelector('.anime-slide .anime');
const animeCardsContainer = document.querySelector('.anime-cards');
const animeTypes = document.querySelectorAll('.anime-type');
const filterButton = document.querySelector('.filter-button');
const emotionCategories = document.querySelectorAll('.emotion');
const slideLoading = document.getElementById('slide-loading');
const cardsLoading = document.getElementById('cards-loading');
const paginationControlsContainer = document.getElementById('pagination-controls');

// --- Variables de Estado para Paginación ---
let currentFilterType = null; // 'emotion' o 'genre'
let currentEmotionPage = 1;
let totalEmotionPages = 0;
let currentEmotionTag = null;

let currentGenrePage = 1;
let totalGenrePages = 0;
let currentGenreId = null;
let currentGenreName = null;

// --- Funciones de Carga ---
function showLoading(element, message = "Cargando...") {
  if (element) {
    element.textContent = message;
    element.classList.add('show');
  }
}
function hideLoading(element) {
  if (element) {
    element.classList.remove('show');
  }
}

// --- Inicializar App ---
async function initApp() {
  showLoading(slideLoading, "Cargando destacados...");
  showLoading(cardsLoading, "Cargando populares...");
  try {
    await Promise.all([
      loadFeaturedAnime(),
      loadPopularAnime()
    ]);
    setupEventListeners();
  } catch (error) {
    console.error('Error inicializando la aplicación:', error);
    showErrorMessage('Error cargando datos iniciales. Intenta recargar.');
  } finally {
      hideLoading(slideLoading);
      hideLoading(cardsLoading);
  }
}

// --- Cargar Slider (Usa Jikan) ---
async function loadFeaturedAnime() {
  try {
    const seasonalData = await getSeasonalAnime();
    if (seasonalData?.data) {
      updateAnimeSlide(seasonalData.data.slice(0, 5));
    } else {
       animeSlideContainer.innerHTML = '<p>No se encontraron animes destacados.</p>';
    }
  } catch (error) {
    console.error('Error cargando anime destacado (Jikan):', error);
    animeSlideContainer.innerHTML = '<p>Error al cargar destacados.</p>';
  } finally {
      hideLoading(slideLoading);
  }
}

// --- Actualizar Slider (Muestra datos Jikan) ---
function updateAnimeSlide(animes) {
  animeSlideContainer.innerHTML = '';
  if (!animes || animes.length === 0) {
      animeSlideContainer.innerHTML = '<p>No hay animes para mostrar en el slider.</p>';
      return;
  }
  animes.forEach(anime => {
    if (!anime?.mal_id || !anime.title || !anime.images?.jpg?.image_url) {
      console.warn('Datos Jikan incompletos para slider:', anime);
      return;
    }
    const emotions = assignEmotions(anime.genres);
    const emotion1 = emotions[0] || 'epic';
    const emotion2 = emotions[1] || null;
    const animeHTML = `
      <div class="anime-cell" data-id="${anime.mal_id}">
        <div class="anime-img"><img src="${anime.images.jpg.image_url}" alt="${anime.title}" class="anime-photo" loading="lazy"></div>
        <div class="anime-content">
          <div class="anime-title">${anime.title}</div>
          <div class="anime-studio">by ${anime.studios?.[0]?.name || 'Studio desconocido'}</div>
          <div class="rate">
            <span class="emotion-tag ${emotion1}">${getEmotionName(emotion1)}</span>
            ${emotion2 ? `<span class="emotion-tag ${emotion2}">${getEmotionName(emotion2)}</span>` : ''}
            <span class="anime-voters">${anime.score ? anime.score.toFixed(1) + '/10' : 'N/A'} ${anime.scored_by ? '(' + formatNumber(anime.scored_by) + ' votos)' : ''}</span>
          </div>
          <div class="anime-sum">${anime.synopsis ? truncateText(anime.synopsis, 150) : 'Sin descripción.'}</div>
          <div class="anime-see">Ver Detalles</div>
        </div>
      </div>`;
    animeSlideContainer.innerHTML += animeHTML;
  });
  animeSlideContainer.querySelectorAll('.anime-cell').forEach(cell => {
    cell.addEventListener('click', function() { handleShowDetails(this.dataset.id); });
  });
}

// --- Cargar Populares Iniciales (Usa Jikan) ---
async function loadPopularAnime() {
  try {
    // Llama a getPopularAnime (que usa /top/anime). La paginación aquí podría no funcionar
    // dependiendo de la API Jikan para este endpoint específico.
    const popularData = await getPopularAnime(20); // Pide los 20 más populares
    if (popularData?.data) {
      displayAnimeCards(popularData.data);
      // No mostramos controles de paginación aquí intencionadamente,
      // ya que es la carga inicial de "populares".
      // Si se quisiera paginar TODO desde el inicio, habría que llamar a handleGenreFilter('Todos', 1);
    } else {
      animeCardsContainer.innerHTML = '<div class="no-results">No se encontraron animes populares.</div>';
    }
  } catch (error) {
    console.error('Error cargando anime popular (Jikan):', error);
    animeCardsContainer.innerHTML = '<div class="no-results">Error al cargar populares.</div>';
  } finally {
      hideLoading(cardsLoading);
  }
}


// --- Mostrar Tarjetas ---
function displayAnimeCards(animes) {
  animeCardsContainer.innerHTML = '';
   if (!animes || animes.length === 0) {
      // El mensaje de "No hay resultados" se maneja ahora dentro de los handlers
      return;
  }
  animes.forEach(anime => {
    if (!anime?.mal_id || !anime.title) {
      console.warn('Datos insuficientes para mostrar tarjeta:', anime);
      return;
    }
    const emotionTags = anime.Emotions && Array.isArray(anime.Emotions) && anime.Emotions.length > 0
                        ? anime.Emotions
                        : (anime.genres ? assignEmotions(anime.genres) : ['epic', 'wonder']);
    const emotion1 = emotionTags[0] || 'epic';
    const emotion2 = emotionTags[1] || null;
    const imageUrl = anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || '';
    const synopsisText = anime.synopsis || 'Sin descripción.';
    const scoreValue = typeof anime.score === 'number' ? anime.score : parseFloat(anime.score);
    const scoreText = !isNaN(scoreValue) ? scoreValue.toFixed(1) + '/10' : 'N/A';
    const votersText = anime.scored_by ? '(' + formatNumber(anime.scored_by) + ' votos)' : '';
    const studioText = anime.studios?.[0]?.name || anime.studio || 'Studio desconocido';

    const animeCardHTML = `
      <div class="anime-card" data-id="${anime.mal_id}">
        <div class="content-wrapper">
          ${imageUrl ? `<img src="${imageUrl}" alt="${anime.title}" class="anime-card-img" loading="lazy">` : '<div class="anime-card-img" style="background:#eee; height:200px; display:flex; align-items:center; justify-content:center; color:#aaa;">Sin Imagen</div>'}
          <div class="card-content">
            <div class="anime-name">${anime.title}</div>
            <div class="anime-by">by ${studioText}</div>
            <span class="emotion-tag ${emotion1}">${getEmotionName(emotion1)}</span>
            ${emotion2 ? `<span class="emotion-tag ${emotion2}">${getEmotionName(emotion2)}</span>` : ''}
            <div class="anime-sum">${truncateText(synopsisText, 100)}</div>
          </div>
        </div>
        <div class="likes">
          <div class="like-name"><span>${scoreText}</span> ${votersText}</div>
        </div>
      </div>`;
    animeCardsContainer.innerHTML += animeCardHTML;
  });
  animeCardsContainer.querySelectorAll('.anime-card').forEach(card => {
    card.addEventListener('click', function() { handleShowDetails(this.dataset.id); });
  });
}


// --- Mostrar Controles de Paginación (CON MANEJO DE CONTEXTO) ---
function displayPaginationControls(paginationInfo, context) {
    const paginationContainer = document.getElementById('pagination-controls');
    if (!paginationContainer) return;
    paginationContainer.innerHTML = '';

    let currentPage, totalPages, hasNextPage = false; // Default hasNextPage to false

    // Adaptar estructura según el contexto (Jikan o Backend)
    if (context === 'genre' && paginationInfo?.pagination) {
        currentPage = paginationInfo.pagination.current_page;
        totalPages = paginationInfo.pagination.last_visible_page;
        hasNextPage = paginationInfo.pagination.has_next_page;
    } else if (context === 'emotion' && paginationInfo) {
        currentPage = paginationInfo.current_page;
        totalPages = paginationInfo.total_pages;
        // Nuestro backend no envía 'has_next_page', lo calculamos
        hasNextPage = currentPage < totalPages;
    } else {
         // Si la estructura no es válida o no hay suficientes páginas, salir.
        if (!paginationInfo || (!paginationInfo.pagination?.last_visible_page && !paginationInfo.total_pages) || Math.max(paginationInfo.pagination?.last_visible_page || 0, paginationInfo.total_pages || 0) <= 1) {
             return;
        }
        console.warn("Estructura de paginación inesperada o inválida:", paginationInfo, "Contexto:", context);
        // Intentar un fallback si es posible, aunque puede ser erróneo
        currentPage = paginationInfo.current_page || paginationInfo.pagination?.current_page || 1;
        totalPages = paginationInfo.total_pages || paginationInfo.pagination?.last_visible_page || 1;
        hasNextPage = paginationInfo.pagination?.has_next_page || (currentPage < totalPages);
    }

    if (totalPages <= 1) return; // Salir si solo hay una página

    // Botón Anterior
    const prevButton = document.createElement('button');
    prevButton.textContent = '‹ Anterior';
    prevButton.disabled = currentPage === 1;
    prevButton.classList.add('pagination-button', 'prev');
    prevButton.addEventListener('click', () => {
        if (context === 'emotion' && currentEmotionTag) {
            handleEmotionFilter([currentEmotionTag], currentPage - 1);
        } else if (context === 'genre' && currentGenreName !== null) { // Usar nombre guardado
            handleGenreFilter(currentGenreName, currentPage - 1);
        }
    });
    paginationContainer.appendChild(prevButton);

    // Indicador de página
    const pageIndicator = document.createElement('span');
    pageIndicator.textContent = `Página ${currentPage} de ${totalPages}`;
    pageIndicator.classList.add('page-indicator');
    paginationContainer.appendChild(pageIndicator);

    // Botón Siguiente
    const nextButton = document.createElement('button');
    nextButton.textContent = 'Siguiente ›';
    // Deshabilitar si es la última página O si Jikan explícitamente dice que no hay siguiente
    nextButton.disabled = currentPage === totalPages || !hasNextPage;
    nextButton.classList.add('pagination-button', 'next');
    nextButton.addEventListener('click', () => {
         if (context === 'emotion' && currentEmotionTag) {
            handleEmotionFilter([currentEmotionTag], currentPage + 1);
        } else if (context === 'genre' && currentGenreName !== null) { // Usar nombre guardado
            handleGenreFilter(currentGenreName, currentPage + 1);
        }
    });
    paginationContainer.appendChild(nextButton);
}


// --- Redirigir a Detalles ---
function handleShowDetails(animeId) {
  if (!animeId) { console.error("ID no proporcionado"); showErrorMessage("Error al ver detalles."); return; }
  console.log(`Redirigiendo a detalle.html con ID: ${animeId}`);
  window.location.href = `detalle.html?id=${animeId}`;
}

// --- Setup Event Listeners (CON LIMPIEZA GENERAL) ---
function setupEventListeners() {
  // Buscador
  searchBar.addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && this.value.trim()) {
        clearPaginationState(); // <--- Limpieza General
        handleSearch(this.value.trim());
    }
  });
  // Filtro por tipo de anime (géneros)
  animeTypes.forEach(type => {
    type.addEventListener('click', function(e) {
      e.preventDefault();
      document.querySelector('.anime-type.active')?.classList.remove('active');
      this.classList.add('active');
      clearPaginationState(); // <--- Limpieza General
      handleGenreFilter(this.textContent, 1); // Ir a página 1 del género
    });
  });
  // Filtro por emoción (Botón)
  filterButton.addEventListener('click', function() {
    const selectedEmotionTags = Array.from(document.querySelectorAll('.emotion.selected'))
                                     .map(el => el.dataset.emotionTag)
                                     .filter(tag => tag);
    if (selectedEmotionTags.length > 0) {
      clearPaginationState(); // <--- Limpieza General
      handleEmotionFilter(selectedEmotionTags, 1); // Ir a página 1 de la emoción
    } else {
      showErrorMessage('Selecciona al menos una emoción para filtrar.');
    }
  });
  // Seleccionar/Deseleccionar emociones
  emotionCategories.forEach(emotion => {
    emotion.addEventListener('click', function() { this.classList.toggle('selected'); });
  });
}

// --- Limpiar estado de paginación (GENERALIZADO) ---
function clearPaginationState() {
    currentFilterType = null;
    currentEmotionPage = 1;
    totalEmotionPages = 0;
    currentEmotionTag = null;
    currentGenrePage = 1;
    totalGenrePages = 0;
    currentGenreId = null;
    currentGenreName = null;
    if (paginationControlsContainer) paginationControlsContainer.innerHTML = '';
}

// --- Búsqueda (Usa Jikan) ---
async function handleSearch(query) {
  // No necesita paginación aquí generalmente, muestra top results
  clearPaginationState(); // Limpiar por si acaso
  showLoading(cardsLoading, `Buscando "${query}"...`);
  animeCardsContainer.innerHTML = '';
  if (paginationControlsContainer) paginationControlsContainer.innerHTML = ''; // Limpiar controles
  try {
    const results = await searchAnime(query);
    if (results?.data?.length > 0) {
      displayAnimeCards(results.data);
    } else {
      animeCardsContainer.innerHTML = `<div class="no-results">No se encontraron resultados para "${query}"</div>`;
    }
  } catch (error) {
    console.error('Error en la búsqueda (Jikan):', error);
    showErrorMessage(`Error al buscar "${query}". Intenta de nuevo.`);
    animeCardsContainer.innerHTML = `<div class="no-results">Error al realizar la búsqueda.</div>`;
  } finally {
      hideLoading(cardsLoading);
  }
}

// --- Filtro Género (Usa Jikan - CON PAGINACIÓN) ---
async function handleGenreFilter(genreName, page = 1) {
    currentFilterType = 'genre';
    currentGenrePage = page;
    currentGenreName = genreName; // Guardar nombre para usar en botones de paginación

    showLoading(cardsLoading, `Cargando ${genreName} (Pág. ${page})...`);
    animeCardsContainer.innerHTML = '';
    if (paginationControlsContainer) paginationControlsContainer.innerHTML = ''; // Limpiar controles

    const genreMap = { 'Todos': 0, 'Acción': 1, 'Drama': 8, 'Romance': 22, 'Comedia': 4, 'Fantasía': 10 };
    const genreId = genreMap[genreName];
    currentGenreId = genreId; // Guardar ID (puede ser undefined para "Todos")

    try {
        let responseData;
        if (genreName === 'Todos') {
            // Para "Todos", usamos /anime sin filtro de género, ordenado por popularidad
            const url = `${JIKAN_BASE_URL}/anime?order_by=popularity&sort=asc&limit=20&page=${page}`;
            console.log(`Fetching from Jikan (All Genres - Popular): ${url}`);
            responseData = await delayedFetch(url); // Usamos delayedFetch directamente
        } else if (genreId !== undefined) {
             // Para géneros específicos, usamos getAnimeByGenre (que ya incluye page)
            responseData = await getAnimeByGenre(genreId, 20, page);
        } else {
             // Género no mapeado, mostrar error o populares sin paginación?
             console.warn(`Género "${genreName}" no mapeado.`);
             showErrorMessage(`Género "${genreName}" no reconocido.`);
             responseData = await getPopularAnime(20); // Cargar populares sin paginar como fallback
             // Limpiar estado de paginación en este caso
             clearPaginationState();
        }

        // Procesar la respuesta (puede tener 'data' y 'pagination')
        if (responseData && responseData.data && responseData.pagination) {
            const animeList = responseData.data;
            const paginationInfo = responseData; // Jikan devuelve el objeto completo

            totalGenrePages = paginationInfo.pagination.last_visible_page; // Actualizar total

            if (animeList.length > 0) {
              displayAnimeCards(animeList);
              displayPaginationControls(paginationInfo, 'genre'); // <-- Contexto 'genre'
            } else {
                 if (page === 1) {
                    animeCardsContainer.innerHTML = `<div class="no-results">No se encontraron animes para ${genreName}.</div>`;
                 } else {
                     animeCardsContainer.innerHTML = `<div class="no-results">No hay más resultados para mostrar (Pág. ${page}) para ${genreName}.</div>`;
                     displayPaginationControls(paginationInfo, 'genre');
                 }
            }
        } else if (responseData && responseData.data && !responseData.pagination && page === 1) {
            // Caso especial: Respuesta sin paginación (quizás fallback de populares)
             displayAnimeCards(responseData.data);
             console.warn("Respuesta procesada pero sin información de paginación.");
        }
        else {
             throw new Error(`La respuesta de Jikan para ${genreName} no tiene el formato esperado.`);
        }
    } catch (error) {
        console.error(`Error filtrando por género ${genreName} (Pág. ${page}):`, error);
        showErrorMessage(`Error al filtrar por ${genreName}: ${error.message}`);
        animeCardsContainer.innerHTML = `<div class="no-results">Error al filtrar por género. <br><small>${error.message}</small></div>`;
        clearPaginationState();
    } finally {
        hideLoading(cardsLoading);
    }
}

// --- Filtro Emoción (Usa Backend - CON PAGINACIÓN Y CONTEXTO) ---
async function handleEmotionFilter(selectedTags, page = 1) {
    currentFilterType = 'emotion';
    const emotionTag = selectedTags[0];
    currentEmotionTag = emotionTag;
    currentEmotionPage = page;

    showLoading(cardsLoading, `Buscando animes (Pág. ${page}) con emoción: ${getEmotionName(emotionTag)}...`);
    animeCardsContainer.innerHTML = '';
    if (paginationControlsContainer) paginationControlsContainer.innerHTML = '';
    console.log(`Usando API local para buscar emoción: ${emotionTag}, Página: ${page}`);

    try {
        const responseData = await getRecommendationsByEmotion(emotionTag, page, 20); // Llama a api.js

        if (responseData && responseData.recommendations && responseData.pagination) {
            const recommendations = responseData.recommendations;
            const paginationInfo = responseData.pagination; // Usamos la info del backend

            totalEmotionPages = paginationInfo.total_pages; // Actualizar total

            if (recommendations.length > 0) {
                 const mappedRecommendations = recommendations.map(anime_backend => {
                    return {
                        mal_id: anime_backend.mal_id, title: anime_backend.title,
                        images: { jpg: { image_url: anime_backend.thumbnailURL || anime_backend.Image_URL || '', large_image_url: anime_backend.Image_URL || anime_backend.thumbnailURL || ''}},
                        studios: [], studio: 'Desconocido',
                        genres: anime_backend.genre ? anime_backend.genre.split(',').map(g=>({name: g.trim()})) : [],
                        score: anime_backend.rating, scored_by: null,
                        synopsis: anime_backend.Synopsis || 'Descripción no disponible.',
                        Emotions: anime_backend.Emotions ? anime_backend.Emotions.split(',') : []
                    };
                });
                displayAnimeCards(mappedRecommendations);
                displayPaginationControls(paginationInfo, 'emotion'); // <-- Contexto 'emotion'
            } else {
                 if (page === 1) {
                    animeCardsContainer.innerHTML = `<div class="no-results">No se encontraron animes para la emoción: ${getEmotionName(emotionTag)}.</div>`;
                 } else {
                     animeCardsContainer.innerHTML = `<div class="no-results">No hay más resultados para mostrar (Pág. ${page}).</div>`;
                     displayPaginationControls(paginationInfo, 'emotion');
                 }
            }
        } else {
             throw new Error("La respuesta del backend no tiene el formato esperado.");
        }
    } catch (error) {
        console.error('Error al obtener/procesar recomendaciones del backend (Pág. ${page}):', error);
        showErrorMessage(`Error al buscar por emoción: ${error.message}`);
        animeCardsContainer.innerHTML = `<div class="no-results">Ocurrió un error al buscar recomendaciones. <br><small>${error.message}</small></div>`;
        clearPaginationState();
    } finally {
        hideLoading(cardsLoading);
    }
}

// --- Funciones Auxiliares ---
function showErrorMessage(message) {
  const existingError = document.querySelector('.error-message');
  if (existingError) { existingError.remove(); }
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.textContent = message;
  document.body.insertAdjacentElement('beforeend', errorDiv);
  errorDiv.offsetHeight;
  errorDiv.classList.add('show');
  setTimeout(() => {
      errorDiv.classList.remove('show');
      errorDiv.addEventListener('transitionend', () => errorDiv.remove(), { once: true });
  }, 3500);
}

function truncateText(text, maxLength) {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

function formatNumber(num) {
  const number = Number(num);
  if (isNaN(number)) { return '0'; }
  return new Intl.NumberFormat('es-CL').format(number);
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// --- Iniciar la aplicación ---
document.addEventListener('DOMContentLoaded', initApp);