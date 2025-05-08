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
    lastRequestTime = Date.now();
}

async function delayedFetch(url) {
  await delayIfNeeded();
  try {
    const response = await fetch(url);
    lastRequestTime = Date.now();

    if (!response.ok) {
      throw new Error(`Error API Jikan: ${response.status} - ${response.statusText} en ${url}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Error en fetch para ${url}:`, error);
    throw new Error(`Fallo al obtener datos de ${url}. (${error.message})`);
  }
}

// --- Funciones Jikan API ---

async function getLatestSeasonalAnime(limit = 15) {
  const url = `${JIKAN_BASE_URL}/top/anime?filter=airing&limit=${limit}&sfw=true&page=1`;
  console.log(`Solicitando a Jikan (Latest Seasonal): ${url}`);
  return delayedFetch(url);
}

async function searchAnime(query, limit = 20, page = 1, options = {}) {
  let url = `${JIKAN_BASE_URL}/anime?q=${encodeURIComponent(query)}&limit=${limit}&page=${page}&sfw=true`;

  if (options.type) url += `&type=${options.type}`;
  if (options.status) url += `&status=${options.status}`;
  if (options.rating) url += `&rating=${options.rating}`;
  if (options.genres) url += `&genres=${options.genres}`;
  if (options.min_score) url += `&min_score=${options.min_score}`;
  if (options.start_date) url += `&start_date=${options.start_date}`;
  if (options.end_date) url += `&end_date=${options.end_date}`;
  if (options.order_by) url += `&order_by=${options.order_by}`;
  if (options.sort) url += `&sort=${options.sort}`;

  console.log(`Solicitando a Jikan (Search with Filters): ${url}`);
  return delayedFetch(url);
}

async function getPopularAnime(limit = 20) {
  const url = `${JIKAN_BASE_URL}/top/anime?filter=bypopularity&limit=${limit}&sfw=true`; // Agregado sfw=true
  console.log(`Solicitando a Jikan (Popular Anime): ${url}`);
  return delayedFetch(url);
}

async function getSeasonalAnime(year = 'now', season = '', limit = 10) {
  let url;
  if (year === 'now') {
    url = `${JIKAN_BASE_URL}/seasons/now?limit=${limit}&sfw=true`;
  } else {
    url = `${JIKAN_BASE_URL}/seasons/${year}/${season}?limit=${limit}&sfw=true`;
  }
  console.log(`Solicitando a Jikan (Seasonal Anime): ${url}`);
  return delayedFetch(url);
}

async function getAnimeDetails(animeId) {
  if (!animeId) throw new Error("Se requiere ID de anime para buscar detalles.");
  const url = `${JIKAN_BASE_URL}/anime/${animeId}/full`;
  console.log(`Solicitando a Jikan (Full Details): ${url}`);
  return delayedFetch(url);
}

async function getAnimeByGenre(genreId, limit = 20, page = 1) {
  const url = `${JIKAN_BASE_URL}/anime?genres=${genreId}&limit=${limit}&order_by=popularity&sort=asc&page=${page}&sfw=true`;
  console.log(`Solicitando a Jikan (Genre): ${url}`);
  return delayedFetch(url);
}

async function getAnimeCharacters(animeId) {
  if (!animeId) throw new Error("Se requiere ID de anime para buscar personajes.");
  const url = `${JIKAN_BASE_URL}/anime/${animeId}/characters`;
  console.log(`Solicitando a Jikan (Characters): ${url}`);
  return delayedFetch(url);
}

async function getAnimeStaff(animeId) {
  if (!animeId) throw new Error("Se requiere ID de anime para buscar staff.");
  const url = `${JIKAN_BASE_URL}/anime/${animeId}/staff`;
  console.log(`Solicitando a Jikan (Staff): ${url}`);
  return delayedFetch(url);
}

async function getAnimeRecommendations(animeId) {
  if (!animeId) throw new Error("Se requiere ID de anime para buscar recomendaciones.");
  const url = `${JIKAN_BASE_URL}/anime/${animeId}/recommendations`;
  console.log(`Solicitando a Jikan (Recommendations): ${url}`);
  return delayedFetch(url);
}

async function getAnimeStatistics(animeId) {
  if (!animeId) throw new Error("Se requiere ID de anime para buscar estadísticas.");
  const url = `${JIKAN_BASE_URL}/anime/${animeId}/statistics`;
  console.log(`Solicitando a Jikan (Statistics): ${url}`);
  return delayedFetch(url);
}

// CORREGIDO: getTopAnime para que la URL sea válida
async function getTopAnime(page = 1, limit = 25, filter = null) {
  let url = `${JIKAN_BASE_URL}/top/anime?page=${page}&limit=${limit}&sfw=true`;
  if (filter) {
      url += `&filter=${filter}`;
  }
  console.log(`Solicitando a Jikan (Top Anime): ${url}`);
  return delayedFetch(url);
}

// --- Funciones para llamar a TU Backend ---
async function getRecommendationsByEmotion(emotionTag, page = 1, limit = 20) {
  const url = `${LOCAL_BACKEND_URL}/api/recommendations/emotion/${emotionTag}?page=${page}&limit=${limit}`;
  console.log(`Solicitando a backend local (Emotion Recs): ${url}`);
  try {
    const response = await fetch(url);
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `Error del servidor local: ${response.status}` }));
        throw new Error(errorData.error || `Error del servidor local: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching recommendations from local backend:', error);
    if (error instanceof TypeError && error.message.includes('fetch')) {
         throw new Error('No se pudo conectar al backend local.');
    }
    throw error;
  }
}

// NUEVA FUNCIÓN para obtener ranking custom desde el backend local
async function getCustomRanking(page = 1, limit = 25, min_votes = 10000) { // min_votes ajustado por defecto
  const url = `${LOCAL_BACKEND_URL}/api/ranking/custom?page=${page}&limit=${limit}&min_votes=${min_votes}`;
  console.log(`Solicitando ranking custom desde backend local: ${url}`);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: `Error del servidor local: ${response.status}` }));
      throw new Error(errorData.error || `Error del servidor local: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching custom ranking from local backend:', error);
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('No se pudo conectar al backend para el ranking custom.');
    }
    throw error;
  }
}


// --- Funciones Helper ---
const genreEmotionMap = {
  1: ['epic', 'tension'], 2: ['epic', 'wonder'], 4: ['happy', 'wonder'],
  8: ['sad', 'nostalgia'], 36: ['nostalgia', 'happy'], 14: ['tension', 'wonder'],
  41: ['tension', 'epic'], 24: ['wonder', 'epic'], 10: ['wonder', 'epic'],
  22: ['nostalgia', 'happy'], 19: ['nostalgia', 'happy'], 7: ['tension','wonder'],
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
  return Array.from(emotionsSet).slice(0, 2);
}

function getEmotionName(tag) {
  const emotionNames = {
    'epic': 'Épico', 'tension': 'Tensión', 'sad': 'Tristeza',
    'nostalgia': 'Nostalgia', 'happy': 'Felicidad', 'wonder': 'Asombro'
  };
  return emotionNames[tag] || capitalize(tag);
}

function getEmotionColor(emotion) {
  const emotionCssClasses = {
    'epic': 'epic', 'tension': 'tension', 'sad': 'sad',
    'nostalgia': 'nostalgia', 'happy': 'happy', 'wonder': 'wonder'
  };
  return emotionCssClasses[emotion] || 'epic';
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// --- Exportaciones ---
export {
  // Funciones Jikan
  searchAnime,
  getPopularAnime,
  getTopAnime, //<- Jikan top/anime
  getSeasonalAnime,
  getAnimeDetails,
  getAnimeByGenre,
  getLatestSeasonalAnime,
  getAnimeCharacters,
  getAnimeStaff,
  getAnimeRecommendations,
  getAnimeStatistics,
  // Función Backend Local para emociones
  getRecommendationsByEmotion,
  // NUEVA función Backend Local para ranking custom
  getCustomRanking,
  // Helpers
  assignEmotions,
  getEmotionName,
  getEmotionColor
};