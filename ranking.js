// ranking.js - Lógica para la página de Ranking de Anime

import { getCustomRanking } from './api.js'; // <--- Cambiar a getCustomRanking

// --- Elementos DOM ---
const rankingListContainer = document.getElementById('ranking-list-container');
const loadingIndicator = document.getElementById('ranking-loading');
const paginationContainer = document.getElementById('ranking-pagination-controls');

// --- Variables de Estado ---
let currentPage = 1;
const limitPerPage = 25; // Definir cuántos ítems por página para el ranking custom
const minVotesForRankingPage = 1000; // Umbral de votos para la página de ranking (puedes ajustarlo)

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

// --- Cargar y Mostrar Ranking (usando backend custom) ---
async function loadRanking(page = 1) {
  currentPage = page;
  showLoading(loadingIndicator, `Cargando Ranking Custom (Página ${page})...`);
  if (rankingListContainer) rankingListContainer.innerHTML = '';
  if (paginationContainer) paginationContainer.innerHTML = '';

  try {
    // Llamar a getCustomRanking desde api.js
    const responseData = await getCustomRanking(page, limitPerPage, minVotesForRankingPage);

    if (responseData && responseData.data && responseData.pagination) {
      const animeList = responseData.data;
      const paginationInfo = responseData.pagination; // Paginación de nuestro backend

      if (animeList.length > 0) {
        // displayRankingList espera que cada anime tenga 'rank' y otros campos.
        // El backend en /api/ranking/custom ya debería devolverlos formateados.
        displayRankingList(animeList);
        if (paginationInfo.total_pages > 1) {
          // Adaptar la paginación del backend a lo que espera displayRankingPagination
          const jikanCompatiblePagination = {
              current_page: paginationInfo.current_page,
              last_visible_page: paginationInfo.total_pages, // Usar total_pages del backend
              has_next_page: paginationInfo.has_next_page     // Usar has_next_page del backend
          };
          displayRankingPagination(jikanCompatiblePagination);
        }
      } else {
        rankingListContainer.innerHTML = '<div class="no-results">No se encontraron animes en el ranking custom o no hay más páginas.</div>';
        if (page > 1 && paginationInfo.total_pages > 0) { // Mostrar paginación para volver si es relevante
             const jikanCompatiblePagination = {
                current_page: paginationInfo.current_page,
                last_visible_page: paginationInfo.total_pages,
                has_next_page: paginationInfo.has_next_page
            };
            displayRankingPagination(jikanCompatiblePagination);
        }
      }
    } else {
      throw new Error("La respuesta del backend para ranking custom no tiene el formato esperado.");
    }
  } catch (error) {
    console.error(`Error cargando el ranking custom (Página ${page}):`, error);
    if (rankingListContainer) rankingListContainer.innerHTML = `<div class="no-results">Error al cargar el ranking custom: ${error.message}</div>`;
  } finally {
    hideLoading(loadingIndicator);
  }
}

// --- Mostrar Lista de Ranking ---
function displayRankingList(animes) {
  if (!rankingListContainer) return;
  rankingListContainer.innerHTML = '';

  animes.forEach(anime => {
    // Los datos ya vienen formateados del backend (score, members, rank, etc.)
    if (!anime || !anime.mal_id) return;

    const score = typeof anime.score === 'number' ? anime.score.toFixed(2) : 'N/A';
    const members = anime.members ? formatNumber(anime.members) : (anime.scored_by ? formatNumber(anime.scored_by) : 'N/A');
    const rankDisplay = anime.rank ? `#${anime.rank}` : '-'; // 'rank' viene del backend custom
    const episodes = anime.episodes || '?';
    const type = anime.type || 'N/A';
    const year = anime.year || 'N/A'; // 'year' debería venir del backend
    const status = anime.status || 'N/A';
    const genresToShow = anime.genres?.slice(0, 3).map(g => g.name).join(', ') || 'Sin géneros';

    const animeItemHTML = `
      <div class="ranking-item" data-id="${anime.mal_id}">
        <span class="rank-number">${rankDisplay}</span>
        <img src="${anime.images?.jpg?.image_url || './img/placeholder-poster.png'}" alt="${anime.title}" class="rank-img" loading="lazy" onerror="this.src='./img/placeholder-poster.png';">
        <div class="rank-info">
          <a href="detalle.html?id=${anime.mal_id}" class="rank-title">${anime.title}</a>
          <div class="rank-meta">
            <span><i class="fas fa-tv"></i> ${type} (${episodes} eps)</span>
            <span><i class="fas fa-calendar-alt"></i> ${year}</span>
            <span><i class="fas fa-broadcast-tower"></i> ${status}</span>
          </div>
          <div class="rank-genres">${genresToShow}</div>
        </div>
        <div class="rank-score-members">
          <div class="score"><i class="fas fa-star"></i> ${score}</div>
          <div class="members"><i class="fas fa-users"></i> ${members} usuarios</div>
        </div>
      </div>
    `;
    rankingListContainer.innerHTML += animeItemHTML;
  });
}

// --- Mostrar Paginación del Ranking ---
function displayRankingPagination(paginationInfoBackend) { // Acepta la estructura de paginación del backend
    if (!paginationContainer || !paginationInfoBackend || !paginationInfoBackend.last_visible_page || paginationInfoBackend.last_visible_page <= 1) {
      if (paginationContainer) paginationContainer.innerHTML = '';
      return;
    }
    paginationContainer.innerHTML = '';

    const currentPage = paginationInfoBackend.current_page;
    const totalPages = paginationInfoBackend.last_visible_page; // last_visible_page es nuestro total_pages
    const hasNextPage = paginationInfoBackend.has_next_page;

    if (currentPage > 1) {
        const prevButton = document.createElement('button');
        prevButton.textContent = '‹ Anterior';
        prevButton.classList.add('pagination-button', 'prev');
        prevButton.addEventListener('click', () => loadRanking(currentPage - 1));
        paginationContainer.appendChild(prevButton);
    }

    const pageIndicator = document.createElement('span');
    pageIndicator.textContent = `Página ${currentPage} de ${totalPages}`;
    pageIndicator.classList.add('page-indicator');
    paginationContainer.appendChild(pageIndicator);

    if (hasNextPage) {
        const nextButton = document.createElement('button');
        nextButton.textContent = 'Siguiente ›';
        nextButton.classList.add('pagination-button', 'next');
        nextButton.addEventListener('click', () => loadRanking(currentPage + 1));
        paginationContainer.appendChild(nextButton);
    }
}

// --- Funciones Auxiliares ---
function formatNumber(num) {
  const number = Number(num);
  if (isNaN(number)) { return 'N/A'; }
  return new Intl.NumberFormat('es-CL').format(number);
}

// --- Lógica Principal al Cargar la Página de Ranking ---
document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const pageFromUrl = parseInt(urlParams.get('page'), 10) || 1;
  loadRanking(pageFromUrl);
});