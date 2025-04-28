// api.js - Manejo de llamadas a Jikan API y Backend Local (CORREGIDO Y SIN DUPLICADOS)

const JIKAN_BASE_URL = 'https://api.jikan.moe/v4';
const LOCAL_BACKEND_URL = 'http://127.0.0.1:5000'; // URL base de tu backend Flask

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

// Buscar anime por nombre
async function searchAnime(query, limit = 20) {
  const url = `${JIKAN_BASE_URL}/anime?q=${encodeURIComponent(query)}&limit=${limit}&sfw=true`;
  return delayedFetch(url);
}

// Obtener anime popular
async function getPopularAnime(limit = 20) {
  const url = `${JIKAN_BASE_URL}/top/anime?filter=bypopularity&limit=${limit}`;
  return delayedFetch(url);
}

// Obtener anime por temporada
async function getSeasonalAnime(year = 'now', season = '') {
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
  // Construir la URL incluyendo el parámetro 'page' para Jikan
  const url = `${JIKAN_BASE_URL}/anime?genres=${genreId}&limit=${limit}&order_by=popularity&sort=asc&page=${page}`; // 'asc' según corrección anterior
  console.log(`Fetching from Jikan (Genre): ${url}`);
  // Usamos delayedFetch que ya maneja errores y devuelve el JSON completo
  // La respuesta de Jikan incluirá 'data' y 'pagination'
  return delayedFetch(url); // <--- Devuelve el objeto completo de Jikan
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

// Obtener color CSS para la emoción
function getEmotionColor(emotion) {
  const emotionColors = {
    'epic': '', 'tension': 'anime-purple', 'sad': 'anime-blue',
    'nostalgia': 'anime-blue', 'happy': 'anime-pink', 'wonder': 'anime-yellow'
  };
  return emotionColors[emotion] || '';
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
  getRecommendationsByEmotion // <-- Asegurándose que se exporta la versión correcta (y única)
};