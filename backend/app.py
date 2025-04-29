# backend/app.py (Versión FINAL para Despliegue en Render)

import json
import os
# vvv Asegúrate que send_from_directory está importado vvv
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import re
import time
import math
import pandas as pd

# --- Definición de Rutas Base (Correcto) ---
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
STATIC_FOLDER = BASE_DIR
TEMPLATE_FOLDER = BASE_DIR

# --- Inicialización de Flask (Correcto) ---
app = Flask(__name__,
            static_folder=STATIC_FOLDER,
            template_folder=TEMPLATE_FOLDER,
            static_url_path='')

# --- Habilitar CORS (Correcto) ---
CORS(app)

# --- Mapeo TAGS a Emociones y Funciones Helper (Correcto) ---
tag_emotion_map = {
    'action': ['epic', 'tension'], 'adventure': ['epic', 'wonder'],
    'comedy': ['happy', 'wonder'], 'drama': ['sad', 'nostalgia'],
    'slice of life': ['nostalgia', 'happy'], 'horror': ['tension', 'wonder'],
    'thriller': ['tension', 'epic'], 'suspense': ['tension'],
    'psychological': ['tension', 'sad'], 'sci-fi': ['wonder', 'epic'],
    'fantasy': ['wonder', 'epic'], 'romance': ['nostalgia', 'happy'],
    'music': ['nostalgia', 'happy'], 'sports': ['epic', 'happy'],
    'supernatural': ['wonder', 'tension'], 'mystery': ['tension', 'wonder'],
    'default': ['epic', 'wonder']
}
def extract_mal_id(sources):
    if not isinstance(sources, list): return None
    for url in sources:
        if isinstance(url, str) and 'myanimelist.net/anime/' in url:
            match = re.search(r'/anime/(\d+)', url)
            if match:
                try: return int(match.group(1))
                except ValueError: continue
    return None
def assign_emotions_from_tags(tags):
    if not isinstance(tags, list) or len(tags) == 0: return ",".join(tag_emotion_map['default'])
    emotions_set = set(); found_specific_emotion = False
    for tag in tags:
        emotions = tag_emotion_map.get(str(tag).lower())
        if emotions and len(emotions) > 0:
            found_specific_emotion = True
            for emotion in emotions: emotions_set.add(emotion)
    if not found_specific_emotion and tags:
        for emotion in tag_emotion_map['default']: emotions_set.add(emotion)
    final_emotions = list(emotions_set)
    return ",".join(final_emotions)

# --- Carga y Preprocesamiento de Datos JSON (Correcto) ---
anime_data = []
try:
    start_time = time.time()
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    # Asume que data/ está al mismo nivel que backend/
    json_path = os.path.join(backend_dir, '..', 'data', 'anime-offline-database-minified.json')
    json_path = os.path.normpath(json_path)
    print(f">>> Intentando cargar JSON desde: {json_path}")
    if not os.path.exists(json_path):
         print(f">>> ERROR: Archivo JSON no encontrado en: {json_path}")
    else:
        with open(json_path, 'r', encoding='utf-8') as f:
            raw_database_object = json.load(f)
        print(">>> JSON cargado. Preprocesando datos...")
        processed_count = 0; skipped_count = 0
        for anime_dict in raw_database_object.get('data', []):
            mal_id = extract_mal_id(anime_dict.get('sources'))
            if mal_id:
                anime_dict['mal_id'] = mal_id
                anime_dict['emotions_assigned'] = assign_emotions_from_tags(anime_dict.get('tags'))
                anime_data.append(anime_dict)
                processed_count += 1
            else: skipped_count += 1
        end_time = time.time()
        print(f">>> Preprocesamiento completo. {processed_count} animes cargados, {skipped_count} omitidos. Tiempo: {end_time - start_time:.2f}s.")
        del raw_database_object
except Exception as e:
    print(f">>> ERROR FATAL al cargar/procesar JSON: {e}")
    import traceback; traceback.print_exc()


# --- Rutas para Servir Frontend ---

@app.route('/')
def serve_index():
    """Sirve el archivo index.html principal."""
    # Busca index.html en la carpeta definida como template_folder (BASE_DIR)
    return send_from_directory(app.template_folder, 'index.html')

@app.route('/detalle.html')
def serve_detalle():
    """Sirve el archivo detalle.html."""
    # Busca detalle.html en la carpeta definida como template_folder (BASE_DIR)
    return send_from_directory(app.template_folder, 'detalle.html')

# Flask manejará automáticamente los archivos en static_folder (CSS, JS)
# gracias a static_url_path='' en la inicialización de app.

# --- Rutas de la API ---

@app.route('/api/recommendations/emotion/<string:emotion_tag>')
def recommend_by_emotion(emotion_tag):
    # ... (Código de esta función con paginación, sin cambios) ...
    print(f">>> Petición emoción: {emotion_tag}")
    if not anime_data:
        return jsonify({"error": "Datos de anime no disponibles", "recommendations": [], "pagination": None}), 500
    try:
        try:
            page = int(request.args.get('page', 1))
            limit = int(request.args.get('limit', 20))
            if page < 1: page = 1
            if limit < 1: limit = 20
        except ValueError:
            page = 1
            limit = 20
        print(f">>> Página solicitada: {page}, Límite: {limit}")

        filtered_anime_list = [
            anime for anime in anime_data
            if emotion_tag in anime.get('emotions_assigned', '').split(',')
        ]
        print(f">>> Animes encontrados para '{emotion_tag}' (antes de filtrar/ordenar): {len(filtered_anime_list)}")

        if not filtered_anime_list:
            return jsonify({
                "recommendations": [],
                "pagination": {"current_page": page, "limit": limit, "total_results": 0, "total_pages": 0}
            })

        filtered_df = pd.json_normalize(filtered_anime_list)
        numeric_score_created = False
        if 'score.arithmeticMean' in filtered_df.columns:
            filtered_df['numeric_score'] = pd.to_numeric(filtered_df['score.arithmeticMean'], errors='coerce').fillna(0)
            numeric_score_created = True
            score_threshold = 9.9
            original_count_before_score_filter = len(filtered_df)
            filtered_df = filtered_df[filtered_df['numeric_score'] < score_threshold]
            print(f">>> Filtrando scores >= {score_threshold}. Quedan {len(filtered_df)} de {original_count_before_score_filter} animes.")
            sorted_df = filtered_df.sort_values(by='numeric_score', ascending=False, na_position='last')
        elif 'score' in filtered_df.columns:
             print(f">>> Advertencia: 'score.arithmeticMean' no encontrada. No se pudo crear 'numeric_score' ni filtrar/ordenar por score.")
             sorted_df = filtered_df
        else:
             print(f">>> Advertencia: No se encontró columna 'score'. Devolviendo sin ordenar.")
             sorted_df = filtered_df

        total_results = len(sorted_df)
        total_pages = math.ceil(total_results / limit) if total_results > 0 else 0
        if page > total_pages and total_pages > 0: page = total_pages
        start_index = (page - 1) * limit
        end_index = start_index + limit
        paginated_df = sorted_df.iloc[start_index:end_index]
        print(f">>> Devolviendo resultados {start_index+1}-{min(end_index, total_results)} de {total_results} totales.")

        recommendations = []
        for index, anime_row in paginated_df.iterrows():
            anime_synonyms = anime_row.get('synonyms', [])
            synopsis_text = anime_synonyms[0] if isinstance(anime_synonyms, list) and anime_synonyms else 'Sin sinopsis disponible.'
            recommendations.append({
               'mal_id': anime_row.get('mal_id'),
               'title': anime_row.get('title'),
               'rating': anime_row.get('numeric_score') if numeric_score_created else anime_row.get('score.arithmeticMean', 'N/A'),
               'genre': ", ".join(anime_row.get('tags', [])),
               'Emotions': anime_row.get('emotions_assigned'),
               'Image_URL': anime_row.get('picture'),
               'thumbnailURL': anime_row.get('thumbnail'),
               'Synopsis': synopsis_text,
           })

        pagination_info = {"current_page": page, "limit": limit, "total_results": total_results, "total_pages": total_pages}
        return jsonify({"recommendations": recommendations, "pagination": pagination_info})

    except Exception as e:
        print(f">>> ERROR recomendando por emoción '{emotion_tag}': {e}")
        import traceback; traceback.print_exc()
        return jsonify({"error": "Error procesando recomendación", "recommendations": [], "pagination": None}), 500


@app.route('/api/anime/<int:anime_id>')
def get_anime_details_by_id(anime_id):
    # ... (Código de esta función sin cambios) ...
    print(f">>> Petición detalles para ID: {anime_id}")
    if not anime_data: return jsonify({"error": "Datos no cargados"}), 500
    try:
        found_anime = next((anime for anime in anime_data if anime.get('mal_id') == anime_id), None)
        if found_anime:
            anime_synonyms = found_anime.get('synonyms', [])
            synopsis_text = anime_synonyms[0] if isinstance(anime_synonyms, list) and anime_synonyms else 'Sin sinopsis detallada.'
            details = {
                'mal_id': found_anime.get('mal_id'), 'title': found_anime.get('title'),
                'title_japanese': next((s for s in found_anime.get('synonyms', []) if any(c in s for c in '一二三四五六七八九十百千万人日年月曜火水木金土')), None),
                'images': { 'jpg': { 'image_url': found_anime.get('thumbnail'), 'large_image_url': found_anime.get('picture')}},
                'score': found_anime.get('score', {}).get('arithmeticMean'), 'rank': None, 'popularity': None,
                'synopsis': synopsis_text, 'type': found_anime.get('type'), 'episodes': found_anime.get('episodes'),
                'status': found_anime.get('status'),
                'aired': { 'string': f"{found_anime.get('animeSeason', {}).get('season', 'N/A')} {found_anime.get('animeSeason', {}).get('year', 'N/A')}" },
                'duration': f"{found_anime.get('duration', {}).get('value')} seg" if found_anime.get('duration') else 'N/A',
                'rating': None, 'studios': [], 'source': None,
                'genres': [{'name': tag} for tag in found_anime.get('tags', [])],
                'emotions_assigned': found_anime.get('emotions_assigned', '').split(','),
                'trailer': None
            }
            return jsonify({"data": details})
        else:
            return jsonify({"error": f"Anime con ID {anime_id} no encontrado"}), 404
    except Exception as e:
        print(f">>> ERROR obteniendo detalles para ID '{anime_id}': {e}")
        import traceback; traceback.print_exc()
        return jsonify({"error": "Error obteniendo detalles"}), 500


# --- Ejecutar Servidor (ELIMINADO o COMENTADO para producción) ---
# if __name__ == '__main__':
# --- Ejecutar Servidor (ELIMINADO o COMENTADO para producción) ---
if __name__ == '__main__':
    pass # <--- AÑADE ESTA LÍNEA INDENTADA
#if __name__ == '__main__':
  #app.run(debug=True, host='127.0.0.1', port=5000)