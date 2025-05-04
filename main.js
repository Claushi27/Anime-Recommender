// main.js - Script principal (CON PAGINACIÓN, AUTOCOMPLETADO Y ÚLTIMOS LANZAMIENTOS)

// --- Importaciones ---
import {
  searchAnime,
  getPopularAnime,
  getSeasonalAnime, // Usado para el slider inicial
  getAnimeDetails,  // Aunque no se usa directamente aquí, podría ser útil
  getAnimeByGenre,
  assignEmotions,
  getEmotionName,
  getEmotionColor,
  getRecommendationsByEmotion,
  getLatestSeasonalAnime // <-- Nueva importación
} from './api.js';

// --- Elementos DOM ---
const searchBar = document.querySelector('.search-bar input');
const suggestionsContainer = document.getElementById('search-suggestions');
const animeSlideContainer = document.querySelector('.anime-slide .anime');
const animeCardsContainer = document.getElementById('popular-cards'); // ID actualizado en HTML
const animeTypes = document.querySelectorAll('.anime-type');
const filterButton = document.querySelector('.filter-button');
const emotionCategories = document.querySelectorAll('.emotion');
const slideLoading = document.getElementById('slide-loading');
const cardsLoading = document.getElementById('cards-loading');
const paginationControlsContainer = document.getElementById('pagination-controls');
// Nuevos elementos para la sección de lanzamientos
const latestReleasesContainer = document.getElementById('latest-releases-cards'); // <-- Nuevo
const latestReleasesLoading = document.getElementById('latest-releases-loading'); // <-- Nuevo

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
let bannerSlides = []; // Array para guardar los elementos slide
let bannerDots = []; // Array para guardar los puntos
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
  showLoading(slideLoading, "Cargando destacados...");
  showLoading(cardsLoading, "Cargando populares...");
  // Mostrar carga inicial para la nueva sección
  if (latestReleasesLoading) showLoading(latestReleasesLoading, "Cargando últimos lanzamientos...");

  try {
    await Promise.all([
      loadFeaturedAnime(),
      loadPopularAnime(),
      loadLatestReleases() // <-- Llamada a la nueva función
    ]);
    setupEventListeners();
  } catch (error) {
    console.error('Error inicializando la aplicación:', error);
    showErrorMessage('Error cargando datos iniciales. Intenta recargar.');
  } finally {
      hideLoading(slideLoading);
      hideLoading(cardsLoading);
      // Ocultar carga de la nueva sección
      if (latestReleasesLoading) hideLoading(latestReleasesLoading);
  }
}

// --- Cargar Slider (Usa Jikan - getSeasonalAnime) ---
async function loadFeaturedAnime() {
  const slideLoadingIndicator = document.getElementById('slide-loading'); // Asegúrate que el ID es correcto
  const bannerSlidesContainer = document.getElementById('banner-slides-content');

  if (!bannerSlidesContainer || !slideLoadingIndicator) {
      console.error("Elementos del banner no encontrados");
      // Ocultar loading si existe aunque falle
      if (slideLoadingIndicator) hideLoading(slideLoadingIndicator);
      return;
  }

  showLoading(slideLoadingIndicator, "Cargando destacados...");
  try {
      // Usamos getSeasonalAnime con un límite pequeño (ej. 5)
      const seasonalData = await getSeasonalAnime(undefined, undefined, 5);

      if (seasonalData?.data && seasonalData.data.length > 0) {
         setupBannerSlider(seasonalData.data); // Llama a la nueva función de configuración
      } else {
         bannerSlidesContainer.innerHTML = '<p style="color: white; text-align: center; padding: 50px;">No se encontraron animes destacados.</p>';
      }
  } catch (error) {
      console.error('Error cargando anime para banner (Jikan):', error);
      if (bannerSlidesContainer) bannerSlidesContainer.innerHTML = '<p style="color: white; text-align: center; padding: 50px;">Error al cargar destacados.</p>';
      showErrorMessage('Error al cargar destacados para banner.');
  } finally {
      hideLoading(slideLoadingIndicator);
  }
}
function setupBannerSlider(animes) {
  const slidesContainer = document.getElementById('banner-slides-content');
  const dotsContainer = document.getElementById('banner-dots-container');
  const prevButton = document.getElementById('banner-prev');
  const nextButton = document.getElementById('banner-next');

  if (!slidesContainer || !dotsContainer || !prevButton || !nextButton) {
      console.error("Faltan elementos para inicializar el banner slider.");
      return;
  }

  slidesContainer.innerHTML = ''; // Limpiar slides anteriores
  dotsContainer.innerHTML = ''; // Limpiar dots anteriores
  bannerSlides = []; // Limpiar array de slides
  bannerDots = []; // Limpiar array de dots
  currentBannerIndex = 0; // Resetear índice

  // Crear los slides y los dots
  animes.forEach((anime, index) => {
      // Crear Slide
      const slide = document.createElement('div');
      slide.classList.add('banner-slide');
      // Imagen de fondo: usar la imagen 'large' si está disponible
      const imageUrl = anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || '';
      if (imageUrl) {
          slide.style.backgroundImage = `url('${imageUrl}')`;
      }

      // Contenido del slide
      slide.innerHTML = `
          <div class="banner-overlay"></div>
          <div class="banner-content">
              <span class="banner-spotlight">#${index + 1} Spotlight</span>
              <h2 class="banner-title">${anime.title || 'Título no disponible'}</h2>
              <div class="banner-meta">
                  <span>${anime.type || 'N/A'}</span>
                  ${anime.duration ? `<span>${anime.duration}</span>` : ''}
                  ${anime.aired?.string ? `<span>${anime.aired.string}</span>` : ''}
                  ${anime.rating ? `<span>${anime.rating}</span>` : ''}
                  ${/* Podrías añadir más info como score aquí */''}
                  ${anime.score ? `<span>★ ${anime.score.toFixed(1)}</span>` : ''}
              </div>
              <p class="banner-synopsis">${truncateText(anime.synopsis, 150)}</p>
              <div class="banner-actions">
                  <button class="btn btn-detail" data-id="${anime.mal_id}">Detalles</button>
              </div>
          </div>
      `;
      slidesContainer.appendChild(slide);
      bannerSlides.push(slide);

      // Crear Dot
      const dot = document.createElement('button');
      dot.classList.add('banner-dot');
      dot.dataset.index = index; // Guardar índice para el clic
      dotsContainer.appendChild(dot);
      bannerDots.push(dot);

      // Añadir listener al botón de detalles dentro del slide
      const detailButton = slide.querySelector('.btn-detail');
      if (detailButton) {
          detailButton.addEventListener('click', function() {
              handleShowDetails(this.dataset.id);
          });
      }
  });

  // Función para mostrar un slide específico
  function showSlide(index) {
      bannerSlides.forEach((slide, i) => {
          slide.classList.toggle('active', i === index); // Añade/quita 'active'
      });
      bannerDots.forEach((dot, i) => {
          dot.classList.toggle('active', i === index); // Activa el dot correspondiente
      });
      currentBannerIndex = index; // Actualiza el índice global
  }

  // Funciones para navegar
  function nextSlide() {
      let newIndex = (currentBannerIndex + 1) % bannerSlides.length;
      showSlide(newIndex);
  }

  function prevSlide() {
      let newIndex = (currentBannerIndex - 1 + bannerSlides.length) % bannerSlides.length;
      showSlide(newIndex);
  }

  // Event listeners para flechas
  prevButton.addEventListener('click', () => {
      prevSlide();
      resetBannerInterval(); // Reiniciar timer al navegar manualmente
  });
  nextButton.addEventListener('click', () => {
      nextSlide();
      resetBannerInterval(); // Reiniciar timer al navegar manualmente
  });

  // Event listeners para dots
  bannerDots.forEach(dot => {
      dot.addEventListener('click', (e) => {
          const index = parseInt(e.target.dataset.index, 10);
          showSlide(index);
          resetBannerInterval(); // Reiniciar timer al navegar manualmente
      });
  });

  // Intervalo para cambio automático
  function startBannerInterval() {
      // Limpiar intervalo anterior si existe
      clearInterval(bannerInterval);
      bannerInterval = setInterval(nextSlide, 6000); // Cambiar cada 6 segundos (ajusta)
  }

  function resetBannerInterval() {
      clearInterval(bannerInterval);
      bannerInterval = setInterval(nextSlide, 6000);
  }

  // Mostrar el primer slide inicialmente y empezar intervalo
  if (bannerSlides.length > 0) {
      showSlide(0);
      startBannerInterval();
  }

  // Pausar al pasar el ratón por encima (opcional)
  slidesContainer.addEventListener('mouseenter', () => clearInterval(bannerInterval));
  slidesContainer.addEventListener('mouseleave', startBannerInterval);
}

// --- Actualizar Slider ---
function updateAnimeSlide(animes) {
  if (!animeSlideContainer) return;
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
            <span class="emotion-tag ${getEmotionColor(emotion1)}">${getEmotionName(emotion1)}</span>
            ${emotion2 ? `<span class="emotion-tag ${getEmotionColor(emotion2)}">${getEmotionName(emotion2)}</span>` : ''}
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

// --- Cargar Populares Iniciales (Usa Jikan - getPopularAnime) ---
async function loadPopularAnime() {
  // Carga en el contenedor principal de tarjetas populares/filtradas
  if (!animeCardsContainer) return;
  try {
    const popularData = await getPopularAnime(20); // Pide 20 populares
    if (popularData?.data) {
      displayAnimeCards(popularData.data, animeCardsContainer); // Especifica el contenedor
    } else {
      animeCardsContainer.innerHTML = '<div class="no-results">No se encontraron animes populares.</div>';
    }
  } catch (error) {
    console.error('Error cargando anime popular (Jikan):', error);
    animeCardsContainer.innerHTML = '<div class="no-results">Error al cargar populares.</div>';
  } finally {
      hideLoading(cardsLoading); // Se oculta en initApp
  }
}

// --- NUEVA FUNCIÓN: Cargar Últimos Lanzamientos ---
// En main.js - DENTRO de la función loadLatestReleases

async function loadLatestReleases() {
  if (!latestReleasesContainer || !latestReleasesLoading) return;

  showLoading(latestReleasesLoading, "Cargando últimos lanzamientos...");
  try {
      // --- CAMBIO AQUÍ ---
      // Llamamos a getSeasonalAnime en lugar de getLatestSeasonalAnime
      // Pedimos un número razonable de items para el scroll horizontal, ej: 15
      const responseData = await getSeasonalAnime(undefined, undefined, 15); // Usa getSeasonalAnime con límite 15

      if (responseData?.data && responseData.data.length > 0) {
          // Pasamos directamente responseData.data que es la lista
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


// --- Mostrar Tarjetas (MODIFICADA para aceptar contenedor) ---
function displayAnimeCards(animes, container = animeCardsContainer) { // Añadido parámetro container
  if (!container) {
      console.error("Contenedor para mostrar tarjetas no válido");
      return;
  }
  container.innerHTML = ''; // Limpia el contenedor específico
   if (!animes || animes.length === 0) {
      // No poner mensaje aquí, la función que llama decide
      return;
  }
  animes.forEach(anime => {
    if (!anime?.mal_id || !anime.title) {
      console.warn('Datos insuficientes para mostrar tarjeta:', anime);
      return;
    }
    // Determina las emociones (Jikan vs Backend)
    const emotionTags = anime.Emotions && Array.isArray(anime.Emotions) && anime.Emotions.length > 0
                        ? anime.Emotions // Si viene del backend
                        : (anime.genres ? assignEmotions(anime.genres) : ['epic', 'wonder']); // Si viene de Jikan
    const emotion1 = emotionTags[0] || 'epic';
    const emotion2 = emotionTags[1] || null;

    const imageUrl = anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || '';
    const synopsisText = anime.synopsis || 'Sin descripción.';
    const scoreValue = typeof anime.score === 'number' ? anime.score : parseFloat(anime.score);
    const scoreText = !isNaN(scoreValue) ? scoreValue.toFixed(1) + '/10' : 'N/A';
    const votersText = anime.scored_by ? '(' + formatNumber(anime.scored_by) + ' votos)' : '';
    // Adaptar nombre de estudio (Jikan usa 'studios', tu backend 'studio' quizás?)
    const studioText = Array.isArray(anime.studios) && anime.studios.length > 0
                       ? anime.studios[0]?.name
                       : (anime.studio || 'Studio desconocido'); // Fallback

    const animeCardHTML = `
      <div class="anime-card" data-id="${anime.mal_id}">
        <div class="content-wrapper">
          ${imageUrl ? `<img src="${imageUrl}" alt="${anime.title}" class="anime-card-img" loading="lazy">` : '<div class="anime-card-img" style="background:#eee; height:200px; display:flex; align-items:center; justify-content:center; color:#aaa;">Sin Imagen</div>'}
          <div class="card-content">
            <div class="anime-name">${anime.title}</div>
            <div class="anime-by">by ${studioText}</div>
            <span class="emotion-tag ${getEmotionColor(emotion1)}">${getEmotionName(emotion1)}</span>
            ${emotion2 ? `<span class="emotion-tag ${getEmotionColor(emotion2)}">${getEmotionName(emotion2)}</span>` : ''}
            <div class="anime-sum">${truncateText(synopsisText, 100)}</div>
          </div>
        </div>
        <div class="likes">
          <div class="like-name"><span>${scoreText}</span> ${votersText}</div>
        </div>
      </div>`;
    container.innerHTML += animeCardHTML; // Añade al contenedor específico
  });
  // Añadir listeners al contenedor específico
  container.querySelectorAll('.anime-card').forEach(card => {
    card.addEventListener('click', function() { handleShowDetails(this.dataset.id); });
  });
}

// --- Mostrar Controles de Paginación ---
function displayPaginationControls(paginationInfo, context) {
    // ... (Sin cambios en esta función) ...
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
        if (!paginationInfo || (!paginationInfo.pagination?.last_visible_page && !paginationInfo.total_pages) || Math.max(paginationInfo.pagination?.last_visible_page || 0, paginationInfo.total_pages || 0) <= 1) {
             return;
        }
        console.warn("Estructura de paginación inesperada:", paginationInfo, "Contexto:", context);
        currentPage = paginationInfo.current_page || paginationInfo.pagination?.current_page || 1;
        totalPages = paginationInfo.total_pages || paginationInfo.pagination?.last_visible_page || 1;
        hasNextPage = paginationInfo.pagination?.has_next_page || (currentPage < totalPages);
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
  // ... (Sin cambios en esta función) ...
   if (!suggestionsContainer) return;
  suggestionsContainer.innerHTML = '';

  if (!animes || animes.length === 0) {
    hideSuggestions();
    return;
  }

  animes.forEach(anime => {
    if (!anime?.mal_id || !anime.title) return;
    const item = document.createElement('div');
    item.classList.add('suggestion-item');
    item.dataset.id = anime.mal_id;

    const imgUrl = anime.images?.jpg?.image_url || '';
    const title = anime.title;

    item.innerHTML = `
      ${imgUrl ? `<img src="${imgUrl}" alt="" loading="lazy">` : '<div style="width:40px; height:55px; background:#eee; margin-right:10px; border-radius:4px;"></div>'}
      <span>${title}</span>
    `;

    item.addEventListener('click', () => {
      searchBar.value = title;
      hideSuggestions();
      handleShowDetails(anime.mal_id); // Ir a detalles al hacer clic
    });

    suggestionsContainer.appendChild(item);
  });

  suggestionsContainer.style.display = 'block';
}

function hideSuggestions() {
  // ... (Sin cambios en esta función) ...
  if (suggestionsContainer) {
    suggestionsContainer.style.display = 'none';
  }
}

async function handleAutocompleteSearch(query) {
  // ... (Sin cambios en esta función) ...
   if (query.length < 3) {
    hideSuggestions();
    return;
  }
  console.log(`Buscando sugerencias para: ${query}`);
  try {
    const results = await searchAnime(query, 5); // Jikan, límite 5
    if (results?.data) {
      showSuggestions(results.data);
    } else {
      hideSuggestions();
    }
  } catch (error) {
    console.error('Error buscando sugerencias:', error);
    hideSuggestions();
  }
}

const debouncedAutocompleteSearch = debounce(handleAutocompleteSearch, 400);

// --- Setup Event Listeners ---
function setupEventListeners() {
  // Búsqueda: Enter
  if (searchBar) {
      searchBar.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && this.value.trim()) {
          const query = this.value.trim();
          hideSuggestions();
          console.log(`Redirigiendo a página de búsqueda para: ${query}`);
          window.location.href = `search.html?q=${encodeURIComponent(query)}`;
        }
      });

      // Búsqueda: Input (Autocompletado)
      searchBar.addEventListener('input', function() {
        const query = this.value.trim();
        if (query.length === 0) {
          hideSuggestions();
        } else if (query.length >= 3) {
          debouncedAutocompleteSearch(query);
        } else {
          hideSuggestions();
        }
      });
  }

  // Ocultar sugerencias al hacer clic fuera
  document.addEventListener('click', function(event) {
      // Asegurarse que searchBar y suggestionsContainer existen antes de usarlos
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
          // Por ahora, solo filtra por la primera emoción seleccionada
          handleEmotionFilter([selectedEmotionTags[0]], 1);
        } else {
          showErrorMessage('Selecciona al menos una emoción para filtrar.');
        }
      });
  }


  // Selección Emoción
  emotionCategories.forEach(emotion => {
    emotion.addEventListener('click', function() {
        // Deseleccionar otras emociones si solo quieres permitir una selección
        // document.querySelectorAll('.emotion.selected').forEach(el => el.classList.remove('selected'));
        this.classList.toggle('selected');
    });
  });
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

// --- Búsqueda Completa (Ahora manejada por search.html) ---
// async function handleSearch(query) { ... } // Esta función ya no se usa aquí

// --- Filtro Género (CON PAGINACIÓN) ---
// En main.js - Reemplaza la función handleGenreFilter completa

async function handleGenreFilter(genreName, page = 1) {
  currentFilterType = 'genre';
  currentGenrePage = page;
  currentGenreName = genreName;

  if (!animeCardsContainer || !cardsLoading) return;

  showLoading(cardsLoading, `Cargando ${genreName} (Pág. ${page})...`);
  animeCardsContainer.innerHTML = ''; // Limpia contenedor de populares/género
  if (paginationControlsContainer) paginationControlsContainer.innerHTML = '';

  // Mapeo de géneros
  const genreMap = { 'Todos': 0, 'Acción': 1, 'Drama': 8, 'Romance': 22, 'Comedia': 4, 'Fantasía': 10 };
  const genreId = genreMap[genreName];
  currentGenreId = genreId;

  try {
      let responseData;

      if (genreName === 'Todos') {
          // Llama a una función de api.js para populares (o crea una específica si prefieres paginación distinta)
          // Usaremos getPopularAnime aquí por simplicidad, aunque no soporte paginación directa en la llamada actual
          // Para paginación de "Todos", necesitarías una función en api.js que llame a /top/anime con page/limit
          console.log(`Fetching from Jikan (All Genres - Popular - Page ${page})`);
          // !! CORRECCIÓN: getPopularAnime no toma page. Necesitamos llamar a searchAnime sin query o adaptar/crear una función en api.js
          // Solución temporal: Usar searchAnime sin query para obtener populares paginados
           responseData = await searchAnime('', 20, page, { order_by: 'popularity', sort: 'asc' }); // Busca "todos" ordenados por popularidad

      } else if (genreId !== undefined) {
          // Llama a la función existente en api.js para géneros específicos
          console.log(`Fetching from Jikan (Genre ${genreId} - Page ${page})`);
          responseData = await getAnimeByGenre(genreId, 20, page);
      } else {
          console.warn(`Género "${genreName}" no mapeado.`);
          showErrorMessage(`Género "${genreName}" no reconocido.`);
          // Fallback: Cargar populares sin paginación y resetear
          responseData = await getPopularAnime(20); // Carga populares iniciales
          clearPaginationState();
          document.querySelector('.anime-type.active')?.classList.remove('active');
          document.querySelector('.anime-type:first-child')?.classList.add('active'); // Activa "Todos"
      }

      // El resto del procesamiento de responseData es igual...
      if (responseData && responseData.data && responseData.pagination) {
          const animeList = responseData.data;
          // Asegurarse que Jikan devolvió last_visible_page
          totalGenrePages = responseData.pagination.last_visible_page || 1;
          if (animeList.length > 0) {
              displayAnimeCards(animeList, animeCardsContainer); // Especifica contenedor
              displayPaginationControls(responseData, 'genre'); // Usa la paginación de Jikan
          } else {
              if (page === 1) {
                  animeCardsContainer.innerHTML = `<div class="no-results">No se encontraron animes para ${genreName}.</div>`;
              } else {
                  animeCardsContainer.innerHTML = `<div class="no-results">No hay más resultados (Pág. ${page}) para ${genreName}.</div>`;
                  displayPaginationControls(responseData, 'genre');
              }
          }
      } else if (responseData && responseData.data && !responseData.pagination && page === 1) {
          displayAnimeCards(responseData.data, animeCardsContainer);
          console.warn("Respuesta Jikan sin información de paginación.");
          if (paginationControlsContainer) paginationControlsContainer.innerHTML = ''; // Limpia paginación si no hay
      } else {
           // Si responseData o responseData.data no existen, o falta paginación y no es la página 1
          if(page === 1) {
              animeCardsContainer.innerHTML = `<div class="no-results">No se encontraron resultados para ${genreName}.</div>`;
          } else {
               animeCardsContainer.innerHTML = `<div class="no-results">No hay más resultados (Pág. ${page}) para ${genreName}.</div>`;
              // Intenta mostrar controles igual por si es un error parcial
              if (responseData?.pagination) displayPaginationControls(responseData, 'genre');
          }
         // throw new Error(`La respuesta de Jikan para ${genreName} (Pág. ${page}) no tiene el formato esperado.`);
         console.warn(`Respuesta Jikan incompleta para ${genreName} (Pág. ${page}):`, responseData);
      }
  } catch (error) {
      console.error(`Error filtrando por género ${genreName} (Pág. ${page}):`, error);
      // Comprueba si el error es el ReferenceError específico
      if (error instanceof ReferenceError && error.message.includes("JIKAN_BASE_URL")) {
           showErrorMessage(`Error interno al construir la solicitud para ${genreName}.`);
      } else {
          showErrorMessage(`Error al filtrar por ${genreName}: ${error.message}`);
      }
      animeCardsContainer.innerHTML = `<div class="no-results">Error al filtrar por género. <br><small>${error.message}</small></div>`;
      clearPaginationState();
  } finally {
      hideLoading(cardsLoading);
  }
}

// --- Filtro Emoción (CON PAGINACIÓN - usa Backend Local) ---
async function handleEmotionFilter(selectedTags, page = 1) {
    // ... (Sin cambios significativos, pero usa el contenedor correcto) ...
    currentFilterType = 'emotion';
    const emotionTag = selectedTags[0]; // Tomamos solo la primera por ahora
    currentEmotionTag = emotionTag;
    currentEmotionPage = page;

    if (!animeCardsContainer || !cardsLoading) return;

    showLoading(cardsLoading, `Buscando animes (Pág. ${page}) con emoción: ${getEmotionName(emotionTag)}...`);
    animeCardsContainer.innerHTML = ''; // Limpia contenedor de populares/emoción
    if (paginationControlsContainer) paginationControlsContainer.innerHTML = '';
    console.log(`Usando API local para buscar emoción: ${emotionTag}, Página: ${page}`);

    try {
        // Llama al backend local
        const responseData = await getRecommendationsByEmotion(emotionTag, page, 20);

        if (responseData && responseData.recommendations && responseData.pagination) {
            const recommendations = responseData.recommendations;
            const paginationInfo = responseData.pagination;
            totalEmotionPages = paginationInfo.total_pages;

            if (recommendations.length > 0) {
                 // Mapear datos del backend al formato esperado por displayAnimeCards
                 const mappedRecommendations = recommendations.map(anime_backend => {
                    return {
                        mal_id: anime_backend.mal_id,
                        title: anime_backend.title,
                        images: { jpg: { image_url: anime_backend.thumbnailURL || anime_backend.Image_URL || '', large_image_url: anime_backend.Image_URL || anime_backend.thumbnailURL || ''}},
                        studios: anime_backend.studio ? [{ name: anime_backend.studio }] : [], // Simula estructura Jikan
                        genres: anime_backend.genre ? anime_backend.genre.split(',').map(g=>({name: g.trim()})) : [], // Simula estructura Jikan
                        score: anime_backend.rating,
                        scored_by: null, // No tenemos esta info del backend local
                        synopsis: anime_backend.Synopsis || 'Descripción no disponible.',
                        Emotions: anime_backend.Emotions ? anime_backend.Emotions.split(',') : [] // Pasa las emociones asignadas por el backend
                    };
                });
                displayAnimeCards(mappedRecommendations, animeCardsContainer); // Especifica contenedor
                displayPaginationControls(paginationInfo, 'emotion');
            } else {
                 if (page === 1) {
                    animeCardsContainer.innerHTML = `<div class="no-results">No se encontraron animes para la emoción: ${getEmotionName(emotionTag)}.</div>`;
                 } else {
                     animeCardsContainer.innerHTML = `<div class="no-results">No hay más resultados (Pág. ${page}).</div>`;
                     displayPaginationControls(paginationInfo, 'emotion');
                 }
            }
        } else {
             throw new Error("La respuesta del backend no tiene el formato esperado.");
        }
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
  // ... (Sin cambios) ...
   const existingError = document.querySelector('.error-message');
  if (existingError) { existingError.remove(); }
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.textContent = message;
  document.body.insertAdjacentElement('beforeend', errorDiv);
  // Force reflow to enable transition
  errorDiv.offsetHeight;
  errorDiv.classList.add('show');
  // Remove after animation
  setTimeout(() => {
      errorDiv.classList.remove('show');
      // Remove from DOM after transition ends
      errorDiv.addEventListener('transitionend', () => errorDiv.remove(), { once: true });
  }, 3500); // Match timeout with CSS transition duration + delay
}

function truncateText(text, maxLength) {
  // ... (Sin cambios) ...
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

function formatNumber(num) {
  // ... (Sin cambios) ...
  const number = Number(num);
  if (isNaN(number)) { return '0'; } // O devolver '' o 'N/A'
  // Formato chileno
  return new Intl.NumberFormat('es-CL').format(number);
}

function capitalize(str) {
  // ... (Sin cambios) ...
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// --- Iniciar la aplicación ---
document.addEventListener('DOMContentLoaded', initApp);