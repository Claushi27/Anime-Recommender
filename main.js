// main.js - Versión COMPLETA para Banner Info/Imagen Refinado

// --- Importaciones ---
import {
  searchAnime,
  getPopularAnime,
  getSeasonalAnime, // Usado para el slider inicial
  getAnimeDetails,
  getAnimeByGenre,
  assignEmotions,
  getEmotionName,
  getEmotionColor,
  getRecommendationsByEmotion,
  getLatestSeasonalAnime
} from './api.js';

// --- Elementos DOM ---
const searchBar = document.querySelector('.search-bar input');
const suggestionsContainer = document.getElementById('search-suggestions');
// RESTAURADO: Elementos Banner
const bannerSlidesContainer = document.getElementById('banner-slides-content');
const bannerDotsContainer = document.getElementById('banner-dots-container');
const bannerPrevButton = document.getElementById('banner-prev');
const bannerNextButton = document.getElementById('banner-next');
const slideLoading = document.getElementById('slide-loading');
// Otros elementos
const animeCardsContainer = document.getElementById('popular-cards');
const animeTypes = document.querySelectorAll('.anime-type');
const filterButton = document.querySelector('.filter-button');
const emotionCategories = document.querySelectorAll('.emotion');
const cardsLoading = document.getElementById('cards-loading');
const paginationControlsContainer = document.getElementById('pagination-controls');
const latestReleasesContainer = document.getElementById('latest-releases-cards');
const latestReleasesLoading = document.getElementById('latest-releases-loading');
const headerElement = document.querySelector('.header'); // Para controlar el header

// --- Variables de Estado ---
let currentFilterType = null;
let currentEmotionPage = 1;
let totalEmotionPages = 0;
let currentEmotionTag = null;
let currentGenrePage = 1;
let totalGenrePages = 0;
let currentGenreId = null;
let currentGenreName = null;
let debounceTimer;
// RESTAURADO: Variables Banner
let bannerSlides = [];
let bannerDots = [];
let currentBannerIndex = 0;
let bannerInterval;

// --- Función Debounce ---
function debounce(func, delay) {
  return function(...args) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}

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
  // Mostrar loadings iniciales
  if (slideLoading) showLoading(slideLoading, "Cargando destacados...");
  if (cardsLoading) showLoading(cardsLoading, "Cargando populares...");
  if (latestReleasesLoading) showLoading(latestReleasesLoading, "Cargando últimos lanzamientos...");

  try {
    // Cargar todo en paralelo
    await Promise.all([
      loadFeaturedAnime(), // Cargar banner
      loadPopularAnime(),  // Cargar populares
      loadLatestReleases() // Cargar lanzamientos
    ]);
    // Configurar listeners después de cargar datos iniciales si es necesario
    setupEventListeners();
  } catch (error) {
    console.error('Error inicializando la aplicación:', error);
    showErrorMessage('Error cargando datos iniciales. Intenta recargar.');
  } finally {
      // Ocultar loadings
      if (slideLoading) hideLoading(slideLoading);
      if (cardsLoading) hideLoading(cardsLoading);
      if (latestReleasesLoading) hideLoading(latestReleasesLoading);
  }
}

// --- Cargar y Configurar Banner (Restaurado y Refinado) ---
async function loadFeaturedAnime() {
  if (!bannerSlidesContainer || !slideLoading ) {
      console.error("Elementos del banner no encontrados");
      if (slideLoading) hideLoading(slideLoading);
      if(bannerPrevButton) bannerPrevButton.style.display = 'none';
      if(bannerNextButton) bannerNextButton.style.display = 'none';
      if(bannerDotsContainer) bannerDotsContainer.style.display = 'none';
      return;
  }

  showLoading(slideLoading, "Cargando destacados...");
  try {
      const seasonalData = await getSeasonalAnime(undefined, undefined, 5); // 5 slides

      if (seasonalData?.data && seasonalData.data.length > 0) {
         setupBannerSlider(seasonalData.data);
      } else {
         bannerSlidesContainer.innerHTML = '<p style="color: white; text-align: center; padding: 50px;">No se encontraron animes destacados.</p>';
         if(bannerPrevButton) bannerPrevButton.style.display = 'none';
         if(bannerNextButton) bannerNextButton.style.display = 'none';
         if(bannerDotsContainer) bannerDotsContainer.style.display = 'none';
      }
  } catch (error) {
      console.error('Error cargando anime para banner (Jikan):', error);
      if (bannerSlidesContainer) bannerSlidesContainer.innerHTML = '<p style="color: white; text-align: center; padding: 50px;">Error al cargar destacados.</p>';
      showErrorMessage('Error al cargar destacados para banner.');
       if(bannerPrevButton) bannerPrevButton.style.display = 'none';
       if(bannerNextButton) bannerNextButton.style.display = 'none';
       if(bannerDotsContainer) bannerDotsContainer.style.display = 'none';
  } finally {
      hideLoading(slideLoading);
  }
}

// --- Configuración del Banner Slider (Info 40% / Imagen 60%) ---
function setupBannerSlider(animes) {
  if (!bannerSlidesContainer || !bannerDotsContainer || !bannerPrevButton || !bannerNextButton) return;

  bannerPrevButton.style.display = 'block';
  bannerNextButton.style.display = 'block';
  bannerDotsContainer.style.display = 'flex';

  bannerSlidesContainer.innerHTML = '';
  bannerDotsContainer.innerHTML = '';
  bannerSlides = [];
  bannerDots = [];
  currentBannerIndex = 0;

  animes.forEach((anime, index) => {
      const slide = document.createElement('div');
      slide.classList.add('banner-slide');

      const infoPanel = document.createElement('div');
      infoPanel.classList.add('banner-info-panel');

      const title = anime.title || 'Título no disponible';
      const synopsis = truncateText(anime.synopsis, 130);
      const type = anime.type || 'N/A';
      let duration = anime.duration || '';
      if (duration.includes('min per ep')) duration = duration.replace(' per ep', '');
      else if (duration.includes('hr')) duration = duration.replace('hr', 'h').replace('min','m');

      const aired = anime.aired?.string || '';
      const rating = anime.rating || '';
      const score = anime.score ? `${anime.score.toFixed(1)}` : '';
      const mal_id = anime.mal_id;
      const primaryEmotion = assignEmotions(anime.genres)[0] || 'epic';

      // Usar Font Awesome (si está incluido) o texto simple
      const iconType = '<i class="fas fa-tv"></i>'; // Asegúrate de tener Font Awesome
      const iconClock = '<i class="far fa-clock"></i>';
      const iconCalendar = '<i class="far fa-calendar-alt"></i>';
      const iconShield = '<i class="fas fa-user-shield"></i>';
      const iconStar = '<i class="fas fa-star"></i>';

      infoPanel.innerHTML = `
          <span class="banner-spotlight" style="color: var(--primary-color); font-weight: bold;">#${index + 1} Spotlight</span>
          <h2 class="banner-title">${title}</h2>
          <div class="banner-meta">
              ${type ? `<span>${iconType} ${type}</span>` : ''}
              ${duration ? `<span>${iconClock} ${duration}</span>` : ''}
              ${aired ? `<span>${iconCalendar} ${aired}</span>` : ''}
              ${rating ? `<span>${iconShield} ${rating}</span>` : ''}
              ${score ? `<span class="score">${iconStar} ${score}</span>` : ''}
          </div>
          <p class="banner-synopsis">${synopsis}</p>
          <div class="banner-actions">
              <button class="btn btn-detail" data-id="${mal_id}">Detalles</button>
              </div>
      `;

      const imagePanel = document.createElement('div');
      imagePanel.classList.add('banner-image-panel');
      const imageUrl = anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || '';
      if (imageUrl) {
          imagePanel.style.backgroundImage = `url('${imageUrl}')`;
      } else {
          imagePanel.innerHTML = '<div class="placeholder">Sin Imagen</div>';
      }

      slide.appendChild(infoPanel);
      slide.appendChild(imagePanel);
      bannerSlidesContainer.appendChild(slide);
      bannerSlides.push(slide);

      const dot = document.createElement('button');
      dot.classList.add('banner-dot');
      dot.dataset.index = index;
      bannerDotsContainer.appendChild(dot);
      bannerDots.push(dot);

      const detailButton = infoPanel.querySelector('.btn-detail');
      if (detailButton) {
          detailButton.addEventListener('click', function() {
              handleShowDetails(this.dataset.id);
          });
      }
  });

  function showSlide(index) {
      if (index >= bannerSlides.length || index < 0) return;
      bannerSlides.forEach((slide, i) => { slide.classList.toggle('active', i === index); });
      bannerDots.forEach((dot, i) => { dot.classList.toggle('active', i === index); });
      currentBannerIndex = index;
  }

  function nextSlide() {
      let newIndex = (currentBannerIndex + 1) % bannerSlides.length;
      showSlide(newIndex);
  }
  function prevSlide() {
      let newIndex = (currentBannerIndex - 1 + bannerSlides.length) % bannerSlides.length;
      showSlide(newIndex);
  }

  if(bannerPrevButton) bannerPrevButton.addEventListener('click', () => { prevSlide(); resetBannerInterval(); });
  if(bannerNextButton) bannerNextButton.addEventListener('click', () => { nextSlide(); resetBannerInterval(); });

  bannerDots.forEach(dot => {
      dot.addEventListener('click', (e) => {
          const index = parseInt(e.target.dataset.index, 10);
          if (!isNaN(index)) { showSlide(index); resetBannerInterval(); }
      });
  });

  function startBannerInterval() {
      clearInterval(bannerInterval);
      bannerInterval = setInterval(nextSlide, 7000);
  }
  function resetBannerInterval() {
      clearInterval(bannerInterval);
      bannerInterval = setInterval(nextSlide, 7000);
  }

  if (bannerSlides.length > 0) {
      showSlide(0);
      startBannerInterval();
      if(bannerSlidesContainer) { // Asegurarse que existe
        bannerSlidesContainer.addEventListener('mouseenter', () => clearInterval(bannerInterval));
        bannerSlidesContainer.addEventListener('mouseleave', startBannerInterval);
      }
  }
}

// --- Cargar Populares Iniciales ---
async function loadPopularAnime() {
  if (!animeCardsContainer) return;
  if (cardsLoading) showLoading(cardsLoading, "Cargando populares...");
  try {
    const popularData = await getPopularAnime(20);
    if (popularData?.data) {
      displayAnimeCards(popularData.data, animeCardsContainer);
    } else {
      animeCardsContainer.innerHTML = '<div class="no-results">No se encontraron animes populares.</div>';
    }
  } catch (error) {
    console.error('Error cargando anime popular (Jikan):', error);
    animeCardsContainer.innerHTML = '<div class="no-results">Error al cargar populares.</div>';
  } finally {
     if (cardsLoading) hideLoading(cardsLoading);
  }
}

// --- Cargar Últimos Lanzamientos ---
async function loadLatestReleases() {
  if (!latestReleasesContainer || !latestReleasesLoading) return;
  showLoading(latestReleasesLoading, "Cargando últimos lanzamientos...");
  try {
      const responseData = await getSeasonalAnime(undefined, undefined, 15); // Usamos getSeasonalAnime aquí
      if (responseData?.data && responseData.data.length > 0) {
          displayAnimeCards(responseData.data, latestReleasesContainer);
      } else {
          latestReleasesContainer.innerHTML = '<div class="no-results">No se encontraron lanzamientos recientes.</div>';
      }
  } catch (error) {
      console.error('Error cargando últimos lanzamientos (Jikan):', error);
      if (latestReleasesContainer) {
         latestReleasesContainer.innerHTML = '<div class="no-results">Error al cargar lanzamientos.</div>';
      }
      showErrorMessage('Error al cargar los últimos lanzamientos.');
  } finally {
      hideLoading(latestReleasesLoading);
  }
}

// --- Mostrar Tarjetas (Normales) ---
function displayAnimeCards(animes, container = animeCardsContainer) {
  if (!container) {
      console.error("Contenedor para mostrar tarjetas no válido");
      return;
  }
  container.innerHTML = '';
   if (!animes || animes.length === 0) {
      container.innerHTML = '<div class="no-results">No hay animes para mostrar.</div>';
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
    const studioText = Array.isArray(anime.studios) && anime.studios.length > 0
                       ? anime.studios[0]?.name
                       : (anime.studio || 'Studio desconocido');

    const animeCardHTML = `
      <div class="anime-card" data-id="${anime.mal_id}">
        <div class="content-wrapper">
          ${imageUrl ? `<img src="${imageUrl}" alt="${anime.title}" class="anime-card-img" loading="lazy">` : '<div class="anime-card-img placeholder">Sin Imagen</div>'}
          <div class="card-content">
            <div class="anime-name">${anime.title}</div>
            <div class="anime-by">by ${studioText}</div>
            <div class="emotion-tags-container">
              <span class="emotion-tag ${getEmotionColor(emotion1)}">${getEmotionName(emotion1)}</span>
              ${emotion2 ? `<span class="emotion-tag ${getEmotionColor(emotion2)}">${getEmotionName(emotion2)}</span>` : ''}
            </div>
            <div class="anime-sum">${truncateText(synopsisText, 100)}</div>
          </div>
        </div>
        <div class="likes">
          <div class="like-name"><span>${scoreText}</span> ${votersText}</div>
        </div>
      </div>`;
    container.innerHTML += animeCardHTML;
  });

  container.querySelectorAll('.anime-card').forEach(card => {
    card.addEventListener('click', function() { handleShowDetails(this.dataset.id); });
  });
}

// --- Mostrar Controles de Paginación ---
function displayPaginationControls(paginationInfo, context) {
    if (!paginationControlsContainer) return;
    paginationControlsContainer.innerHTML = '';

    let currentPage, totalPages, hasNextPage = false;

    if (context === 'genre' && paginationInfo?.pagination) {
        currentPage = paginationInfo.pagination.current_page;
        totalPages = paginationInfo.pagination.last_visible_page;
        hasNextPage = paginationInfo.pagination.has_next_page;
    } else if (context === 'emotion' && paginationInfo) {
        currentPage = paginationInfo.current_page;
        totalPages = paginationInfo.total_pages;
        hasNextPage = currentPage < totalPages;
    } else {
        // Intentar manejar paginación inesperada o ausente
        currentPage = paginationInfo?.current_page || paginationInfo?.pagination?.current_page || 1;
        totalPages = paginationInfo?.total_pages || paginationInfo?.pagination?.last_visible_page || 1;
        hasNextPage = paginationInfo?.pagination?.has_next_page ?? (currentPage < totalPages);
         if (totalPages <= 1) return; // No mostrar si solo hay 1 página
        console.warn("Estructura de paginación no estándar:", paginationInfo, "Contexto:", context);
    }

    if (totalPages <= 1) return;

    const prevButton = document.createElement('button');
    prevButton.textContent = '‹ Anterior';
    prevButton.disabled = currentPage === 1;
    prevButton.classList.add('pagination-button', 'prev');
    prevButton.addEventListener('click', () => {
        if (context === 'emotion' && currentEmotionTag) {
            handleEmotionFilter([currentEmotionTag], currentPage - 1);
        } else if (context === 'genre' && currentGenreName !== null) {
            handleGenreFilter(currentGenreName, currentPage - 1);
        }
    });
    paginationControlsContainer.appendChild(prevButton);

    const pageIndicator = document.createElement('span');
    pageIndicator.textContent = `Página ${currentPage} de ${totalPages}`;
    pageIndicator.classList.add('page-indicator');
    paginationControlsContainer.appendChild(pageIndicator);

    const nextButton = document.createElement('button');
    nextButton.textContent = 'Siguiente ›';
    nextButton.disabled = currentPage === totalPages || !hasNextPage;
    nextButton.classList.add('pagination-button', 'next');
    nextButton.addEventListener('click', () => {
         if (context === 'emotion' && currentEmotionTag) {
            handleEmotionFilter([currentEmotionTag], currentPage + 1);
        } else if (context === 'genre' && currentGenreName !== null) {
            handleGenreFilter(currentGenreName, currentPage + 1);
        }
    });
    paginationControlsContainer.appendChild(nextButton);
}

// --- Redirigir a Detalles ---
function handleShowDetails(animeId) {
  if (!animeId) { console.error("ID no proporcionado"); showErrorMessage("Error al ver detalles."); return; }
  console.log(`Redirigiendo a detalle.html con ID: ${animeId}`);
  window.location.href = `detalle.html?id=${animeId}`;
}

// --- Lógica Autocompletado ---
function showSuggestions(animes) {
  if (!suggestionsContainer) return;
  suggestionsContainer.innerHTML = '';
  if (!animes || animes.length === 0) { hideSuggestions(); return; }

  animes.forEach(anime => {
    if (!anime?.mal_id || !anime.title) return;
    const item = document.createElement('div');
    item.classList.add('suggestion-item');
    item.dataset.id = anime.mal_id;
    const imgUrl = anime.images?.jpg?.image_url || '';
    const title = anime.title;
    item.innerHTML = `
      ${imgUrl ? `<img src="${imgUrl}" alt="" loading="lazy">` : '<div class="suggestion-placeholder-img"></div>'}
      <span>${title}</span>
    `;
    item.addEventListener('click', () => {
      if(searchBar) searchBar.value = title;
      hideSuggestions();
      handleShowDetails(anime.mal_id);
    });
    suggestionsContainer.appendChild(item);
  });
  suggestionsContainer.style.display = 'block';
}

function hideSuggestions() {
  if (suggestionsContainer) suggestionsContainer.style.display = 'none';
}

async function handleAutocompleteSearch(query) {
   if (query.length < 3) { hideSuggestions(); return; }
  console.log(`Buscando sugerencias para: ${query}`);
  try {
    const results = await searchAnime(query, 5); // Jikan, límite 5
    if (results?.data) { showSuggestions(results.data); }
    else { hideSuggestions(); }
  } catch (error) {
    console.error('Error buscando sugerencias:', error);
    hideSuggestions();
  }
}

const debouncedAutocompleteSearch = debounce(handleAutocompleteSearch, 400);

// --- Setup Event Listeners ---
function setupEventListeners() {
  // Búsqueda
  if (searchBar) {
      searchBar.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && this.value.trim()) {
          const query = this.value.trim();
          hideSuggestions();
          window.location.href = `search.html?q=${encodeURIComponent(query)}`;
        }
      });
      searchBar.addEventListener('input', function() {
        const query = this.value.trim();
        if (query.length >= 3) { debouncedAutocompleteSearch(query); }
        else { hideSuggestions(); }
      });
  }
  // Clic fuera de sugerencias
  document.addEventListener('click', function(event) {
      if (searchBar && !searchBar.contains(event.target) &&
          suggestionsContainer && !suggestionsContainer.contains(event.target)) {
          hideSuggestions();
      }
  });

  // Filtro Género
  animeTypes.forEach(type => {
    type.addEventListener('click', function(e) {
      e.preventDefault();
      document.querySelector('.anime-type.active')?.classList.remove('active');
      this.classList.add('active');
      hideSuggestions();
      clearPaginationState();
      handleGenreFilter(this.textContent, 1);
    });
  });

  // Filtro Emoción
  if(filterButton){
      filterButton.addEventListener('click', function() {
        const selectedEmotionTags = Array.from(document.querySelectorAll('.emotion.selected'))
                                         .map(el => el.dataset.emotionTag)
                                         .filter(tag => tag);
        if (selectedEmotionTags.length > 0) {
          hideSuggestions();
          clearPaginationState();
          handleEmotionFilter([selectedEmotionTags[0]], 1);
        } else {
          showErrorMessage('Selecciona al menos una emoción para filtrar.');
        }
      });
  }

  // Selección Emoción
  emotionCategories.forEach(emotion => {
    emotion.addEventListener('click', function() {
        document.querySelectorAll('.emotion.selected').forEach(el => {
            if (el !== this) el.classList.remove('selected');
        });
        this.classList.toggle('selected');
    });
  });

  // Listener para scroll del Header
  if (headerElement) {
      window.addEventListener('scroll', () => {
          if (window.scrollY > 50) { headerElement.classList.add('header-scrolled'); }
          else { headerElement.classList.remove('header-scrolled'); }
      });
  } else { console.error("Elemento del header no encontrado."); }
}

// --- Limpiar estado de paginación ---
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
    hideSuggestions();
}

// --- Filtro Género (CON PAGINACIÓN) ---
async function handleGenreFilter(genreName, page = 1) {
  currentFilterType = 'genre';
  currentGenrePage = page;
  currentGenreName = genreName;
  if (!animeCardsContainer || !cardsLoading) return;

  showLoading(cardsLoading, `Cargando ${genreName} (Pág. ${page})...`);
  animeCardsContainer.innerHTML = '';
  if (paginationControlsContainer) paginationControlsContainer.innerHTML = '';

  const genreMap = { 'Todos': 0, 'Acción': 1, 'Drama': 8, 'Romance': 22, 'Comedia': 4, 'Fantasía': 10 };
  const genreId = genreMap[genreName];
  currentGenreId = genreId;

  try {
      let responseData;
      if (genreName === 'Todos') {
           responseData = await searchAnime('', 20, page, { order_by: 'popularity', sort: 'asc' }); // Usa searchAnime para 'Todos'
      } else if (genreId !== undefined) {
          responseData = await getAnimeByGenre(genreId, 20, page);
      } else {
          // Género no mapeado, volver a populares
          console.warn(`Género "${genreName}" no mapeado.`);
          showErrorMessage(`Género "${genreName}" no reconocido.`);
          responseData = await getPopularAnime(20); // Carga populares sin paginar
          clearPaginationState(); // Limpia estado porque no hay paginación para esto
          document.querySelector('.anime-type.active')?.classList.remove('active');
          document.querySelector('.anime-type:first-child')?.classList.add('active');
           // Como getPopularAnime no devuelve paginación, procesamos solo los datos
           if (responseData?.data) {
              displayAnimeCards(responseData.data, animeCardsContainer);
           } else {
              animeCardsContainer.innerHTML = '<div class="no-results">No se encontraron animes populares.</div>';
           }
           hideLoading(cardsLoading);
           return; // Salir aquí porque no hay paginación que procesar
      }

      // Procesar respuesta con paginación esperada
      if (responseData?.data && responseData?.pagination) {
          const animeList = responseData.data;
          totalGenrePages = responseData.pagination.last_visible_page || 1;
          if (animeList.length > 0) {
              displayAnimeCards(animeList, animeCardsContainer);
              displayPaginationControls(responseData, 'genre');
          } else {
              if (page === 1) { animeCardsContainer.innerHTML = `<div class="no-results">No se encontraron animes para ${genreName}.</div>`; }
              else { animeCardsContainer.innerHTML = `<div class="no-results">No hay más resultados (Pág. ${page}) para ${genreName}.</div>`; displayPaginationControls(responseData, 'genre'); }
          }
      } else {
          // Caso raro: hay datos pero no paginación (ej. Jikan devuelve menos de 'limit' en la última página)
          if(responseData?.data && responseData.data.length > 0) {
              displayAnimeCards(responseData.data, animeCardsContainer);
              console.warn(`Respuesta para ${genreName} (Pág. ${page}) sin info de paginación completa, pero con datos.`);
          } else {
              // No hay datos o estructura inesperada
              if(page === 1) { animeCardsContainer.innerHTML = `<div class="no-results">No se encontraron resultados para ${genreName}.</div>`; }
              else { animeCardsContainer.innerHTML = `<div class="no-results">No hay más resultados (Pág. ${page}) para ${genreName}.</div>`; }
              console.warn(`Respuesta Jikan incompleta o vacía para ${genreName} (Pág. ${page}):`, responseData);
          }
          if (paginationControlsContainer) paginationControlsContainer.innerHTML = ''; // Limpia controles si no hay paginación clara
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


// --- Filtro Emoción (CON PAGINACIÓN - usa Backend Local) ---
async function handleEmotionFilter(selectedTags, page = 1) {
    currentFilterType = 'emotion';
    const emotionTag = selectedTags[0];
    currentEmotionTag = emotionTag;
    currentEmotionPage = page;
    if (!animeCardsContainer || !cardsLoading) return;

    showLoading(cardsLoading, `Buscando animes (Pág. ${page}) con emoción: ${getEmotionName(emotionTag)}...`);
    animeCardsContainer.innerHTML = '';
    if (paginationControlsContainer) paginationControlsContainer.innerHTML = '';

    try {
        const responseData = await getRecommendationsByEmotion(emotionTag, page, 20);
        if (responseData && responseData.recommendations && responseData.pagination) {
            const recommendations = responseData.recommendations;
            const paginationInfo = responseData.pagination;
            totalEmotionPages = paginationInfo.total_pages;
            if (recommendations.length > 0) {
                 const mappedRecommendations = recommendations.map(anime_backend => ({
                        mal_id: anime_backend.mal_id, title: anime_backend.title,
                        images: { jpg: { image_url: anime_backend.thumbnailURL || anime_backend.Image_URL || '', large_image_url: anime_backend.Image_URL || anime_backend.thumbnailURL || ''}},
                        studios: anime_backend.studio ? [{ name: anime_backend.studio }] : [],
                        genres: anime_backend.genre ? anime_backend.genre.split(',').map(g=>({name: g.trim()})) : [],
                        score: anime_backend.rating, scored_by: null,
                        synopsis: anime_backend.Synopsis || 'Descripción no disponible.',
                        Emotions: anime_backend.Emotions ? anime_backend.Emotions.split(',') : []
                    }));
                displayAnimeCards(mappedRecommendations, animeCardsContainer);
                displayPaginationControls(paginationInfo, 'emotion');
            } else {
                 if (page === 1) { animeCardsContainer.innerHTML = `<div class="no-results">No se encontraron animes para la emoción: ${getEmotionName(emotionTag)}.</div>`; }
                 else { animeCardsContainer.innerHTML = `<div class="no-results">No hay más resultados (Pág. ${page}).</div>`; displayPaginationControls(paginationInfo, 'emotion'); }
            }
        } else { throw new Error("La respuesta del backend no tiene el formato esperado."); }
    } catch (error) {
        console.error(`Error al obtener/procesar recomendaciones del backend (Pág. ${page}):`, error);
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
  errorDiv.offsetHeight; // Force reflow
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