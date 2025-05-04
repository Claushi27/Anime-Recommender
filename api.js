// api.js - Manejo de llamadas a Jikan API y Backend Local (CORREGIDO Y SIN DUPLICADOS)

const JIKAN_BASE_URL = 'https://api.jikan.moe/v4';
const LOCAL_BACKEND_URL = 'https://aniemotion.onrender.com'; // URL base de tu backend Flask

// Función para manejar retrasos entre solicitudes (evitar rate limiting en Jikan)
async function delayedFetch(url) {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 429) {
        console.warn('Rate limit Jikan alcanzado, esperando 1 segundo...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        return delayedFetch(url); // Reintentar
      }
      // Lanzar error para otras respuestas no exitosas de Jikan
      throw new Error(`Error API Jikan: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error en delayedFetch:', error);
    throw error; // Relanzar para que la función que llama lo maneje
  }
}

// --- Funciones Jikan API ---
// En api.js
async function getLatestSeasonalAnime(limit = 15) {
  // URL CORREGIDA - Usando la alternativa que probamos antes, o puedes volver a /seasons/now si prefieres
  const url = `${JIKAN_BASE_URL}/top/anime?filter=airing&limit=${limit}&sfw=true&page=1`;
  // O si prefieres usar /seasons/now:
  // const url = `${JIKAN_BASE_URL}/seasons/now?limit=${limit}&sfw=true&page=1`;

  console.log(`>>> URL EXACTA para Latest Seasonal: ${url}`); // Mantenemos el log para verificar
  console.log(`Fetching from Jikan (Latest Seasonal): ${url}`);
  return delayedFetch(url); // Llama a la función fetch
}
// Buscar anime por nombre
async function searchAnime(query, limit = 20, page = 1, options = {}) {
  // Construir URL base
  let url = `${JIKAN_BASE_URL}/anime?q=${encodeURIComponent(query)}&limit=${limit}&page=${page}&sfw=true`;

  // Añadir filtros desde el objeto 'options'
  if (options.type) url += `&type=${options.type}`;
  if (options.status) url += `&status=${options.status}`;
  if (options.rating) url += `&rating=${options.rating}`;
  if (options.genres) url += `&genres=${options.genres}`; // Asume IDs de género separados por coma
  if (options.score) url += `&score=${options.score}`; // Filtra >= score
  if (options.start_date) url += `&start_date=${options.start_date}`; // YYYY-MM-DD
  if (options.end_date) url += `&end_date=${options.end_date}`; // YYYY-MM-DD
  if (options.order_by) url += `&order_by=${options.order_by}`;
  if (options.sort) url += `&sort=${options.sort}`; // asc o desc

  console.log(`Fetching from Jikan (Search): ${url}`);
  return delayedFetch(url); // Devuelve objeto completo con data y pagination
}


// Obtener anime popular
async function getPopularAnime(limit = 20) {
  const url = `${JIKAN_BASE_URL}/top/anime?filter=bypopularity&limit=${limit}`;
  return delayedFetch(url);
}

// Obtener anime por temporada
async function getSeasonalAnime(year = 'now', season = '', limit  = 10) {
  let url;
  if (year === 'now') {
    url = `${JIKAN_BASE_URL}/seasons/now?limit=20`;
  } else {
    url = `${JIKAN_BASE_URL}/seasons/${year}/${season}?limit=20`;
  }
  return delayedFetch(url);
}

// Obtener detalles de un anime
async function getAnimeDetails(animeId) {
  const url = `${JIKAN_BASE_URL}/anime/${animeId}/full`;
  return delayedFetch(url);
}

// Obtener anime por género (Asegúrate que 'sort=asc' es correcto para tu necesidad)
async function getAnimeByGenre(genreId, limit = 20, page = 1) {
  const url = `${JIKAN_BASE_URL}/anime?genres=${genreId}&limit=${limit}&order_by=popularity&sort=asc&page=${page}`;
  console.log(`Fetching from Jikan (Genre): ${url}`);
  return delayedFetch(url);
}

// --- FUNCIÓN para llamar a TU Backend (ÚNICA DECLARACIÓN - CON PAGINACIÓN) ---
async function getRecommendationsByEmotion(emotionTag, page = 1, limit = 20) {
  // Construye la URL completa incluyendo page y limit
  const url = `${LOCAL_BACKEND_URL}/api/recommendations/emotion/${emotionTag}?page=${page}&limit=${limit}`;
  console.log(`Fetching from local backend: ${url}`); // Mensaje para depuración

  try {
    const response = await fetch(url); // Llama a tu API local Flask

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `Error del servidor local: ${response.status}` }));
        throw new Error(errorData.error || `Error del servidor local: ${response.status}`);
    }

    // Si la respuesta fue OK, devuelve los datos JSON COMPLETOS (objeto con recommendations y pagination)
    return await response.json(); // Devuelve el objeto completo

  } catch (error) {
    console.error('Error fetching recommendations from local backend:', error);
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
         throw new Error('No se pudo conectar al backend. ¿Está corriendo?');
    } else {
        throw error;
    }
  }
}


// --- Funciones Helper ---

// Mapeo de géneros a emociones (para frontend si es necesario)
const genreEmotionMap = {
  1: ['epic', 'tension'], 2: ['epic', 'wonder'], 4: ['happy', 'wonder'],
  8: ['sad', 'nostalgia'], 36: ['nostalgia', 'happy'], 14: ['tension', 'wonder'],
  41: ['tension', 'epic'], 24: ['wonder', 'epic'], 10: ['wonder', 'epic'],
  22: ['nostalgia', 'happy'], 19: ['nostalgia', 'happy'],
  default: ['epic', 'wonder']
};

// Asignar emociones basadas en géneros (estructura Jikan)
function assignEmotions(genres) {
  if (!genres || !Array.isArray(genres) || genres.length === 0) {
    return ['epic', 'wonder'];
  }
  const emotionsSet = new Set();
  genres.forEach(genre => {
    if (genre && typeof genre === 'object' && genre.mal_id) {
        const genreId = genre.mal_id;
        const emotions = genreEmotionMap[genreId] || genreEmotionMap.default;
        emotions.forEach(emotion => emotionsSet.add(emotion));
    }
  });
   if (emotionsSet.size === 0) {
        genreEmotionMap.default.forEach(emotion => emotionsSet.add(emotion));
   }
  return Array.from(emotionsSet).slice(0, 2);
}

// Obtener nombre de emoción en español
function getEmotionName(tag) {
  const emotionNames = {
    'epic': 'Épico', 'tension': 'Tensión', 'sad': 'Tristeza',
    'nostalgia': 'Nostalgia', 'happy': 'Felicidad', 'wonder': 'Asombro'
  };
  return emotionNames[tag] || tag;
}

function getEmotionColor(emotion) {
  // Mapea la emoción al nombre de clase CSS que SÍ tienes definido
  // en style.css y styles-additional.css
  const emotionCssClasses = {
    'epic': 'epic',         // Usa la clase .epic
    'tension': 'tension',   // Usa la clase .tension
    'sad': 'sad',           // Usa la clase .sad
    'nostalgia': 'nostalgia', // Usa la clase .nostalgia
    'happy': 'happy',       // Usa la clase .happy
    'wonder': 'wonder'      // Usa la clase .wonder
  };
  // Devuelve la clase correspondiente o una clase por defecto (ej. 'epic') si no se encuentra
  return emotionCssClasses[emotion] || 'epic';
}

// --- Exportaciones ---
export {
  searchAnime,
  getPopularAnime,
  getSeasonalAnime,
  getAnimeDetails,
  getAnimeByGenre,
  assignEmotions,
  getEmotionName,
  getEmotionColor,
  getLatestSeasonalAnime,
  getRecommendationsByEmotion // <-- Asegurándose que se exporta la versión correcta (y única)
};