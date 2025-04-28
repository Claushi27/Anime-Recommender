// detalle.js - Lógica para la página de detalles del anime

// Importar funciones necesarias de api.js (asegúrate que la ruta sea correcta)
import { getAnimeDetails, assignEmotions, getEmotionName, getEmotionColor } from './api.js'; 

// --- Helper para obtener ID de URL ---
function getAnimeIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id'); // Busca el parámetro ?id=XXXX
}

// --- Función principal para cargar datos ---
async function loadAnimeDetails() {
    const animeId = getAnimeIdFromUrl();
    const detailContent = document.getElementById('detail-content');
    const loadingIndicator = detailContent.querySelector('.detail-loading'); // Asumiendo que el loading está dentro

    if (!animeId) {
        detailContent.innerHTML = '<div class="detail-error">Error: No se especificó un ID de anime en la URL.</div>';
        return;
    }

    try {
        // Mostrar carga
        if(loadingIndicator) loadingIndicator.style.display = 'block';

        const animeData = await getAnimeDetails(animeId);

        if (animeData && animeData.data) {
            // Ocultar carga
            if(loadingIndicator) loadingIndicator.style.display = 'none';
            // Poblar la página con los datos
            populatePage(animeData.data);
             // Aplicar clase de emoción para el fondo
             setEmotionBackground(animeData.data);
        } else {
            throw new Error("No se recibieron datos válidos de la API.");
        }

    } catch (error) {
        console.error("Error al cargar detalles del anime:", error);
         if(loadingIndicator) loadingIndicator.style.display = 'none';
        detailContent.innerHTML = `<div class="detail-error">Error al cargar los detalles del anime. Por favor, intenta de nuevo más tarde.<br><small>${error.message}</small></div>`;
    }
}

// --- Función para poblar el HTML con datos ---
function populatePage(anime) {
    const detailContent = document.getElementById('detail-content');
    
    // Usar datos para llenar el HTML (plantilla de ejemplo)
    // ¡Asegúrate que las propiedades de 'anime' coincidan con la respuesta de Jikan API v4!
    
    // Calcular emociones
    const emotions = assignEmotions(anime.genres);
    const emotion1 = emotions[0] || 'epic'; // Usar 'epic' como fallback
    const emotion2 = emotions[1] || null;

    // Formatear géneros
    const genresHTML = anime.genres?.map(g => `<span class="genre-tag">${g.name}</span>`).join('') || 'N/A';

    // Formatear información adicional
    const infoListHTML = `
        <li><strong>Tipo:</strong> ${anime.type || 'N/A'}</li>
        <li><strong>Episodios:</strong> ${anime.episodes || 'N/A'}</li>
        <li><strong>Estado:</strong> ${anime.status || 'N/A'}</li>
        <li><strong>Estreno:</strong> ${anime.aired?.string || 'N/A'}</li>
        <li><strong>Estudio(s):</strong> ${anime.studios?.map(s => s.name).join(', ') || 'Desconocido'}</li>
        <li><strong>Fuente:</strong> ${anime.source || 'N/A'}</li>
        <li><strong>Duración:</strong> ${anime.duration || 'N/A'}</li>
        <li><strong>Clasificación:</strong> ${anime.rating || 'N/A'}</li>
    `;

    // Construir el HTML final para el grid
    const contentHTML = `
      <div class="detail-grid">
          <div class="detail-left">
              <img id="anime-image" src="${anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || ''}" alt="Poster de ${anime.title}" class="detail-poster">
              <div id="action-buttons" class="action-buttons">
                  <button id="rate-button">Puntuar (Próximamente)</button>
                  <button id="favorite-button">Añadir Favorito (Próximamente)</button>
              </div>
          </div>
          <div class="detail-right">
              <h1 id="anime-title">${anime.title || 'Sin título'}</h1>
              <h3 id="anime-title-japanese">${anime.title_japanese || ''}</h3>
              <div class="detail-emotions" id="anime-emotions">
                  <span class="emotion-tag ${emotion1}">${getEmotionName(emotion1)}</span>
                  ${emotion2 ? `<span class="emotion-tag ${emotion2}">${getEmotionName(emotion2)}</span>` : ''}
              </div>
              <div class="detail-stats" id="anime-stats">
                  <span>Score: ${anime.score || 'N/A'} (${anime.scored_by ? anime.scored_by.toLocaleString('es-CL') : '0'} votos)</span> | 
                  <span>Rank: #${anime.rank || 'N/A'}</span> | 
                  <span>Popularidad: #${anime.popularity || 'N/A'}</span>
              </div>
              <div class="detail-genres" id="anime-genres">
                  ${genresHTML}
              </div>

              <h2>Sinopsis</h2>
              <p id="anime-synopsis">${anime.synopsis || 'No hay sinopsis disponible.'}</p>

              <h2>Información Adicional</h2>
              <ul id="anime-info-list">
                  ${infoListHTML}
              </ul>

              <div id="anime-trailer-section" class="${!anime.trailer?.embed_url ? 'hidden' : ''}">
                  <h2>Trailer</h2>
                  <div class="trailer-container">
                      <iframe id="anime-trailer-iframe" width="560" height="315" 
                              src="${anime.trailer?.embed_url ? anime.trailer.embed_url.replace('autoplay=1', 'autoplay=0') : ''}" 
                              title="Anime Trailer" frameborder="0" 
                              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                              allowfullscreen></iframe>
                  </div>
              </div>
          </div>
      </div>
    `;

    // Reemplazar contenido del contenedor principal
    detailContent.innerHTML = contentHTML;

    // --- Añadir listeners para futuros botones ---
    // const rateButton = document.getElementById('rate-button');
    // const favoriteButton = document.getElementById('favorite-button');
    // if(rateButton) rateButton.addEventListener('click', () => alert('Función de puntuar no implementada'));
    // if(favoriteButton) favoriteButton.addEventListener('click', () => alert('Función de favoritos no implementada'));
}

// --- Función para aplicar clase de fondo basada en emoción ---
function setEmotionBackground(anime) {
    const container = document.querySelector('.detail-container'); // O podrías usar document.body
    if (!container) return;

    // Limpiar clases de emoción anteriores
    container.className = 'detail-container'; // Resetea a la clase base

    const emotions = assignEmotions(anime.genres);
    const primaryEmotion = emotions[0] || 'epic'; // Tomar la primera emoción

    // Añadir la clase CSS correspondiente al fondo
    const backgroundClass = `emotion-bg-${primaryEmotion}`;
    container.classList.add(backgroundClass);
    console.log(`Aplicando fondo para emoción: ${primaryEmotion} (Clase: ${backgroundClass})`);
}


// --- Ejecutar al cargar la página ---
document.addEventListener('DOMContentLoaded', loadAnimeDetails);