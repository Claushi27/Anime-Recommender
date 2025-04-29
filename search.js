// search.js - Lógica para la página de resultados de búsqueda

// --- Importaciones ---
// Necesitamos searchAnime de api.js
// También podríamos necesitar helpers si los movemos a utils.js, pero por ahora los copiamos/adaptamos
import { searchAnime, assignEmotions, getEmotionName } from './api.js';

// --- Elementos DOM ---
const searchTermSpan = document.getElementById('search-term');
const resultsContainer = document.getElementById('search-results-cards');
const loadingIndicator = document.getElementById('search-loading');
const paginationContainer = document.getElementById('search-pagination-controls');

// --- Variables de Estado ---
let currentSearchQuery = '';
let currentSearchPage = 1;
// Aquí irán los estados para los filtros avanzados más adelante

// --- Funciones de Carga (Adaptadas/Copiadas de main.js) ---
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

// --- Función Principal para Cargar Resultados ---
async function loadSearchResults(query, page = 1, filters = {}) {
  if (!query) {
    resultsContainer.innerHTML = '<div class="no-results">No se especificó término de búsqueda.</div>';
    return;
  }

  currentSearchQuery = query; // Guardar query actual
  currentSearchPage = page;   // Guardar página actual
  // Guardar filtros actuales más adelante...

  showLoading(loadingIndicator, `Buscando "${decodeURIComponent(query)}" (Pág. ${page})...`);
  resultsContainer.innerHTML = '';
  if (paginationContainer) paginationContainer.innerHTML = '';

  try {
    // Llamar a la versión MODIFICADA de searchAnime que acepta page y filtros
    const responseData = await searchAnime(query, 20, page, filters); // 20 por página

    if (responseData && responseData.data) {
      const animeList = responseData.data;
      const paginationInfo = responseData.pagination; // Jikan devuelve pagination

      if (animeList.length > 0) {
        displaySearchResults(animeList); // Mostrar tarjetas
        displaySearchPagination(paginationInfo); // Mostrar paginación
      } else {
        if (page === 1) {
          resultsContainer.innerHTML = `<div class="no-results">No se encontraron resultados para "${decodeURIComponent(query)}".</div>`;
        } else {
          resultsContainer.innerHTML = `<div class="no-results">No hay más resultados para mostrar (Pág. ${page}).</div>`;
          displaySearchPagination(paginationInfo); // Mostrar controles para volver
        }
      }
    } else {
      throw new Error("La respuesta de Jikan no tiene el formato esperado (data).");
    }

  } catch (error) {
    console.error(`Error buscando "${decodeURIComponent(query)}" (Pág. ${page}):`, error);
    // Usar showErrorMessage si la copiamos aquí, o alert
    resultsContainer.innerHTML = `<div class="no-results">Error al buscar resultados.<br><small>${error.message}</small></div>`;
  } finally {
    hideLoading(loadingIndicator);
  }
}

// --- Mostrar Tarjetas de Resultados (Adaptada de main.js) ---
function displaySearchResults(animes) {
  resultsContainer.innerHTML = ''; // Limpiar por si acaso
   if (!animes || animes.length === 0) return;

  animes.forEach(anime => {
    if (!anime?.mal_id || !anime.title) {
      console.warn('Datos insuficientes para tarjeta de búsqueda:', anime);
      return;
    }
    // Adaptar mapeo si es necesario (estructura Jikan aquí)
    const emotions = assignEmotions(anime.genres);
    const emotion1 = emotions[0] || 'epic';
    const emotion2 = emotions[1] || null;
    const imageUrl = anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || '';
    const synopsisText = anime.synopsis || 'Sin descripción.';
    const scoreValue = typeof anime.score === 'number' ? anime.score : parseFloat(anime.score);
    const scoreText = !isNaN(scoreValue) ? scoreValue.toFixed(1) + '/10' : 'N/A';
    const votersText = anime.scored_by ? '(' + formatNumber(anime.scored_by) + ' votos)' : '';
    const studioText = anime.studios?.[0]?.name || 'Studio desconocido';

    // Reutilizar la clase .anime-card para estilos
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
      if (paginationContainer) paginationContainer.innerHTML = '';
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
        loadSearchResults(currentSearchQuery, currentPage - 1 /*, currentFilters */);
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
        loadSearchResults(currentSearchQuery, currentPage + 1 /*, currentFilters */);
    });
    paginationContainer.appendChild(nextButton);
}

// --- Redirigir a Detalles (Copiada de main.js) ---
function handleShowDetails(animeId) {
  if (!animeId) { console.error("ID no proporcionado"); return; }
  // Abrir en nueva pestaña o en la misma ventana
  // window.open(`detalle.html?id=${animeId}`, '_blank');
  window.location.href = `detalle.html?id=${animeId}`;
}

// --- Funciones Auxiliares (Copiadas/Adaptadas de main.js) ---
// Necesitamos: showErrorMessage, truncateText, formatNumber
function showErrorMessage(message) { /* ... (código copiado de main.js) ... */ }
function truncateText(text, maxLength) { /* ... (código copiado de main.js) ... */ }
function formatNumber(num) { /* ... (código copiado de main.js) ... */ }

// --- Lógica Principal al Cargar la Página ---
document.addEventListener('DOMContentLoaded', () => {
  // 1. Obtener la query de la URL
  const urlParams = new URLSearchParams(window.location.search);
  const query = urlParams.get('q'); // 'q' es el nombre del parámetro que pusimos

  if (query && searchTermSpan) {
    // Mostrar el término buscado (decodificado por si tiene espacios, etc.)
    searchTermSpan.textContent = decodeURIComponent(query);
    // 2. Cargar los resultados iniciales (página 1, sin filtros por ahora)
    loadSearchResults(query, 1);
  } else if (searchTermSpan) {
    searchTermSpan.textContent = 'Ninguno';
    resultsContainer.innerHTML = '<div class="no-results">No se especificó un término de búsqueda en la URL.</div>';
  }

  // 3. Aquí añadiremos los listeners para los filtros avanzados más adelante
  // setupFilterListeners();
});

// --- Función Placeholder para Listeners de Filtros ---
// function setupFilterListeners() {
//   const filterControls = document.querySelectorAll('.filter-control'); // Ejemplo
//   filterControls.forEach(control => {
//     control.addEventListener('change', () => {
//       const currentFilters = getCurrentFilters(); // Función para leer todos los filtros
//       loadSearchResults(currentSearchQuery, 1, currentFilters); // Recargar desde página 1 con filtros
//     });
//   });
// }

// function getCurrentFilters() {
//    // Leer valores de checkboxes, selects, etc. y devolver un objeto
//    return { type: 'tv', status: 'airing', genres: '1,8', order_by: 'score', sort: 'desc' }; // Ejemplo
// }