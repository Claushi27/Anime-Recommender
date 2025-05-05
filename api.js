// api.js - Manejo de llamadas a Jikan API y Backend Local (COMPLETO Y CORRECTO)

const JIKAN_BASE_URL = 'https://api.jikan.moe/v4';
const LOCAL_BACKEND_URL = 'https://aniemotion.onrender.com'; // URL base de tu backend Flask

// Función para manejar retrasos entre solicitudes (evitar rate limiting en Jikan)
let lastRequestTime = 0;
const MIN_DELAY = 500; // Medio segundo de espera mínimo entre llamadas a Jikan

async function delayIfNeeded() {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < MIN_DELAY) {
        const delay = MIN_DELAY - timeSinceLastRequest;
        console.warn(`Jikan API delay: Waiting ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
    }
    lastRequestTime = Date.now(); // Actualizar tiempo de la última solicitud *antes* de hacerla
}

async function delayedFetch(url) {
  await delayIfNeeded(); // Esperar si es necesario ANTES de hacer fetch
  try {
    const response = await fetch(url);
    lastRequestTime = Date.now(); // Actualizar también después por si acaso

    if (!response.ok) {
      // Si es 429, el reintento ya está manejado por el delayIfNeeded en la próxima llamada.
      // Lanzar error para otros códigos.
      throw new Error(`Error API Jikan: ${response.status} - ${response.statusText} en ${url}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Error en fetch para ${url}:`, error);
    // Relanzar para que la función que llama lo maneje, añadiendo más contexto si es posible
    throw new Error(`Fallo al obtener datos de ${url}. (${error.message})`);
  }
}

// --- Funciones Jikan API ---

async function getLatestSeasonalAnime(limit = 15) {
  const url = `${JIKAN_BASE_URL}/top/anime?filter=airing&limit=${limit}&sfw=true&page=1`;
  console.log(`Workspaceing from Jikan (Latest Seasonal): ${url}`);
  return delayedFetch(url);
}

async function searchAnime(query, limit = 20, page = 1, options = {}) {
  let url = `${JIKAN_BASE_URL}/anime?q=${encodeURIComponent(query)}&limit=${limit}&page=${page}&sfw=true`;

  // Añadir filtros soportados por la API v4
  if (options.type) url += `&type=${options.type}`;
  if (options.status) url += `&status=${options.status}`;
  if (options.rating) url += `&rating=${options.rating}`;
  if (options.genres) url += `&genres=${options.genres}`;
  if (options.min_score) url += `&min_score=${options.min_score}`; // Filtro por puntuación mínima
  if (options.start_date) url += `&start_date=${options.start_date}`;
  if (options.end_date) url += `&end_date=${options.end_date}`;
  if (options.order_by) url += `&order_by=${options.order_by}`;
  if (options.sort) url += `&sort=${options.sort}`;

  console.log(`Workspaceing from Jikan (Search with Filters): ${url}`);
  return delayedFetch(url);
}

async function getPopularAnime(limit = 20) {
  const url = `${JIKAN_BASE_URL}/top/anime?filter=bypopularity&limit=${limit}`;
  return delayedFetch(url);
}

async function getSeasonalAnime(year = 'now', season = '', limit = 10) {
  let url;
  if (year === 'now') {
    // Ajustar límite si se pide para el slider, puede ser diferente
    url = `${JIKAN_BASE_URL}/seasons/now?limit=${limit}&sfw=true`;
  } else {
    // Limitar también si se pide temporada específica
    url = `${JIKAN_BASE_URL}/seasons/${year}/${season}?limit=${limit}&sfw=true`;
  }
  return delayedFetch(url);
}

// Obtener detalles COMPLETOS de un anime
async function getAnimeDetails(animeId) {
  if (!animeId) throw new Error("Se requiere ID de anime para buscar detalles.");
  const url = `${JIKAN_BASE_URL}/anime/${animeId}/full`;
  console.log(`Workspaceing from Jikan (Full Details): ${url}`);
  return delayedFetch(url);
}

async function getAnimeByGenre(genreId, limit = 20, page = 1) {
  const url = `${JIKAN_BASE_URL}/anime?genres=${genreId}&limit=${limit}&order_by=popularity&sort=asc&page=${page}&sfw=true`;
  console.log(`Workspaceing from Jikan (Genre): ${url}`);
  return delayedFetch(url);
}

// --- NUEVAS FUNCIONES PARA DETALLES ADICIONALES ---

// Obtener personajes y actores de voz
async function getAnimeCharacters(animeId) {
  if (!animeId) throw new Error("Se requiere ID de anime para buscar personajes.");
  const url = `${JIKAN_BASE_URL}/anime/${animeId}/characters`;
  console.log(`Workspaceing from Jikan (Characters): ${url}`);
  return delayedFetch(url);
}

// Obtener staff principal
async function getAnimeStaff(animeId) {
  if (!animeId) throw new Error("Se requiere ID de anime para buscar staff.");
  const url = `${JIKAN_BASE_URL}/anime/${animeId}/staff`;
  console.log(`Workspaceing from Jikan (Staff): ${url}`);
  return delayedFetch(url);
}

// Obtener recomendaciones de anime
async function getAnimeRecommendations(animeId) {
  if (!animeId) throw new Error("Se requiere ID de anime para buscar recomendaciones.");
  const url = `${JIKAN_BASE_URL}/anime/${animeId}/recommendations`;
  console.log(`Workspaceing from Jikan (Recommendations): ${url}`);
  return delayedFetch(url);
}

// Obtener estadísticas del anime
async function getAnimeStatistics(animeId) {
  if (!animeId) throw new Error("Se requiere ID de anime para buscar estadísticas.");
  const url = `${JIKAN_BASE_URL}/anime/${animeId}/statistics`;
  console.log(`Workspaceing from Jikan (Statistics): ${url}`);
  return delayedFetch(url);
}

// --- FUNCIÓN para llamar a TU Backend ---
async function getRecommendationsByEmotion(emotionTag, page = 1, limit = 20) {
  const url = `${LOCAL_BACKEND_URL}/api/recommendations/emotion/${emotionTag}?page=${page}&limit=${limit}`;
  console.log(`Workspaceing from local backend: ${url}`);
  try {
    const response = await fetch(url);
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `Error del servidor local: ${response.status}` }));
        throw new Error(errorData.error || `Error del servidor local: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching recommendations from local backend:', error);
    if (error instanceof TypeError && error.message.includes('fetch')) { // Check for network error
         throw new Error('No se pudo conectar al backend local.');
    }
    throw error; // Re-throw other errors
  }
}


// --- Funciones Helper ---
const genreEmotionMap = {
  1: ['epic', 'tension'], 2: ['epic', 'wonder'], 4: ['happy', 'wonder'],
  8: ['sad', 'nostalgia'], 36: ['nostalgia', 'happy'], 14: ['tension', 'wonder'],
  41: ['tension', 'epic'], 24: ['wonder', 'epic'], 10: ['wonder', 'epic'],
  22: ['nostalgia', 'happy'], 19: ['nostalgia', 'happy'], 7: ['tension','wonder'],
  // Añadir más mapeos si es necesario
  default: ['epic', 'wonder']
};

function assignEmotions(genres) {
  if (!genres || !Array.isArray(genres) || genres.length === 0) {
    return genreEmotionMap.default;
  }
  const emotionsSet = new Set();
  genres.forEach(genre => {
    if (genre && typeof genre === 'object' && genre.mal_id) {
        const emotions = genreEmotionMap[genre.mal_id] || genreEmotionMap.default;
        emotions.forEach(emotion => emotionsSet.add(emotion));
    }
  });
   if (emotionsSet.size === 0) {
        genreEmotionMap.default.forEach(emotion => emotionsSet.add(emotion));
   }
  return Array.from(emotionsSet).slice(0, 2); // Devolver hasta 2 emociones
}

function getEmotionName(tag) {
  const emotionNames = {
    'epic': 'Épico', 'tension': 'Tensión', 'sad': 'Tristeza',
    'nostalgia': 'Nostalgia', 'happy': 'Felicidad', 'wonder': 'Asombro'
  };
  return emotionNames[tag] || capitalize(tag); // Capitalizar si no está mapeado
}

function getEmotionColor(emotion) {
  const emotionCssClasses = {
    'epic': 'epic', 'tension': 'tension', 'sad': 'sad',
    'nostalgia': 'nostalgia', 'happy': 'happy', 'wonder': 'wonder'
  };
  return emotionCssClasses[emotion] || 'epic'; // Fallback a 'epic'
}

// Helper capitalize (si no está en otro lado)
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}


// --- Exportaciones (ASEGÚRATE QUE ESTÁN TODAS LAS FUNCIONES NECESARIAS) ---
export {
  // Funciones Jikan
  searchAnime,
  getPopularAnime,
  getSeasonalAnime,
  getAnimeDetails,
  getAnimeByGenre,
  getLatestSeasonalAnime, // Puede que se use o no
  // Nuevas funciones para detalles
  getAnimeCharacters,
  getAnimeStaff,
  getAnimeRecommendations,
  getAnimeStatistics,
  // Función Backend Local
  getRecommendationsByEmotion,
  // Helpers
  assignEmotions,
  getEmotionName,
  getEmotionColor
};