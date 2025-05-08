// main.js

// ==================================================
// --- IMPORTACIONES ---
// ==================================================
import {
  searchAnime,
  getPopularAnime,
  getSeasonalAnime,
  getAnimeDetails, // Puede ser necesaria en funciones no incluidas aquí si las tienes
  getAnimeByGenre,
  assignEmotions,
  getEmotionName,
  getEmotionColor,
  getRecommendationsByEmotion, // Puede ser necesaria en funciones no incluidas aquí
  getLatestSeasonalAnime,    // Usada por loadLatestReleases (ahora es getSeasonalAnime)
  getCustomRanking
} from './api.js';

// ==================================================
// --- ELEMENTOS DOM ---
// ==================================================
const searchBar = document.querySelector('.search-bar input');
const suggestionsContainer = document.getElementById('search-suggestions');
const bannerSlidesContainer = document.getElementById('banner-slides-content');
const bannerDotsContainer = document.getElementById('banner-dots-container');
const bannerPrevButton = document.getElementById('banner-prev');
const bannerNextButton = document.getElementById('banner-next');
const slideLoading = document.getElementById('slide-loading'); // Loading para el banner
const animeCardsContainer = document.getElementById('popular-cards'); // Para populares por género
const animeTypes = document.querySelectorAll('.anime-type');
const filterButton = document.querySelector('.filter-button');
const emotionCategories = document.querySelectorAll('.emotion');
const cardsLoading = document.getElementById('cards-loading'); // Loading para la sección principal de tarjetas
const paginationControlsContainer = document.getElementById('pagination-controls');
const latestReleasesContainer = document.getElementById('latest-releases-cards');
const latestReleasesLoading = document.getElementById('latest-releases-loading');
const headerElement = document.querySelector('.header');
const topRankedContainer = document.getElementById('top-ranked-cards'); // Para la sección "Top 10 Animes"
const topRankedLoading = document.getElementById('top-ranked-loading'); // Loading para "Top 10 Animes"

// ==================================================
// --- VARIABLES DE ESTADO ---
// ==================================================
let currentFilterType = null;
let currentEmotionPage = 1;
let totalEmotionPages = 0;
let currentEmotionTag = null;
let currentGenrePage = 1;
let totalGenrePages = 0;
let currentGenreId = null;
let currentGenreName = null;
let debounceTimer;
let bannerSlides = [];
let bannerDots = [];
let currentBannerIndex = 0;
let bannerInterval;
const localBannerImages = {
  // IDs reales de anime/manga (¡VERIFICA ESTOS IDs!):
  51818: 'Img/Fire-Force-Season-3.webp', // Fire Force Season 3
  59160: 'Img/WindBreaker.jpg',          // WindBreaker (Anime)
  56038: 'Img/Lazarus.avif',             // Lazarus (Anime)
  59597: 'Img/WITCH WATCH.jpg',         // WITCH WATCH (ID de Manga: 119641. Si hay ID de anime, usa ese)
  60146: 'Img/TBATE.jpg',                 // Para "Saikyou no Ousama, Nidome no Jinsei wa Nani wo Suru?"
                                         // (Imagen que parece ser de "The Beginning After The End")
};
// ==================================================
// --- FUNCIONES HELPER ---
// ==================================================

function debounce(func, delay) {
  return function(...args) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}

function showLoading(element, message = "Cargando...") {
  if (element) {
    element.textContent = message;
    element.classList.add('show');
  } else {
    // console.warn("Intento de mostrar loading en elemento nulo.");
  }
}

function hideLoading(element) {
  if (element) {
    element.classList.remove('show');
  } else {
    // console.warn("Intento de ocultar loading en elemento nulo.");
  }
}

function truncateText(text, maxLength) {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

function formatNumber(num) {
  const number = Number(num);
  if (isNaN(number)) { return 'N/A'; }
  return new Intl.NumberFormat('es-CL').format(number); // Formato chileno para números
}

function showErrorMessage(message) {
   const existingError = document.querySelector('.error-message');
  if (existingError) { existingError.remove(); } // Remover errores previos
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.textContent = message;
  document.body.insertAdjacentElement('beforeend', errorDiv);
  // Forzar reflow para activar la transición de entrada
  errorDiv.offsetHeight;
  errorDiv.classList.add('show');
  // Ocultar y remover después de un tiempo
  setTimeout(() => {
      errorDiv.classList.remove('show');
      // Esperar que termine la transición de salida antes de remover del DOM
      errorDiv.addEventListener('transitionend', () => errorDiv.remove(), { once: true });
  }, 3500); // Mensaje visible por 3.5 segundos
}

function handleShowDetails(animeId) {
  if (!animeId) {
      console.error("ID de anime no proporcionado para detalles.");
      showErrorMessage("Error interno: No se pudo obtener el ID para ver detalles.");
      return;
  }
  window.location.href = `detalle.html?id=${animeId}`;
}

function hideSuggestions() {
  if (suggestionsContainer) {
      suggestionsContainer.style.display = 'none';
      suggestionsContainer.innerHTML = ''; // Limpiar contenido también
  }
}

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
    // Opcional: Deseleccionar filtros activos visualmente
    document.querySelector('.anime-type.active')?.classList.remove('active');
    document.querySelector('.emotion.selected')?.classList.remove('selected');
}

// ==================================================
// --- LÓGICA AUTOCOMPLETADO BÚSQUEDA ---
// ==================================================

function showSuggestions(animes) {
  if (!suggestionsContainer) return;
  suggestionsContainer.innerHTML = '';
  if (!animes || animes.length === 0) {
      hideSuggestions(); // Ocultar si no hay resultados
      return;
  }

  // Limitar número de sugerencias mostradas (ej. 5)
  animes.slice(0, 5).forEach(anime => {
    if (!anime?.mal_id || !anime.title) return; // Saltar si faltan datos clave

    const item = document.createElement('div');
    item.classList.add('suggestion-item');
    item.dataset.id = anime.mal_id;

    const imgUrl = anime.images?.jpg?.image_url || ''; // Usar imagen pequeña para sugerencias
    const title = anime.title;

    item.innerHTML = `
      ${imgUrl ? `<img src="${imgUrl}" alt="" loading="lazy" onerror="this.onerror=null; this.src='./img/placeholder-card.png';">` : '<div class="suggestion-placeholder-img"></div>'}
      <span>${title}</span>
    `;

    // Event listener para clic en sugerencia
    item.addEventListener('click', () => {
      if(searchBar) searchBar.value = title; // Opcional: Poner título en la barra
      hideSuggestions();
      handleShowDetails(anime.mal_id); // Ir a detalles
    });
    suggestionsContainer.appendChild(item);
  });

  suggestionsContainer.style.display = 'block'; // Mostrar contenedor
}

async function handleAutocompleteSearch(query) {
   if (query.length < 3) { // No buscar si la query es muy corta
       hideSuggestions();
       return;
   }
  try {
    const results = await searchAnime(query, 5); // Limitar búsqueda a 5 resultados para sugerencias
    if (results?.data) {
        showSuggestions(results.data);
    } else {
        hideSuggestions();
    }
  } catch (error) {
    console.error('Error buscando sugerencias:', error);
    // Opcional: Podrías mostrar un mensaje en el contenedor de sugerencias
    // if (suggestionsContainer) suggestionsContainer.innerHTML = '<div class="suggestion-error">Error al buscar</div>';
    hideSuggestions(); // Ocultar en caso de error
  }
}

// Crear la versión debounced de la función de búsqueda
const debouncedAutocompleteSearch = debounce(handleAutocompleteSearch, 400); // 400ms delay

// ==================================================
// --- FUNCIONES PARA MOSTRAR CONTENIDO PRINCIPAL ---
// ==================================================

/**
 * Muestra tarjetas de anime en un contenedor específico.
 * Incluye la lógica para el tooltip que aparece al hacer hover.
 */
function displayAnimeCards(animes, container) {
  if (!container) {
      console.error("Error: El contenedor para mostrar las tarjetas es nulo o inválido.", container);
      return;
  }
  container.innerHTML = ''; // Limpiar contenido previo

  if (!animes || animes.length === 0) {
      // Mensaje específico según el contenedor
      let sectionName = 'esta sección';
      if (container.id === 'popular-cards') sectionName = 'Populares por Género';
      else if (container.id === 'latest-releases-cards') sectionName = 'Últimos Lanzamientos';
      else if (container.id === 'top-ranked-cards') sectionName = 'Top Animes';
      container.innerHTML = `<div class="no-results">No hay animes para mostrar en ${sectionName}.</div>`;
      return;
  }

  animes.forEach(anime => {
      // Validación mínima de datos del anime
      if (!anime?.mal_id || !anime.title) {
          console.warn('Advertencia: Datos insuficientes para mostrar tarjeta, anime omitido:', anime);
          return; // Saltar este anime
      }

      // Obtener datos de la tarjeta
      const imageUrl = anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || './img/placeholder-card.png';
      const title = anime.title;
      const malId = anime.mal_id;

      // Crear el elemento principal de la tarjeta
      const card = document.createElement('div');
      card.className = 'anime-card'; // Clase principal para estilos y tooltip
      card.dataset.id = malId; // Guardar ID para navegación

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

      // Datos para el Tooltip
      const scoreValue = parseFloat(anime.score);
      const scoreText = !isNaN(scoreValue) ? scoreValue.toFixed(1) : 'N/A'; // Solo 1 decimal en tooltip?
      const typeText = anime.type || 'N/A';
      const episodesText = anime.episodes ? `${anime.episodes} ep.` : 'N/A ep.';
      let studioName = 'N/A';
      if (anime.studios && Array.isArray(anime.studios) && anime.studios.length > 0) {
          studioName = anime.studios[0]?.name || 'N/A';
      }
      const genres = anime.genres || [];
      const synopsis = anime.synopsis || anime.Synopsis || ''; // Compatibilidad con backend
      const synopsisShort = truncateText(synopsis, 90) || 'Sin descripción.'; // Más corto para tooltip

      const genresHTML = genres.slice(0, 3) // Máx 3 géneros en tooltip
                               .map(g => g ? `<span class="tag genre-tag">${g.name}</span>` : '') // Chequeo extra por si hay nulls
                               .join('');

      // Obtener/Asignar Emociones
      let emotionsHTML = '';
      if (anime.Emotions && typeof anime.Emotions === 'string') { // Campo 'Emotions' del backend
          emotionsHTML = anime.Emotions.split(',')
                             .slice(0, 2).map(e => e.trim()).filter(e => e)
                             .map(e => `<span class="tag emotion-tag ${getEmotionColor(e)}">${getEmotionName(e)}</span>`)
                             .join('');
      } else if (genres.length > 0) { // Calcular desde géneros (Jikan)
          const emotions = assignEmotions(genres);
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

      // Ensamblar la tarjeta y añadir listener
      card.innerHTML = visibleContentHTML + tooltipHTML;
      card.addEventListener('click', function() {
          handleShowDetails(this.dataset.id);
      });

      // Añadir la tarjeta al contenedor
      container.appendChild(card);
  });
}


/**
 * Configura el slider del banner superior.
 */
function setupBannerSlider(animes) {
  if (!bannerSlidesContainer || !bannerDotsContainer || !bannerPrevButton || !bannerNextButton) {
    console.error("Error: Elementos DOM para el banner no encontrados.");
    return;
  }

  bannerPrevButton.style.display = 'block';
  bannerNextButton.style.display = 'block';
  bannerDotsContainer.style.display = 'flex'; // Asegurar que los dots sean flexibles

  bannerSlidesContainer.innerHTML = '';
  bannerDotsContainer.innerHTML = '';
  bannerSlides = []; // Limpiar el array global
  bannerDots = [];   // Limpiar el array global
  currentBannerIndex = 0; // Resetear el índice global

  if (!animes || animes.length === 0) {
    console.warn("No hay animes válidos para mostrar en el banner.");
    if (bannerSlidesContainer) bannerSlidesContainer.innerHTML = '<p style="color: white; text-align: center; padding: 50px;">No se encontraron animes destacados.</p>';
    bannerPrevButton.style.display = 'none';
    bannerNextButton.style.display = 'none';
    bannerDotsContainer.style.display = 'none';
    return;
  }

  animes.forEach((anime, index) => {
    if (typeof anime.mal_id === 'undefined') { // Usamos la propiedad que tendrá el ID (real o ficticio)
        console.warn("Anime omitido en el banner por falta de mal_id (o id custom):", anime);
        return;
    }

    const slide = document.createElement('div');
    slide.classList.add('banner-slide');

    const infoPanel = document.createElement('div');
    infoPanel.classList.add('banner-info-panel');

    const title = anime.title || 'Título no disponible';
    // Usar la sinopsis directamente del objeto anime, que ya debería estar poblada (curada o de API)
    const synopsis = truncateText(anime.synopsis, 140);
    const type = anime.type || 'N/A';
    let duration = anime.duration || '';
    if (typeof duration === 'string') { // Asegurar que duration es string antes de usar .includes
        if (duration.includes('min per ep')) duration = duration.replace(' per ep', '');
        else if (duration.includes('hr')) duration = duration.replace('hr', 'h').replace('min', 'm');
    } else {
        duration = ''; // Si no es string, dejarlo vacío o N/A
    }

    // 'aired.string' puede no existir si es un objeto 'anime' curado sin todos los detalles de Jikan
    const airedString = anime.aired?.string || (anime.year ? anime.year.toString() : (anime.aired?.from ? new Date(anime.aired.from).getFullYear().toString() : ''));
    const rating = anime.rating || ''; // Clasificación (ej. PG-13)
    const score = anime.score ? (typeof anime.score === 'number' ? anime.score.toFixed(1) : anime.score.toString()) : '';
    const mal_id_current = anime.mal_id; // El ID del anime actual (puede ser real o ficticio)

    const genres = Array.isArray(anime.genres) ? anime.genres : [];
    const mainGenresHTML = genres.slice(0, 3)
                               .map(g => g?.name ? `<span class="banner-genre-tag">${g.name}</span>` : '')
                               .join('');
    const studioName = anime.studios && anime.studios.length > 0 && anime.studios[0]?.name ? anime.studios[0].name : '';

    const iconType = '<i class="fas fa-tv"></i>';
    const iconClock = '<i class="far fa-clock"></i>';
    const iconCalendar = '<i class="far fa-calendar-alt"></i>';
    const iconShield = '<i class="fas fa-user-shield"></i>';
    const iconStar = '<i class="fas fa-star"></i>';
    const iconStudio = '<i class="fas fa-film"></i>';

    infoPanel.innerHTML = `
        <span class="banner-spotlight">#${index + 1} Spotlight</span>
        <h2 class="banner-title">${title}</h2>
        ${studioName ? `<div class="banner-studio">${iconStudio} ${studioName}</div>` : ''}
        <div class="banner-meta">
            ${type ? `<span>${iconType} ${type}</span>` : ''}
            ${duration ? `<span>${iconClock} ${duration}</span>` : ''}
            ${airedString ? `<span>${iconCalendar} ${airedString}</span>` : ''}
            ${rating ? `<span>${iconShield} ${rating}</span>` : ''}
            ${score ? `<span class="score">${iconStar} ${score}</span>` : ''}
        </div>
        ${mainGenresHTML ? `<div class="banner-genres-container">${mainGenresHTML}</div>` : ''}
        <p class="banner-synopsis">${synopsis || 'Sin descripción disponible.'}</p>
        <div class="banner-actions">
            <button class="btn btn-detail" data-id="${mal_id_current}">Detalles</button>
        </div>
    `;

    const imagePanel = document.createElement('div');
    imagePanel.classList.add('banner-image-panel');

    const localImageSrc = localBannerImages[mal_id_current.toString()];
    const apiImageSrc = anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || '';

    if (localImageSrc) {
        console.log(`Usando imagen local para ${title} (ID: ${mal_id_current}): ${localImageSrc}`);
        imagePanel.style.backgroundImage = `url('${localImageSrc}')`;
    } else if (apiImageSrc) {
        console.log(`Usando imagen de API para ${title} (ID: ${mal_id_current}): ${apiImageSrc}`);
        imagePanel.style.backgroundImage = `url('${apiImageSrc}')`;
    } else {
        console.warn(`No se encontró imagen local ni de API para ${title} (ID: ${mal_id_current}). Usando placeholder.`);
        imagePanel.innerHTML = '<div class="placeholder" style="height:100%; width:100%; display:flex; align-items:center; justify-content:center; background-color: rgba(0,0,0,0.2); color: rgba(255,255,255,0.7);">Sin Imagen</div>';
    }

    slide.appendChild(infoPanel);
    slide.appendChild(imagePanel);
    bannerSlidesContainer.appendChild(slide);
    bannerSlides.push(slide);

    const dot = document.createElement('button');
    dot.classList.add('banner-dot');
    dot.dataset.index = index; // Asegurar que el índice se guarda como string o se parsea luego
    bannerDotsContainer.appendChild(dot);
    bannerDots.push(dot);

    const detailButton = infoPanel.querySelector('.btn-detail');
    if (detailButton) {
        detailButton.addEventListener('click', function() {
            handleShowDetails(this.dataset.id); // handleShowDetails ya tiene la lógica para IDs ficticios
        });
    }
  });

  // Lógica interna del Slider (showSlide, nextSlide, prevSlide, start/resetBannerInterval)
  // Es importante que bannerInterval se declare en un scope accesible por estas funciones si es necesario
  let bannerInterval;

  function showSlide(indexToShow) {
    if (bannerSlides.length === 0 || indexToShow < 0 || indexToShow >= bannerSlides.length) return;

    bannerSlides.forEach((slideEl, i) => {
      slideEl.classList.toggle('active', i === indexToShow);
    });
    bannerDots.forEach((dotEl, i) => {
      dotEl.classList.toggle('active', i === indexToShow);
    });
    currentBannerIndex = indexToShow;
  }

  function nextSlide() {
    if (bannerSlides.length === 0) return;
    let newIndex = (currentBannerIndex + 1) % bannerSlides.length;
    showSlide(newIndex);
  }

  function prevSlide() {
    if (bannerSlides.length === 0) return;
    let newIndex = (currentBannerIndex - 1 + bannerSlides.length) % bannerSlides.length;
    showSlide(newIndex);
  }

  function startBannerInterval() {
    if (bannerSlides.length > 1) { // Solo si hay más de 1 slide
        clearInterval(bannerInterval); // Limpiar intervalo existente
        bannerInterval = setInterval(nextSlide, 7000); // 7 segundos
    }
  }

  function resetBannerInterval() {
    clearInterval(bannerInterval);
    if (bannerSlides.length > 1) { // Solo si hay más de 1 slide
        bannerInterval = setInterval(nextSlide, 7000);
    }
  }

  // Asignar listeners a controles
  if(bannerPrevButton) bannerPrevButton.onclick = () => { prevSlide(); resetBannerInterval(); };
  if(bannerNextButton) bannerNextButton.onclick = () => { nextSlide(); resetBannerInterval(); };

  bannerDots.forEach(dot => {
    dot.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index, 10); // Parsear a número
        if (!isNaN(index)) {
            showSlide(index);
            resetBannerInterval();
        }
    });
  });

  // Iniciar slider si se crearon slides
  if (bannerSlides.length > 0) {
    showSlide(0); // Mostrar primer slide
    startBannerInterval(); // Empezar rotación automática

    // Pausar en hover
    if (bannerSlidesContainer) {
        bannerSlidesContainer.addEventListener('mouseenter', () => clearInterval(bannerInterval));
        bannerSlidesContainer.addEventListener('mouseleave', startBannerInterval);
    }
  } else {
      // Asegurarse de ocultar controles si al final no hubo slides válidos
      if(bannerPrevButton) bannerPrevButton.style.display = 'none';
      if(bannerNextButton) bannerNextButton.style.display = 'none';
      if(bannerDotsContainer) bannerDotsContainer.style.display = 'none';
  }
}


/**
 * Muestra los controles de paginación basados en la información recibida.
 */
function displayPaginationControls(paginationInfo, context) {
    if (!paginationControlsContainer) return;
    paginationControlsContainer.innerHTML = ''; // Limpiar siempre

    let currentPage, totalPages, hasNextPage;

    // Determinar estructura de paginación (Jikan vs Backend)
    if (context === 'genre' && paginationInfo?.last_visible_page !== undefined) {
        currentPage = paginationInfo.current_page;
        totalPages = paginationInfo.last_visible_page;
        hasNextPage = paginationInfo.has_next_page;
    } else if (context === 'emotion' && paginationInfo?.total_pages !== undefined) {
        currentPage = paginationInfo.current_page;
        totalPages = paginationInfo.total_pages;
        hasNextPage = paginationInfo.has_next_page;
    } else {
        console.warn("Contexto de paginación desconocido o estructura de datos no estándar:", context, paginationInfo);
        // Intento de fallback (puede no funcionar siempre)
        currentPage = paginationInfo?.current_page || 1;
        totalPages = paginationInfo?.total_pages || paginationInfo?.last_visible_page || 1;
        hasNextPage = paginationInfo?.has_next_page ?? (currentPage < totalPages);
        if (totalPages <= 1) return; // No mostrar si no hay múltiples páginas
    }

    // No mostrar controles si solo hay una página
    if (totalPages <= 1) return;

    // Botón Anterior
    if (currentPage > 1) {
        const prevButton = document.createElement('button');
        prevButton.textContent = '‹ Anterior';
        prevButton.classList.add('pagination-button', 'prev');
        prevButton.addEventListener('click', () => {
            if (context === 'emotion' && currentEmotionTag) {
                handleEmotionFilter([currentEmotionTag], currentPage - 1);
            } else if (context === 'genre' && currentGenreName !== null) {
                handleGenreFilter(currentGenreName, currentPage - 1);
            }
        });
        paginationControlsContainer.appendChild(prevButton);
    }

    // Indicador de Página
    const pageIndicator = document.createElement('span');
    pageIndicator.textContent = `Página ${currentPage} de ${totalPages}`;
    pageIndicator.classList.add('page-indicator');
    paginationControlsContainer.appendChild(pageIndicator);

    // Botón Siguiente
    if (hasNextPage) {
        const nextButton = document.createElement('button');
        nextButton.textContent = 'Siguiente ›';
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
}


// ==================================================
// --- FUNCIONES DE CARGA DE DATOS PRINCIPALES ---
// ==================================================

/**
 * Carga los animes destacados para el banner superior.
 */
async function loadFeaturedAnime() {
  if (!bannerSlidesContainer || !slideLoading) {
    console.warn("Elementos DOM del banner no encontrados. Saltando carga.");
    if(slideLoading) hideLoading(slideLoading);
    if(bannerPrevButton) bannerPrevButton.style.display = 'none';
    if(bannerNextButton) bannerNextButton.style.display = 'none';
    if(bannerDotsContainer) bannerDotsContainer.style.display = 'none';
    return;
  }
  // showLoading(slideLoading, "Cargando destacados..."); // Esto ya se hace en initApp globalmente

  try {
    // Lista curada para el banner. Define aquí los 5 animes que QUIERES.
    const curatedBannerAnimesSeed = [
      {
        mal_id: 51818, // Fire Force Season 3
        title: "Fire Force Season 3", // Título preferido para el banner
      },
      {
        mal_id: 60146,
        title: "The Beginning After the End",
      },
      {
        mal_id: 59160, // WindBreaker (Anime)
        title: "Wind Breaker",
      },
      {
        mal_id: 56038, // Lazarus (Anime)
        title: "Lazarus",
      },
      {
        mal_id: 59597, // WITCH WATCH (ID de Manga: 119641)
        title: "Witch Watch",
        type: "Manga (Destacado)", // Indicar que es un manga
      }
    ];

    // Poblar más datos haciendo llamadas a getAnimeDetails para los que tienen mal_id real y positivo
    const detailedBannerAnimes = await Promise.all(
      curatedBannerAnimesSeed.map(async (seedAnime) => {
        if (seedAnime.mal_id > 0) { // Solo para IDs reales de MAL (anime o manga)
          try {
            // Para IDs de manga, getAnimeDetails podría no funcionar como se espera o dar error.
            // Jikan tiene /manga/{id}. Si necesitas datos específicos de manga,
            // deberías tener una función getMangaDetails en api.js.
            // Por ahora, si es ID de manga, podríamos solo usar los datos de la semilla
            // o hacer una llamada genérica si getAnimeDetails no falla catastróficamente.

            // Si el ID es de un MANGA (como Witch Watch 119641), y `getAnimeDetails` es solo para ANIME,
            // esta llamada podría fallar o no devolver lo esperado.
            // Considera esto al implementar getAnimeDetails o al decidir qué mostrar.
            // Por ahora, intentaremos la llamada:
            const response = await getAnimeDetails(seedAnime.mal_id); // Asume que puede manejar ID de anime o manga para datos básicos

            if (response && response.data) {
                // Combina la semilla (que puede tener título/tipo preferido) con datos de la API
                // Damos prioridad a los datos de la semilla si existen, luego a los de la API.
                const mergedData = {
                    ...response.data, // Datos de API como base
                    ...seedAnime,     // Sobrescribir con datos de la semilla (ej. título, tipo custom)
                    // Asegurar que el título de la semilla tenga precedencia si se especificó
                    title: seedAnime.title || response.data.title,
                };
                return mergedData;
            }
            console.warn(`No se encontró data en la respuesta de getAnimeDetails para ID ${seedAnime.mal_id}. Usando datos de semilla.`);
            return seedAnime; // Devuelve la semilla si la API falla o no hay data
          } catch (e) {
            console.warn(`Error al obtener detalles para ${seedAnime.title} (ID: ${seedAnime.mal_id}): ${e.message}. Usando datos de semilla.`);
            return seedAnime; // Devuelve la semilla como fallback
          }
        }
        // Para animes con ID ficticio (como nuestro TBATE con -1), simplemente devolvemos la semilla
        return seedAnime;
      })
    );

    console.log("Animes para el banner (curados y detallados):", detailedBannerAnimes.map(a => ({ title: a.title, mal_id: a.mal_id, localImg: localBannerImages[a.mal_id.toString()] }) ));
    setupBannerSlider(detailedBannerAnimes);

  } catch (error) {
    console.error('Error cargando animes destacados para el banner:', error);
    showErrorMessage('Error al cargar los animes destacados.');
    if (bannerSlidesContainer) bannerSlidesContainer.innerHTML = '<p class="error-placeholder">Error al cargar destacados.</p>';
    // Ocultar controles si falla
    if(bannerPrevButton) bannerPrevButton.style.display = 'none';
    if(bannerNextButton) bannerNextButton.style.display = 'none';
    if(bannerDotsContainer) bannerDotsContainer.style.display = 'none';
  } finally {
    // El hideLoading se maneja en initApp
  }
}
/**
 * Carga la lista inicial de animes populares (sin filtro).
 */
async function loadPopularAnime() {
  if (!animeCardsContainer || !cardsLoading) return;
  // Loading indicator ya está activo desde initApp
  try {
    const popularData = await getPopularAnime(20); // Obtener los 20 más populares
    displayAnimeCards(popularData?.data || [], animeCardsContainer);
  } catch (error) {
    console.error('Error cargando animes populares:', error);
    showErrorMessage('Error al cargar animes populares.');
    if (animeCardsContainer) animeCardsContainer.innerHTML = '<div class="no-results error-placeholder">Error al cargar populares.</div>';
  }
  // hideLoading se maneja en initApp
}

/**
 * Carga la sección de "Últimos Lanzamientos".
 */
async function loadLatestReleases() {
  if (!latestReleasesContainer || !latestReleasesLoading) return;
  // Loading indicator ya está activo desde initApp
  try {
      const responseData = await getSeasonalAnime('now', '', 15); // Llama a /seasons/now
      // --- DEBUGGING TOOLTIP: Verifica los datos aquí ---
      // console.log("Datos recibidos para Últimos Lanzamientos:", responseData?.data);
      // -------------------------------------------------
      displayAnimeCards(responseData?.data || [], latestReleasesContainer);
  } catch (error) {
      console.error('Error cargando últimos lanzamientos:', error);
      showErrorMessage('Error al cargar los últimos lanzamientos.');
      if (latestReleasesContainer) {
         latestReleasesContainer.innerHTML = '<div class="no-results error-placeholder">Error al cargar lanzamientos.</div>';
      }
  }
  // hideLoading se maneja en initApp
}

/**
 * Carga el Top 10 de animes desde el backend custom.
 */
async function loadCustomTopRankedAnime() {
  if (!topRankedContainer || !topRankedLoading) return;
  // Loading indicator ya está activo desde initApp
  try {
    const minVotesForHomePageTop = 5000; // Umbral de votos
    const responseData = await getCustomRanking(1, 10, minVotesForHomePageTop); // Llama al backend

    if (responseData?.data) { // Verificar si data existe, incluso si está vacía
        displayAnimeCards(responseData.data, topRankedContainer); // displayAnimeCards maneja el array vacío
    } else {
        // Si la respuesta no tiene 'data', es un error inesperado del backend
        throw new Error("Respuesta inválida del backend para ranking custom (falta 'data').");
    }
  } catch (error) {
    console.error('Error cargando Top Ranked Custom Anime:', error);
    if (!error.message || !error.message.includes('404')) { // No molestar con 404 si backend está offline
        showErrorMessage(`Error al cargar el top animes: ${error.message}`);
    }
    if (topRankedContainer) topRankedContainer.innerHTML = `<div class="no-results error-placeholder">Error al cargar el top. <small>${error.message}</small></div>`;
  }
  // hideLoading se maneja en initApp
}

// ==================================================
// --- FUNCIONES DE FILTRADO ---
// ==================================================

/**
 * Maneja el filtrado de animes por género.
 */
async function handleGenreFilter(genreName, page = 1) {
  currentFilterType = 'genre';
  currentGenrePage = page;
  currentGenreName = genreName.trim(); // Guardar nombre limpio
  currentEmotionTag = null; // Limpiar filtro de emoción
  if (!animeCardsContainer || !cardsLoading) return;

  showLoading(cardsLoading, `Cargando ${currentGenreName} (Pág. ${page})...`);
  animeCardsContainer.innerHTML = ''; // Limpiar tarjetas
  if (paginationControlsContainer) paginationControlsContainer.innerHTML = ''; // Limpiar paginación
  document.querySelectorAll('.emotion.selected').forEach(el => el.classList.remove('selected')); // Deseleccionar emociones

  const genreMap = {
    'Todos': 0, 'Acción': 1, 'Aventura': 2, 'Comedia': 4, 'Drama': 8,
    'Fantasía': 10, 'Romance': 22, 'Sci-Fi': 24, 'Slice of Life': 36,
    'Deportes': 30, 'Sobrenatural': 37, 'Thriller': 41, 'Misterio': 7,
    'Terror': 14, 'Psicológico': 40
  };
  const genreId = genreMap[currentGenreName];
  currentGenreId = genreId; // Guardar ID

  try {
    let responseData;
    // Lógica para 'Todos' o género no mapeado -> buscar populares paginados
    if (currentGenreName === 'Todos' || genreId === undefined && currentGenreName !== 'Todos') {
      responseData = await searchAnime('', 20, page, { order_by: 'popularity', sort: 'asc' });
      if (genreId === undefined && currentGenreName !== 'Todos') {
           showErrorMessage(`Género "${currentGenreName}" no reconocido. Mostrando populares.`);
           // Corregir selección visual si el género no era válido
           document.querySelector('.anime-type.active')?.classList.remove('active');
           document.querySelector('.anime-type:first-child')?.classList.add('active');
      }
    } else {
      // Lógica para género específico mapeado -> buscar por ID de género
      responseData = await getAnimeByGenre(genreId, 20, page);
    }

    // Procesar respuesta
    if (responseData?.data && responseData.pagination) {
      displayAnimeCards(responseData.data, animeCardsContainer);
      displayPaginationControls(responseData.pagination, 'genre');
    } else {
      // Manejar respuesta inesperada de la API
      throw new Error("Formato de respuesta de API inesperado para género.");
    }
  } catch (error) {
    console.error(`Error filtrando por género ${currentGenreName} (Pág. ${page}):`, error);
    showErrorMessage(`Error al filtrar por ${currentGenreName}: ${error.message}`);
    if (animeCardsContainer) animeCardsContainer.innerHTML = `<div class="no-results error-placeholder">Error al filtrar. <br><small>${error.message}</small></div>`;
  } finally {
    hideLoading(cardsLoading); // Siempre ocultar loading
  }
}

/**
 * Maneja el filtrado de animes por emoción seleccionada.
 */
async function handleEmotionFilter(selectedTags, page = 1) {
    // Validar entrada
    if (!selectedTags || selectedTags.length === 0 || !selectedTags[0]) {
        console.warn("Intento de filtrar por emoción sin tag válido.");
        showErrorMessage("Por favor, selecciona una emoción válida.");
        return;
    }

    currentFilterType = 'emotion';
    const emotionTag = selectedTags[0].trim(); // Usar la primera emoción y limpiar espacios
    currentEmotionTag = emotionTag;
    currentEmotionPage = page;
    currentGenreName = null; // Limpiar filtro de género
    if (!animeCardsContainer || !cardsLoading) return;

    const emotionDisplayName = getEmotionName(emotionTag) || emotionTag; // Obtener nombre legible
    showLoading(cardsLoading, `Buscando animes (Pág. ${page}) con emoción: ${emotionDisplayName}...`);
    animeCardsContainer.innerHTML = '';
    if (paginationControlsContainer) paginationControlsContainer.innerHTML = '';
    document.querySelector('.anime-type.active')?.classList.remove('active'); // Deseleccionar género

    try {
        // Llamar al backend local
        const responseData = await getRecommendationsByEmotion(emotionTag, page, 20);

        if (responseData && responseData.recommendations && responseData.pagination) {
            const recommendations = responseData.recommendations;
            const paginationInfo = responseData.pagination;
            totalEmotionPages = paginationInfo.total_pages; // Guardar total para paginación

            displayAnimeCards(recommendations, animeCardsContainer); // Mostrar tarjetas (maneja lista vacía)
            displayPaginationControls(paginationInfo, 'emotion'); // Mostrar controles de paginación
        } else {
            // Error si la respuesta del backend no es la esperada
            throw new Error("Respuesta inválida del backend para filtro de emoción.");
        }
    } catch (error) {
        console.error(`Error buscando por emoción ${emotionTag} (Pág. ${page}):`, error);
        // No mostrar error 404 si es probable que el backend esté offline
        if (!error.message || !error.message.toLowerCase().includes('failed to fetch') && !error.message.includes('404')) {
           showErrorMessage(`Error al buscar por emoción: ${error.message}`);
        }
        if (animeCardsContainer) animeCardsContainer.innerHTML = `<div class="no-results error-placeholder">Error al buscar. <br><small>${error.message}</small></div>`;
    } finally {
        hideLoading(cardsLoading); // Siempre ocultar loading
    }
}

// ==================================================
// --- SETUP EVENT LISTENERS ---
// ==================================================
function setupEventListeners() {
  // Listener para la barra de búsqueda (Enter y Autocompletado)
  if (searchBar) {
      searchBar.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && this.value.trim()) {
          const query = this.value.trim();
          hideSuggestions();
          window.location.href = `search.html?q=${encodeURIComponent(query)}`;
        }
      });
      searchBar.addEventListener('input', function() {
        debouncedAutocompleteSearch(this.value.trim()); // Llamar a la versión debounced
      });
      // Ocultar sugerencias si el input pierde foco (blur)
      searchBar.addEventListener('blur', () => {
          // Pequeño delay para permitir clic en sugerencia antes de ocultar
          setTimeout(hideSuggestions, 150);
      });
  } else { console.warn("Elemento searchBar no encontrado."); }

  // Listener para ocultar sugerencias si se hace clic fuera
  document.addEventListener('click', function(event) {
      if (suggestionsContainer && !suggestionsContainer.contains(event.target) &&
          searchBar && !searchBar.contains(event.target)) {
          hideSuggestions();
      }
  });

  // Listeners para los filtros de GÉNERO
  if (animeTypes.length > 0) {
      animeTypes.forEach(type => {
        type.addEventListener('click', function(e) {
          e.preventDefault(); // Prevenir comportamiento por defecto de <a>
          document.querySelector('.anime-type.active')?.classList.remove('active');
          this.classList.add('active');
          hideSuggestions(); // Ocultar sugerencias al cambiar filtro
          clearPaginationState(); // Resetear estado
          handleGenreFilter(this.textContent, 1); // Filtrar por género, página 1
        });
      });
  } else { console.warn("No se encontraron elementos .anime-type para listeners."); }

  // Listener para el botón APLICAR FILTRO DE EMOCIÓN
  if (filterButton) {
      filterButton.addEventListener('click', function() {
        const selectedEmotion = document.querySelector('.emotion.selected');
        if (selectedEmotion?.dataset?.emotionTag) { // Chequeo más seguro
          const emotionTag = selectedEmotion.dataset.emotionTag;
          hideSuggestions();
          clearPaginationState();
          handleEmotionFilter([emotionTag], 1); // Filtrar por emoción, página 1
        } else {
          showErrorMessage('Selecciona una emoción para filtrar.');
        }
      });
  } else { console.warn("Botón de filtro de emoción no encontrado."); }

  // Listeners para la SELECCIÓN de EMOCIONES (single choice)
  if (emotionCategories.length > 0) {
      emotionCategories.forEach(emotion => {
        emotion.addEventListener('click', function() {
            const isCurrentlySelected = this.classList.contains('selected');
            // Quitar 'selected' de todas las emociones
            document.querySelectorAll('.emotion.selected').forEach(el => el.classList.remove('selected'));
            // Si no estaba seleccionada previamente, seleccionarla ahora
            if (!isCurrentlySelected) {
                this.classList.add('selected');
            }
            // Si ya estaba seleccionada, al quitarla arriba, queda deseleccionada (efecto toggle)
        });
      });
  } else { console.warn("No se encontraron elementos .emotion para listeners."); }

  // Listener para efecto SCROLLED del HEADER
  if (headerElement) {
      const handleScroll = () => {
          headerElement.classList.toggle('header-scrolled', window.scrollY > 50);
      };
      window.addEventListener('scroll', handleScroll);
      handleScroll(); // Llamar una vez al cargar por si la página carga scrolleada
  } else { console.warn("Elemento del header no encontrado para listener de scroll."); }
}

// ==================================================
// --- INICIALIZACIÓN DE LA APLICACIÓN ---
// ==================================================
async function initApp() {
  console.log("Inicializando AniEmotion...");
  // Mostrar indicadores de carga iniciales
  showLoading(slideLoading, "Cargando destacados...");
  showLoading(cardsLoading, "Cargando populares...");
  showLoading(latestReleasesLoading, "Cargando últimos lanzamientos...");
  showLoading(topRankedLoading, "Cargando top animes...");

  try {
    // Configurar listeners básicos lo antes posible
    setupEventListeners();

    // Cargar contenido principal
    // El banner es visualmente importante, cargarlo primero puede ser bueno
    await loadFeaturedAnime();

    // Cargar el resto en paralelo para acelerar
    const loadPromises = [
        loadPopularAnime(),
        loadLatestReleases(),
        loadCustomTopRankedAnime() // Llama al backend custom
    ];
    // Esperar a que todas las promesas terminen (resueltas o rechazadas)
    await Promise.allSettled(loadPromises);

    console.log("Carga inicial de secciones completada.");

  } catch (error) {
    // Captura errores inesperados durante la secuencia de initApp
    console.error('Error fatal durante la inicialización de la aplicación:', error);
    showErrorMessage('Ocurrió un error inesperado al cargar la página principal.');
    // Ocultar loadings específicos en caso de error fatal aquí si es necesario,
    // aunque el finally debería encargarse.
  } finally {
    // Ocultar todos los indicadores de carga, independientemente del resultado.
    // Usar un pequeño delay puede mejorar la percepción si la carga es muy rápida.
    setTimeout(() => {
        hideLoading(slideLoading);
        hideLoading(cardsLoading);
        hideLoading(latestReleasesLoading);
        hideLoading(topRankedLoading);
        console.log("Indicadores de carga ocultos.");
    }, 150); // 150ms delay
  }
}

// ==================================================
// --- DISPARADOR PRINCIPAL ---
// ==================================================
document.addEventListener('DOMContentLoaded', initApp);