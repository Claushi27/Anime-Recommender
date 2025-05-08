// search.js - Lógica para la página de resultados de búsqueda (CON FILTROS Y TARJETAS UNIFICADAS)

// --- Importaciones ---
// Asegúrate que api.js exporta estas funciones
import {
  searchAnime,
  assignEmotions,
  getEmotionName,
  getEmotionColor // Necesaria para el tooltip
} from './api.js';

// --- Elementos DOM ---
const searchTermSpan = document.getElementById('search-term');
const resultsContainer = document.getElementById('search-results-cards');
const loadingIndicator = document.getElementById('search-loading');
const paginationContainer = document.getElementById('search-pagination-controls');
// Filtros
const filtersForm = document.getElementById('filters-form');
const filterTypeSelect = document.getElementById('filter-type');
const filterStatusSelect = document.getElementById('filter-status');
const filterRatingSelect = document.getElementById('filter-rating');
const filterGenreSelect = document.getElementById('filter-genre');
const filterOrderBySelect = document.getElementById('filter-order-by');
const filterSortSelect = document.getElementById('filter-sort');
const applyFiltersBtn = document.getElementById('apply-filters-btn');
// NUEVO: Elementos de la barra de búsqueda en la página
const searchInputOnResults = document.getElementById('search-input-on-results');
const updateSearchBtn = document.getElementById('update-search-btn');
const clearSearchTermBtn = document.getElementById('clear-search-term-btn');

// --- Variables de Estado ---
let currentSearchQuery = ''; // Query activa (puede cambiar)
let currentSearchPage = 1;
let currentFilters = {}; // Filtros activos

// --- Funciones Helper (Copiadas o adaptadas de main.js/api.js si no están en un archivo utils común) ---
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

function truncateText(text, maxLength) {
if (!text) return '';
return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

function formatNumber(num) {
const number = Number(num);
if (isNaN(number)) { return 'N/A'; }
// Usar formato local o uno consistente
return new Intl.NumberFormat('es-CL').format(number); // O 'de-DE' como en detalle.js
}

// Mensaje de error simple (opcional, si necesitas mostrar errores)
function showErrorMessage(message) {
 const existingError = document.querySelector('.error-message');
if (existingError) { existingError.remove(); }
const errorDiv = document.createElement('div');
errorDiv.className = 'error-message'; // Asegúrate que esta clase exista en tu CSS
errorDiv.textContent = message;
document.body.insertAdjacentElement('beforeend', errorDiv);
errorDiv.offsetHeight;
errorDiv.classList.add('show');
setTimeout(() => {
    errorDiv.classList.remove('show');
    errorDiv.addEventListener('transitionend', () => errorDiv.remove(), { once: true });
}, 3500);
}

// Navegación a detalles
function handleShowDetails(animeId) {
if (!animeId) {
    console.error("ID de anime no proporcionado para detalles.");
    showErrorMessage("Error interno: No se pudo obtener el ID para ver detalles.");
    return;
}
window.location.href = `detalle.html?id=${animeId}`;
}


// --- Función Principal para Cargar Resultados (Adaptada) ---
async function loadSearchResults(query, page = 1, filters = {}) {
// No necesitamos la condición restrictiva inicial. Jikan maneja query vacía si hay filtros.
currentSearchQuery = query || ""; // Guardar query actual (puede ser vacía)
currentSearchPage = page;
currentFilters = filters;

// Actualizar visualmente el término de búsqueda y el input
if(searchTermSpan) searchTermSpan.textContent = query || (Object.keys(filters).length > 0 ? "(Filtros Aplicados)" : "Todo");
if(searchInputOnResults) searchInputOnResults.value = query;


let loadingMessage = "Cargando";
if (query) loadingMessage += ` buscando "${decodeURIComponent(query)}"`;
if (Object.keys(filters).length > 0) loadingMessage += query ? ` con filtros aplicados` : ` resultados con filtros aplicados`;
loadingMessage += ` (Pág. ${page})...`;

showLoading(loadingIndicator, loadingMessage);
resultsContainer.innerHTML = '';
if (paginationContainer) paginationContainer.innerHTML = '';

try {
  console.log(`>>> Llamando a searchAnime con query: '${query}', page: ${page}, filters:`, filters);
  const responseData = await searchAnime(query, 20, page, filters); // 20 por página (ajusta si quieres)

  if (responseData?.data) {
    const animeList = responseData.data;
    const paginationInfo = responseData.pagination;

    if (animeList.length > 0) {
      displaySearchResults(animeList); // <--- LLAMA A LA NUEVA FUNCIÓN DE DISPLAY
      if (paginationInfo && paginationInfo.last_visible_page > 1) {
          displaySearchPagination(paginationInfo);
      } else {
           if (paginationContainer) paginationContainer.innerHTML = '';
      }
    } else {
      let noResultsMessage = "No se encontraron resultados";
      if (query) noResultsMessage += ` para "${decodeURIComponent(query)}"`;
      if (Object.keys(filters).length > 0) noResultsMessage += " con los filtros seleccionados";
      if (page > 1) noResultsMessage = `No hay más resultados (Pág. ${page})`;
      resultsContainer.innerHTML = `<div class="no-results">${noResultsMessage}.</div>`;
      if (page > 1 && paginationInfo) {
          displaySearchPagination(paginationInfo);
      }
    }
  } else {
    console.warn("Respuesta de Jikan sin 'data':", responseData);
    resultsContainer.innerHTML = `<div class="no-results">No se encontraron resultados o hubo un problema con la API.</div>`;
  }

} catch (error) {
  console.error(`Error en loadSearchResults (query: "${decodeURIComponent(query)}", page: ${page}, filters: ${JSON.stringify(filters)}):`, error);
  resultsContainer.innerHTML = `<div class="no-results">Error al cargar resultados.<br><small>${error.message}</small></div>`;
} finally {
  hideLoading(loadingIndicator);
}
}

// --- Leer los filtros seleccionados (sin cambios) ---
function getCurrentFilters() {
  const options = {};
  const type = filterTypeSelect?.value;
  const status = filterStatusSelect?.value;
  const rating = filterRatingSelect?.value;
  const genre = filterGenreSelect?.value;
  const orderBy = filterOrderBySelect?.value;
  const sort = filterSortSelect?.value;

  if (type) options.type = type;
  if (status) options.status = status;
  if (rating) options.rating = rating;
  if (genre) options.genres = genre;
  if (orderBy) options.order_by = orderBy;
  if (orderBy && sort) {
       options.sort = sort;
  } else if (orderBy && !sort) {
      options.sort = 'desc';
  }

  console.log("Filtros leídos:", options);
  return options;
}


// --- Mostrar Tarjetas de Resultados (¡REESCRITA PARA USAR TOOLTIPS!) ---
function displaySearchResults(animes) {
if (!resultsContainer) {
    console.error("Error: Contenedor de resultados no encontrado.");
    return;
}
resultsContainer.innerHTML = ''; // Limpiar contenido previo

if (!animes || animes.length === 0) {
    // El mensaje de "no resultados" se maneja en loadSearchResults
    return;
}

animes.forEach(anime => {
    if (!anime?.mal_id || !anime.title) {
        console.warn('Advertencia: Datos insuficientes para mostrar tarjeta, anime omitido:', anime);
        return;
    }

    // Obtener datos de la tarjeta
    const imageUrl = anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || './img/placeholder-card.png';
    const title = anime.title;
    const malId = anime.mal_id;

    const card = document.createElement('div');
    // USAR LAS MISMAS CLASES QUE EN main.js PARA APLICAR ESTILOS DE style.css
    card.className = 'anime-card';
    card.dataset.id = malId;

    // Contenido Visible (Imagen + Título Minimalista)
    const visibleContentHTML = `
        <div class="anime-card-visible-content">
            <img src="${imageUrl}"
                 alt="Portada de ${title}"
                 class="anime-card-img"
                 loading="lazy"
                 onerror="this.onerror=null; this.src='./img/placeholder-card.png';">
            <div class="anime-card-title-minimal">${truncateText(title, 35)}</div>
        </div>
    `;

    // Datos para el Tooltip (extraer de la data del anime de búsqueda)
    const scoreValue = parseFloat(anime.score);
    const scoreText = !isNaN(scoreValue) ? scoreValue.toFixed(1) : 'N/A';
    const typeText = anime.type || 'N/A';
    const episodesText = anime.episodes ? `${anime.episodes} ep.` : 'N/A ep.';
    let studioName = 'N/A';
    if (anime.studios && Array.isArray(anime.studios) && anime.studios.length > 0) {
        studioName = anime.studios[0]?.name || 'N/A';
    }
    const genres = anime.genres || []; // Jikan search devuelve genres
    const synopsis = anime.synopsis || '';
    const synopsisShort = truncateText(synopsis, 90) || 'Sin descripción.';

    const genresHTML = genres.slice(0, 3)
                             .map(g => g ? `<span class="tag genre-tag">${g.name}</span>` : '')
                             .join('');

    // Obtener/Asignar Emociones desde los géneros devueltos por Jikan
    let emotionsHTML = '';
    if (genres.length > 0) {
        const emotions = assignEmotions(genres); // Usar helper importado
        emotionsHTML = emotions.slice(0, 2)
                               .map(e => `<span class="tag emotion-tag ${getEmotionColor(e)}">${getEmotionName(e)}</span>`)
                               .join('');
    }

    // Contenido Oculto (Tooltip)
    const tooltipHTML = `
        <div class="anime-card-tooltip">
            <h4 class="tooltip-title">${truncateText(title, 50)}</h4>
            ${scoreText !== 'N/A' ? `<div class="tooltip-score"><i class="fas fa-star"></i> ${scoreText}</div>` : ''}
            <p class="tooltip-info">
                ${typeText !== 'N/A' ? `<span>${typeText}</span>` : ''}
                ${episodesText !== 'N/A ep.' ? `<span>${episodesText}</span>` : ''}
                ${studioName !== 'N/A' ? `<span>${studioName}</span>` : ''}
            </p>
            ${genresHTML ? `<div class="tooltip-genres">${genresHTML}</div>` : ''}
            <p class="tooltip-synopsis">${synopsisShort}</p>
            ${emotionsHTML ? `<div class="tooltip-emotions">${emotionsHTML}</div>` : ''}
        </div>
    `;

    card.innerHTML = visibleContentHTML + tooltipHTML;
    // Añadir listener para clic (usa la función handleShowDetails)
    card.addEventListener('click', function() {
        handleShowDetails(this.dataset.id);
    });

    resultsContainer.appendChild(card);
});
}


// --- Mostrar Paginación de Búsqueda (sin cambios necesarios aquí) ---
function displaySearchPagination(paginationInfoJikan) {
  if (!paginationContainer || !paginationInfoJikan || !paginationInfoJikan.last_visible_page || paginationInfoJikan.last_visible_page <= 1) {
    if (paginationContainer) paginationContainer.innerHTML = '';
    return;
  }
  paginationContainer.innerHTML = '';

  const currentPage = paginationInfoJikan.current_page;
  const totalPages = paginationInfoJikan.last_visible_page;
  const hasNextPage = paginationInfoJikan.has_next_page;

  // Botón Anterior
  const prevButton = document.createElement('button');
  prevButton.textContent = '‹ Anterior';
  prevButton.disabled = currentPage === 1;
  prevButton.classList.add('pagination-button', 'prev');
  prevButton.addEventListener('click', () => {
      // Usar la query actual del INPUT y filtros guardados
       const queryFromInput = searchInputOnResults ? searchInputOnResults.value.trim() : currentSearchQuery;
      loadSearchResults(queryFromInput, currentPage - 1, currentFilters);
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
  nextButton.disabled = !hasNextPage;
  nextButton.classList.add('pagination-button', 'next');
  nextButton.addEventListener('click', () => {
      // Usar la query actual del INPUT y filtros guardados
      const queryFromInput = searchInputOnResults ? searchInputOnResults.value.trim() : currentSearchQuery;
      loadSearchResults(queryFromInput, currentPage + 1, currentFilters);
  });
  paginationContainer.appendChild(nextButton);
}


// --- Lógica Principal al Cargar la Página ---
document.addEventListener('DOMContentLoaded', () => {
const urlParams = new URLSearchParams(window.location.search);
const query = urlParams.get('q'); // 'q' es el nombre del parámetro

// 1. Establecer estado inicial y cargar resultados si hay query
if (query) {
  const decodedQuery = decodeURIComponent(query);
  // Guardar como query inicial
  currentSearchQuery = decodedQuery;
  // Poblar el span y el nuevo input
  if(searchTermSpan) searchTermSpan.textContent = decodedQuery;
  if(searchInputOnResults) searchInputOnResults.value = decodedQuery;
  // Cargar resultados iniciales (página 1, sin filtros)
  loadSearchResults(decodedQuery, 1, {});
} else {
  // Si no hay query inicial en la URL
  if(searchTermSpan) searchTermSpan.textContent = "Ninguno (Usa filtros o busca)";
  if(searchInputOnResults) searchInputOnResults.value = "";
  resultsContainer.innerHTML = '<div class="no-results">Ingresa un término en la barra superior o aplica filtros para ver resultados.</div>';
  // No llamamos a loadSearchResults aquí, esperamos acción del usuario
}

// 2. Listener para el botón APLICAR FILTROS
if (applyFiltersBtn) {
    applyFiltersBtn.addEventListener('click', () => {
        const filters = getCurrentFilters(); // Obtener filtros seleccionados
        // Obtener la query ACTUAL del input de la página
        const queryToUse = searchInputOnResults ? searchInputOnResults.value.trim() : currentSearchQuery;
        loadSearchResults(queryToUse, 1, filters); // Recargar desde página 1
    });
} else {
    console.error("Botón 'Aplicar Filtros' no encontrado.");
}

// 3. Listeners para la NUEVA BARRA DE BÚSQUEDA EN LA PÁGINA
// Botón "Buscar"
if (updateSearchBtn && searchInputOnResults) {
      updateSearchBtn.addEventListener('click', () => {
          const newQuery = searchInputOnResults.value.trim();
          currentFilters = getCurrentFilters(); // Asegurarse de usar los filtros actuales si se presiona buscar
          loadSearchResults(newQuery, 1, currentFilters); // Iniciar búsqueda con nueva query, pag 1, filtros actuales
      });
      // También buscar al presionar Enter en el input
      searchInputOnResults.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
              updateSearchBtn.click(); // Simular clic en el botón buscar
          }
      });
} else {
     console.error("Elementos de la nueva barra de búsqueda (input/botón buscar) no encontrados.");
}

// Botón "X" (Limpiar)
if (clearSearchTermBtn && searchInputOnResults) {
    clearSearchTermBtn.addEventListener('click', () => {
        searchInputOnResults.value = ""; // Limpiar input
        currentFilters = getCurrentFilters(); // Obtener filtros actuales
        loadSearchResults("", 1, currentFilters); // Buscar con query vacía, pag 1, filtros actuales
    });
} else {
      console.error("Botón 'Limpiar Búsqueda' no encontrado.");
}

// Añadir estilos necesarios para el tooltip si no están en style.css global
// (Es mejor tenerlos en style.css, pero como fallback)
const fallbackTooltipStyles = document.createElement('style');
fallbackTooltipStyles.textContent = `
  .anime-card { position: relative; overflow: visible; } /* Necesario para tooltip */
  .anime-card-tooltip { /* Estilos básicos del tooltip */
      position: absolute; bottom: calc(100% + 8px); left: 50%; transform: translateX(-50%) scale(0.95) translateY(5px);
      width: 280px; max-width: calc(100% + 40px); background-color: rgba(30, 30, 35, 0.97); color: var(--white);
      border-radius: var(--border-radius-small); box-shadow: 0 8px 25px rgba(0,0,0,0.3); padding: 15px;
      z-index: 20; opacity: 0; visibility: hidden;
      transition: opacity 0.25s ease-out, transform 0.25s ease-out, visibility 0s 0.25s;
      pointer-events: none; font-size: 0.9rem;
  }
  .anime-card:hover .anime-card-tooltip { opacity: 1; visibility: visible; transform: translateX(-50%) scale(1) translateY(0); transition-delay: 0s; }
  /* ... (otros estilos internos del tooltip si es necesario) ... */
  .anime-card-tooltip .tooltip-title { font-size: 1.1em; font-weight: 700; color: var(--white); margin: 0 0 10px 0; line-height: 1.3; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px; }
  .anime-card-tooltip .tooltip-score { font-size: 1em; font-weight: bold; color: #FFD700; margin-bottom: 10px; display: flex; align-items: center; gap: 6px; }
  .anime-card-tooltip .tooltip-score i { font-size: 0.9em; }
  .anime-card-tooltip .tooltip-info { font-size: 0.85em; color: rgba(255, 255, 255, 0.85); margin-bottom: 12px; line-height: 1.5; }
  .anime-card-tooltip .tooltip-info span { margin-right: 4px; }
  .anime-card-tooltip .tooltip-info span:not(:last-child)::after { content: "•"; margin-left: 4px; opacity: 0.7; }
  .anime-card-tooltip .tooltip-genres, .anime-card-tooltip .tooltip-emotions { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
  .anime-card-tooltip .tag { font-size: 0.75em; padding: 4px 9px; border-radius: 12px; line-height: 1; font-weight: 500; }
  .anime-card-tooltip .genre-tag { background-color: rgba(255, 255, 255, 0.15); color: rgba(255, 255, 255, 0.9); }
  /* Colores de emociones (asegúrate que .emotion-tag y sus colores estén definidos en style.css o styles-additional.css) */
  .anime-card-tooltip .emotion-tag.epic { background-color: #ff4757; color:white; }
  .anime-card-tooltip .emotion-tag.tension { background-color: #5352ed; color:white;}
  /* ... etc para otros colores de emoción */
  .anime-card-tooltip .tooltip-synopsis { font-size: 0.8em; line-height: 1.5; color: rgba(255, 255, 255, 0.8); margin-bottom: 0; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; }

`;
document.head.appendChild(fallbackTooltipStyles); // Añadir estilos al head
});