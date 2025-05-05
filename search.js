// search.js - Lógica para la página de resultados de búsqueda (CON FILTROS)

// --- Importaciones ---
import { searchAnime, assignEmotions, getEmotionName } from './api.js'; // Asumiendo que getEmotionName no se usa aquí directamente

// --- Elementos DOM ---
const searchTermSpan = document.getElementById('search-term');
const resultsContainer = document.getElementById('search-results-cards');
const loadingIndicator = document.getElementById('search-loading');
const paginationContainer = document.getElementById('search-pagination-controls');
// NUEVO: Elementos de Filtro
const filtersForm = document.getElementById('filters-form'); // Formulario completo
const filterTypeSelect = document.getElementById('filter-type');
const filterStatusSelect = document.getElementById('filter-status');
const filterRatingSelect = document.getElementById('filter-rating');
const filterGenreSelect = document.getElementById('filter-genre'); // Single select por ahora
const filterOrderBySelect = document.getElementById('filter-order-by');
const filterSortSelect = document.getElementById('filter-sort');
const applyFiltersBtn = document.getElementById('apply-filters-btn');

// --- Variables de Estado ---
let currentSearchQuery = '';
let currentSearchPage = 1;
let currentFilters = {}; // Guardar filtros actuales

// --- Funciones de Carga (Adaptadas/Copiadas de main.js si no están en un utils.js) ---
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

// --- Función Principal para Cargar Resultados (Acepta filtros) ---
async function loadSearchResults(query, page = 1, filters = {}) {
  if (!query && Object.keys(filters).length === 0) { // Necesita query O filtros
    resultsContainer.innerHTML = '<div class="no-results">Realiza una búsqueda o aplica filtros.</div>';
    return;
  }

  currentSearchQuery = query || ""; // Guardar query actual (puede ser vacía si solo hay filtros)
  currentSearchPage = page;   // Guardar página actual
  currentFilters = filters;   // Guardar filtros actuales

  // Construir mensaje de carga
  let loadingMessage = "Cargando";
  if (query) loadingMessage += ` buscando "${decodeURIComponent(query)}"`;
  if (Object.keys(filters).length > 0) loadingMessage += ` con filtros aplicados`;
  loadingMessage += ` (Pág. ${page})...`;

  showLoading(loadingIndicator, loadingMessage);
  resultsContainer.innerHTML = ''; // Limpiar resultados anteriores
  if (paginationContainer) paginationContainer.innerHTML = ''; // Limpiar paginación anterior

  try {
    console.log(`>>> Llamando a searchAnime con query: '${query}', page: ${page}, filters:`, filters);
    // Llamar a la API con query y filtros
    const responseData = await searchAnime(query, 20, page, filters); // 20 por página

    if (responseData?.data) { // Verificar que data existe
      const animeList = responseData.data;
      const paginationInfo = responseData.pagination; // Jikan devuelve pagination

      if (animeList.length > 0) {
        displaySearchResults(animeList); // Mostrar tarjetas
        // Mostrar paginación solo si Jikan la devuelve y hay más de una página
        if (paginationInfo && paginationInfo.last_visible_page > 1) {
            displaySearchPagination(paginationInfo);
        } else {
             if (paginationContainer) paginationContainer.innerHTML = ''; // Limpiar si no hay paginación necesaria
        }

      } else {
        // No se encontraron resultados
        let noResultsMessage = "No se encontraron resultados";
        if (query) noResultsMessage += ` para "${decodeURIComponent(query)}"`;
        if (Object.keys(filters).length > 0) noResultsMessage += " con los filtros seleccionados";
        if (page > 1) noResultsMessage = `No hay más resultados (Pág. ${page})`;
        resultsContainer.innerHTML = `<div class="no-results">${noResultsMessage}.</div>`;
        // Mostrar controles de paginación igual para poder volver atrás si estamos en pág > 1
        if (page > 1 && paginationInfo) {
            displaySearchPagination(paginationInfo);
        }
      }
    } else {
      // Si responseData no tiene 'data', asumimos que no hubo resultados o error
      console.warn("Respuesta de Jikan sin 'data':", responseData);
      resultsContainer.innerHTML = `<div class="no-results">No se encontraron resultados o hubo un problema con la API.</div>`;
      // throw new Error("La respuesta de Jikan no tiene el formato esperado (data).");
    }

  } catch (error) {
    console.error(`Error en loadSearchResults (query: "${decodeURIComponent(query)}", page: ${page}, filters: ${JSON.stringify(filters)}):`, error);
    resultsContainer.innerHTML = `<div class="no-results">Error al cargar resultados.<br><small>${error.message}</small></div>`;
  } finally {
    hideLoading(loadingIndicator);
  }
}

// --- NUEVO: Leer los filtros seleccionados ---
function getCurrentFilters() {
    const options = {};
    // Leer valores de los selects
    const type = filterTypeSelect?.value;
    const status = filterStatusSelect?.value;
    const rating = filterRatingSelect?.value;
    const genre = filterGenreSelect?.value; // ID de género único
    const orderBy = filterOrderBySelect?.value;
    const sort = filterSortSelect?.value;

    // Añadir al objeto options solo si tienen valor (no son "Todos" o default)
    if (type) options.type = type;
    if (status) options.status = status;
    if (rating) options.rating = rating;
    if (genre) options.genres = genre; // Jikan API espera el parámetro 'genres'
    if (orderBy) options.order_by = orderBy;
    // Incluir sort solo si hay un order_by especificado (Jikan requiere order_by para usar sort)
    if (orderBy && sort) {
         options.sort = sort;
    } else if (orderBy && !sort) {
        options.sort = 'desc'; // Default a desc si hay orden pero no dirección
    }

    console.log("Filtros leídos:", options);
    return options;
}


// --- Mostrar Tarjetas de Resultados (Adaptada de main.js) ---
function displaySearchResults(animes) {
  resultsContainer.innerHTML = ''; // Limpiar por si acaso
   if (!animes || animes.length === 0) return; // Salir si no hay animes

  animes.forEach(anime => {
    if (!anime?.mal_id || !anime.title) {
      console.warn('Datos insuficientes para tarjeta de búsqueda:', anime);
      return;
    }
    // --- Adaptación para obtener emociones y estudio ---
    // Jikan search devuelve genres directamente, usamos assignEmotions
    const emotions = assignEmotions(anime.genres);
    const emotion1 = emotions[0] || 'epic';
    const emotion2 = emotions[1] || null;
    // Jikan search devuelve studios como array
    const studioText = anime.studios?.[0]?.name || 'Studio desconocido';
    // --- Fin Adaptación ---

    const imageUrl = anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || '';
    const synopsisText = anime.synopsis || 'Sin descripción.';
    // Asegurar que score es número antes de toFixed
    const scoreValue = typeof anime.score === 'number' ? anime.score : parseFloat(anime.score);
    const scoreText = !isNaN(scoreValue) ? scoreValue.toFixed(1) + '/10' : 'N/A';
    // Usar helper formatNumber si existe
    const votersText = anime.scored_by ? '(' + formatNumber(anime.scored_by) + ' votos)' : '';


    // Reutilizar la clase .anime-card para estilos (de style.css)
    const animeCardHTML = `
      <div class="anime-card" data-id="${anime.mal_id}">
        <div class="content-wrapper">
          ${imageUrl ? `<img src="${imageUrl}" alt="${anime.title}" class="anime-card-img" loading="lazy">` : '<div class="anime-card-img placeholder">Sin Imagen</div>'}
          <div class="card-content">
            <div class="anime-name">${anime.title}</div>
            <div class="anime-by">by ${studioText}</div>
            <div class="emotion-tags-container"> <span class="emotion-tag ${emotion1}">${getEmotionName(emotion1)}</span>
              ${emotion2 ? `<span class="emotion-tag ${emotion2}">${getEmotionName(emotion2)}</span>` : ''}
            </div>
            <div class="anime-sum">${truncateText(synopsisText, 100)}</div>
          </div>
        </div>
        <div class="likes">
          <div class="like-name"><span>${scoreText}</span> ${votersText}</div>
        </div>
      </div>`;
    resultsContainer.innerHTML += animeCardHTML;
  });

  // Añadir listeners para redirigir a detalles
  resultsContainer.querySelectorAll('.anime-card').forEach(card => {
    card.addEventListener('click', function() { handleShowDetails(this.dataset.id); });
  });
}

// --- Mostrar Paginación de Búsqueda (Adaptada de main.js) ---
function displaySearchPagination(paginationInfoJikan) {
    if (!paginationContainer || !paginationInfoJikan || !paginationInfoJikan.last_visible_page || paginationInfoJikan.last_visible_page <= 1) {
      if (paginationContainer) paginationContainer.innerHTML = ''; // Limpiar si no hay paginación
      return;
    }
    paginationContainer.innerHTML = ''; // Limpiar

    const currentPage = paginationInfoJikan.current_page;
    const totalPages = paginationInfoJikan.last_visible_page;
    const hasNextPage = paginationInfoJikan.has_next_page;

    // Botón Anterior
    const prevButton = document.createElement('button');
    prevButton.textContent = '‹ Anterior';
    prevButton.disabled = currentPage === 1;
    prevButton.classList.add('pagination-button', 'prev');
    prevButton.addEventListener('click', () => {
        // Volver a cargar resultados con la página anterior y filtros actuales
        loadSearchResults(currentSearchQuery, currentPage - 1, currentFilters); // Usa filtros guardados
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
        // Volver a cargar resultados con la página siguiente y filtros actuales
        loadSearchResults(currentSearchQuery, currentPage + 1, currentFilters); // Usa filtros guardados
    });
    paginationContainer.appendChild(nextButton);
}

// --- Redirigir a Detalles (Copiada de main.js) ---
function handleShowDetails(animeId) {
  if (!animeId) { console.error("ID no proporcionado"); return; }
  window.location.href = `detalle.html?id=${animeId}`;
}

// --- Funciones Auxiliares (Asegurarse que están definidas) ---
function truncateText(text, maxLength) {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

function formatNumber(num) {
  const number = Number(num);
  if (isNaN(number)) { return '0'; }
  return new Intl.NumberFormat('es-CL').format(number); // O el formato que prefieras
}
// Necesitarás getEmotionName si lo usas en las tarjetas de búsqueda
// import { getEmotionName } from './api.js'; // Asegúrate que la importación esté al inicio


// --- Lógica Principal al Cargar la Página ---
document.addEventListener('DOMContentLoaded', () => {
  // 1. Obtener la query de la URL
  const urlParams = new URLSearchParams(window.location.search);
  const query = urlParams.get('q'); // 'q' es el nombre del parámetro

  if (query && searchTermSpan) {
    // Mostrar el término buscado
    const decodedQuery = decodeURIComponent(query);
    searchTermSpan.textContent = decodedQuery;
    // 2. Cargar los resultados iniciales (página 1, SIN filtros iniciales)
    loadSearchResults(decodedQuery, 1, {}); // Pasar objeto vacío de filtros
  } else if (searchTermSpan) {
    // Caso sin query en la URL
    searchTermSpan.textContent = 'Ninguno';
    resultsContainer.innerHTML = '<div class="no-results">Ingresa un término en la página principal para buscar.</div>';
     // Podríamos querer cargar TODOS los animes por defecto aquí, o mostrar filtros
     // Por ahora, dejamos mensaje. Considera llamar a loadSearchResults sin query pero con filtros default si quieres.
     // loadSearchResults("", 1, { order_by: 'popularity' }); // Ejemplo: Cargar populares por defecto
  }

  // 3. Añadir Listener al botón de filtros
  if (applyFiltersBtn) {
      applyFiltersBtn.addEventListener('click', () => {
          const filters = getCurrentFilters(); // Obtener filtros seleccionados
          // Recargar búsqueda desde página 1 con la query actual y los nuevos filtros
          // Usamos currentSearchQuery que se guarda en loadSearchResults
          loadSearchResults(currentSearchQuery, 1, filters);
      });
  } else {
      console.error("Botón 'Aplicar Filtros' no encontrado.");
  }

  // Añadir Placeholder para estilos de tarjeta (si no están en style.css)
  // Adaptado de displaySearchResults para la clase .placeholder
  const placeholderStyle = document.createElement('style');
  placeholderStyle.textContent = `
      .anime-card-img.placeholder {
          background:#eee; height:160px; display:flex;
          align-items:center; justify-content:center; color:#aaa;
          font-size: 0.9em; border-radius: var(--border-radius-small);
      }
       /* Estilos para tags de emoción si no están globales */
       .emotion-tags-container { display: flex; flex-wrap: wrap; gap: 5px; margin: 8px 0; min-height: 23px; }
       .emotion-tag { padding: 3px 8px; font-size: 11px; line-height: 1; border-radius: 15px; color: white; }
       /* Colores específicos (de styles-additional.css) */
       .emotion-tag.epic { background-color: #ff4757; }
       .emotion-tag.tension { background-color: #5352ed; }
       .emotion-tag.sad { background-color: #1e90ff; }
       .emotion-tag.nostalgia { background-color: #70a1ff; }
       .emotion-tag.happy { background-color: #ff6b81; }
       .emotion-tag.wonder { background-color: #ffa502; }

  `;
  document.head.appendChild(placeholderStyle);

});