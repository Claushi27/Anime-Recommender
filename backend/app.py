# backend/app.py

import json
import os
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import re
import time
import math
import pandas as pd

# --- Definición de Rutas Base ---
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
STATIC_FOLDER = BASE_DIR
TEMPLATE_FOLDER = BASE_DIR

# --- Inicialización de Flask ---
app = Flask(__name__,
            static_folder=STATIC_FOLDER,
            template_folder=TEMPLATE_FOLDER,
            static_url_path='')

# --- Habilitar CORS ---
CORS(app)

# --- Mapeo TAGS a Emociones y Funciones Helper ---
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
        # Asegurarse que tag es string antes de lower()
        emotions = tag_emotion_map.get(str(tag).lower() if tag else "")
        if emotions and len(emotions) > 0:
            found_specific_emotion = True
            for emotion in emotions: emotions_set.add(emotion)
    if not found_specific_emotion and tags: # Si hay tags pero ninguno mapeó, usar default
        for emotion in tag_emotion_map['default']: emotions_set.add(emotion)
    elif not tags: # Si no hay tags, usar default
         for emotion in tag_emotion_map['default']: emotions_set.add(emotion)
    final_emotions = list(emotions_set)
    return ",".join(final_emotions)

# --- Carga y Preprocesamiento de Datos JSON ---
anime_data = []
anime_df = None # DataFrame global para el ranking custom
try:
    start_time = time.time()
    backend_dir = os.path.dirname(os.path.abspath(__file__))
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
        temp_anime_list = []
        for anime_dict_raw in raw_database_object.get('data', []):
            # Copiar el diccionario para no modificar el original si es necesario
            anime_dict = dict(anime_dict_raw)
            mal_id = extract_mal_id(anime_dict.get('sources'))
            if mal_id:
                anime_dict['mal_id'] = mal_id
                anime_dict['emotions_assigned'] = assign_emotions_from_tags(anime_dict.get('tags'))
                # Extraer score y members/scored_by para el DataFrame
                try:
                    anime_dict['score_value'] = float(anime_dict.get('score', {}).get('arithmeticMean', 0))
                    if anime_dict['score_value'] == 0 and anime_dict.get('score'): # Si arithmeticMean no está pero score sí
                        # Intenta otras llaves comunes o un promedio si hay múltiples scores
                         # Esto es un ejemplo, ajusta según tu estructura si 'score' es un número directo
                        if isinstance(anime_dict.get('score'), (int, float)):
                             anime_dict['score_value'] = float(anime_dict.get('score'))
                except (ValueError, TypeError):
                    anime_dict['score_value'] = 0.0

                try:
                    # Prioriza 'members', luego 'scoredBy', luego 0
                    # El JSON parece usar 'relations' con 'relation': 'parent story' para 'members' a veces.
                    # MAL API usualmente tiene 'members' o 'scored_by'
                    # Tu JSON tiene 'num_scoring_users' a veces dentro de 'statistics' si viniera de Jikan API directamente
                    # Para el JSON offline, 'members' o un campo similar debe ser identificado.
                    # Asumiremos que 'num_scoring_users' podría estar o un campo 'members' si lo añades
                    # Por ahora, vamos a usar 'score.usersSkippedPlanning', que no es correcto, pero es un ejemplo de un campo numérico.
                    # NECESITAS IDENTIFICAR EL CAMPO CORRECTO PARA "NÚMERO DE VOTOS/MIEMBROS" EN TU JSON
                    # Ejemplo temporal (DEBES CAMBIAR ESTO POR EL CAMPO CORRECTO DE TU JSON):
                    if 'num_scoring_users' in anime_dict.get('statistics', {}): # Si tuvieras statistics de Jikan
                         anime_dict['members_count'] = int(anime_dict['statistics']['num_scoring_users'])
                    elif 'members' in anime_dict: # Si tuvieras un campo 'members' directo
                         anime_dict['members_count'] = int(anime_dict['members'])
                    else: # Fallback si no se encuentra un campo de conteo de votos/miembros
                        # Para el offline DB, 'score.usersVoted' podría ser el campo.
                        # O si el score viene de 'score' {'votes': X, 'mean': Y}, usar 'score.votes'
                        # Verifica la estructura de 'score' y 'ranking'/'popularity' en tu JSON.
                        # Por ahora, un placeholder:
                        anime_dict['members_count'] = int(anime_dict.get('score', {}).get('usersVoted', 0)) # EJEMPLO, VERIFICA TU JSON!

                except (ValueError, TypeError):
                    anime_dict['members_count'] = 0

                temp_anime_list.append(anime_dict)
                processed_count += 1
            else:
                skipped_count += 1
        
        anime_data = temp_anime_list # Usar para la recomendación por emoción
        anime_df = pd.DataFrame(temp_anime_list) # Crear DataFrame para el ranking custom

        end_time = time.time()
        print(f">>> Preprocesamiento completo. {processed_count} animes cargados en lista y DataFrame, {skipped_count} omitidos. Tiempo: {end_time - start_time:.2f}s.")
        if not anime_df.empty:
            print(">>> DataFrame Columnas:", anime_df.columns.tolist())
            print(">>> DataFrame Head (score_value, members_count):\n", anime_df[['title', 'mal_id', 'score_value', 'members_count']].head())
        del raw_database_object, temp_anime_list
except Exception as e:
    print(f">>> ERROR FATAL al cargar/procesar JSON: {e}")
    import traceback; traceback.print_exc()


# --- Rutas para Servir Frontend ---
@app.route('/')
def serve_index():
    return send_from_directory(app.template_folder, 'index.html')

@app.route('/detalle.html')
def serve_detalle():
    return send_from_directory(app.template_folder, 'detalle.html')

@app.route('/ranking.html') #Asegúrate que tienes esta ruta si existe ranking.html
def serve_ranking():
    return send_from_directory(app.template_folder, 'ranking.html')

@app.route('/search.html') #Asegúrate que tienes esta ruta si existe search.html
def serve_search():
    return send_from_directory(app.template_folder, 'search.html')


# --- Rutas de la API ---
@app.route('/api/recommendations/emotion/<string:emotion_tag>')
def recommend_by_emotion(emotion_tag):
    print(f">>> Petición emoción: {emotion_tag}")
    if not anime_data: # Usa la lista anime_data
        return jsonify({"error": "Datos de anime no disponibles (lista)", "recommendations": [], "pagination": None}), 500
    try:
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 20))
        if page < 1: page = 1
        if limit < 1: limit = 20

        filtered_anime_list = [
            anime for anime in anime_data # Itera sobre la lista de diccionarios
            if emotion_tag in anime.get('emotions_assigned', '').split(',')
        ]
        print(f">>> Animes encontrados para '{emotion_tag}' (antes de filtrar/ordenar): {len(filtered_anime_list)}")

        if not filtered_anime_list:
            return jsonify({
                "recommendations": [],
                "pagination": {"current_page": page, "limit": limit, "total_results": 0, "total_pages": 0, "has_next_page": False}
            })

        # Ordenar la lista de diccionarios directamente por 'score_value' (que ya es float)
        # y 'members_count' (que ya es int)
        # Filtrar scores >= 9.9 (si es que ese es el umbral que quieres quitar)
        # score_threshold = 9.9 # Puedes ajustar esto
        # sorted_list = sorted(
        #     [anime for anime in filtered_anime_list if anime.get('score_value', 0) < score_threshold],
        #     key=lambda x: (x.get('score_value', 0), x.get('members_count', 0)),
        #     reverse=True
        # )
        # Si no quieres filtrar por un score_threshold específico para las emociones:
        sorted_list = sorted(
            filtered_anime_list,
            key=lambda x: (x.get('score_value', 0), x.get('members_count', 0)), # Ordenar por score, luego por miembros
            reverse=True
        )


        total_results = len(sorted_list)
        total_pages = math.ceil(total_results / limit) if total_results > 0 else 0
        if page > total_pages and total_pages > 0: page = total_pages
        
        start_index = (page - 1) * limit
        end_index = start_index + limit
        paginated_list = sorted_list[start_index:end_index]
        print(f">>> Devolviendo resultados {start_index+1}-{min(end_index, total_results)} de {total_results} totales.")

        recommendations_output = []
        for anime_row in paginated_list:
            anime_synonyms = anime_row.get('synonyms', [])
            synopsis_text = anime_synonyms[0] if isinstance(anime_synonyms, list) and anime_synonyms else 'Sin sinopsis disponible.'
            
            # Asegurarse que los tags de 'genre' vienen como string
            genre_tags_str = ""
            if isinstance(anime_row.get('tags'), list):
                genre_tags_str = ", ".join(filter(None, map(str, anime_row.get('tags', []))))


            recommendations_output.append({
               'mal_id': anime_row.get('mal_id'),
               'title': anime_row.get('title'),
               'rating': anime_row.get('score_value', 'N/A'), # Usar score_value
               'genre': genre_tags_str, # Usar tags como string
               'Emotions': anime_row.get('emotions_assigned'),
               'Image_URL': anime_row.get('picture'),
               'thumbnailURL': anime_row.get('thumbnail'),
               'Synopsis': synopsis_text,
               # Campos adicionales que tu frontend pueda necesitar para displayAnimeCards
               'score': anime_row.get('score_value', 0), # Para displayAnimeCards
               'scored_by': anime_row.get('members_count', 0), # Para displayAnimeCards
               'images': {'jpg': {'image_url': anime_row.get('thumbnail'), 'large_image_url': anime_row.get('picture')}},
               'studios': [{'name': studio} for studio in anime_row.get('studios', [])] if isinstance(anime_row.get('studios'), list) else [], # Asumiendo que 'studios' es una lista de strings
               'episodes': anime_row.get('episodes'),
               'type': anime_row.get('type')
           })

        pagination_info = {
            "current_page": page, "limit": limit, 
            "total_results": total_results, "total_pages": total_pages,
            "has_next_page": page < total_pages
            }
        return jsonify({"recommendations": recommendations_output, "pagination": pagination_info})

    except Exception as e:
        print(f">>> ERROR recomendando por emoción '{emotion_tag}': {e}")
        import traceback; traceback.print_exc()
        return jsonify({"error": "Error procesando recomendación", "recommendations": [], "pagination": None}), 500


@app.route('/api/anime/<int:anime_id>')
def get_anime_details_by_id(anime_id):
    print(f">>> Petición detalles para ID: {anime_id}")
    if not anime_data: return jsonify({"error": "Datos no cargados"}), 500 # Usa la lista anime_data
    try:
        found_anime = next((anime for anime in anime_data if anime.get('mal_id') == anime_id), None)
        if found_anime:
            anime_synonyms = found_anime.get('synonyms', [])
            synopsis_text = anime_synonyms[0] if isinstance(anime_synonyms, list) and anime_synonyms else 'Sin sinopsis detallada.'
            
            # Preparar genres en el formato esperado por el frontend si es necesario
            genres_list = []
            if isinstance(found_anime.get('tags'), list):
                genres_list = [{'name': str(tag)} for tag in found_anime.get('tags')]

            details = {
                'mal_id': found_anime.get('mal_id'), 'title': found_anime.get('title'),
                'title_japanese': next((s for s in found_anime.get('synonyms', []) if any(c in s for c in '一二三四五六七八九十百千万人日年月曜火水木金土')), None),
                'images': { 'jpg': { 'image_url': found_anime.get('thumbnail'), 'large_image_url': found_anime.get('picture')}},
                'score': found_anime.get('score_value'), # Usar score_value preprocesado
                'rank': None,  # El rank de MAL no está directamente en el JSON offline así, se podría calcular si se ordena todo
                'popularity': None, # Similar al rank
                'members': found_anime.get('members_count'), # Usar members_count preprocesado
                'synopsis': synopsis_text, 'type': found_anime.get('type'), 'episodes': found_anime.get('episodes'),
                'status': found_anime.get('status'),
                'aired': { 'string': f"{found_anime.get('animeSeason', {}).get('season', 'N/A')} {found_anime.get('animeSeason', {}).get('year', 'N/A')}" },
                'duration': f"{found_anime.get('duration', {}).get('value')} seg" if found_anime.get('duration') else 'N/A', # Asumiendo que duration es un dict
                'rating': None, # Clasificación de edad (G, PG, etc.) - puede no estar en el JSON offline
                'studios': [{'name': studio} for studio in found_anime.get('studios', [])] if isinstance(found_anime.get('studios'), list) else [],
                'source': found_anime.get('sources')[0] if isinstance(found_anime.get('sources'), list) and found_anime.get('sources') else 'N/A', # O el campo correcto para la fuente original
                'genres': genres_list, # Usar la lista de tags formateada
                'emotions_assigned': found_anime.get('emotions_assigned', '').split(','),
                'trailer': None # El JSON offline no suele tener trailers
            }
            return jsonify({"data": details})
        else:
            return jsonify({"error": f"Anime con ID {anime_id} no encontrado"}), 404
    except Exception as e:
        print(f">>> ERROR obteniendo detalles para ID '{anime_id}': {e}")
        import traceback; traceback.print_exc()
        return jsonify({"error": "Error obteniendo detalles"}), 500

# NUEVO ENDPOINT PARA RANKING CUSTOM
@app.route('/api/ranking/custom')
def custom_ranking():
    global anime_df # Usar el DataFrame global
    if anime_df is None or anime_df.empty:
        return jsonify({"error": "Datos de anime no disponibles (DataFrame)", "data": [], "pagination": None}), 500

    try:
        min_votes_threshold = int(request.args.get('min_votes', 10000)) # Umbral de votos
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 25))

        # Copiar el DataFrame para no modificar el original si se hacen más llamadas
        df_copy = anime_df.copy()

        # Filtrar por el umbral de votos usando la columna 'members_count'
        # Asegurarse que 'members_count' es numérica
        if 'members_count' not in df_copy.columns or not pd.api.types.is_numeric_dtype(df_copy['members_count']):
             print("Advertencia: 'members_count' no es numérica o no existe. No se puede filtrar por votos.")
             # Podrías retornar un error o continuar sin el filtro de votos
        else:
            df_copy = df_copy[df_copy['members_count'] >= min_votes_threshold]
        
        # Asegurarse que 'score_value' es numérica
        if 'score_value' not in df_copy.columns or not pd.api.types.is_numeric_dtype(df_copy['score_value']):
            print("Advertencia: 'score_value' no es numérica o no existe. No se puede ordenar por score.")
            # Podrías retornar un error o usar otro criterio de ordenamiento
            sorted_df = df_copy # Devolver sin ordenar por score si no se puede
        else:
            # Ordenar: primero por score_value descendente, luego por members_count como desempate
            sorted_df = df_copy.sort_values(by=['score_value', 'members_count'], ascending=[False, False])

        # Paginación
        total_results = len(sorted_df)
        total_pages = math.ceil(total_results / limit) if total_results > 0 else 0
        if page > total_pages and total_pages > 0: page = total_pages
        
        start_index = (page - 1) * limit
        end_index = start_index + limit
        paginated_df = sorted_df.iloc[start_index:end_index]

        results_output = []
        for i, anime_row_series in paginated_df.iterrows():
            # Convertir la Serie de Pandas a un diccionario
            anime_dict = anime_row_series.to_dict()
            
            # El 'rank' es la posición en el sorted_df completo + 1
            # Se necesita el índice original de la fila en sorted_df (antes de la paginación)
            # Para esto, podemos resetear el índice de sorted_df y usar el nuevo índice
            # o iterar sobre sorted_df con un contador antes de paginar.
            # Una forma más simple: obtener la posición de `i` (índice original de anime_df) en `sorted_df.index`
            try:
                original_rank_in_sorted_full_list = sorted_df.index.get_loc(i) + 1
            except KeyError: # Si el índice no se encuentra (no debería pasar si i viene de paginated_df)
                original_rank_in_sorted_full_list = -1 


            genres_list_for_output = []
            if isinstance(anime_dict.get('tags'), list):
                 genres_list_for_output = [{'name': str(tag)} for tag in anime_dict.get('tags')]
            elif isinstance(anime_dict.get('tags'), str): # Si 'tags' es una cadena separada por comas
                 genres_list_for_output = [{'name': tag.strip()} for tag in anime_dict.get('tags').split(',') if tag.strip()]


            results_output.append({
               'mal_id': anime_dict.get('mal_id'),
               'title': anime_dict.get('title'),
               'images': {'jpg': {'image_url': anime_dict.get('thumbnail'), 'large_image_url': anime_dict.get('picture')}},
               'score': anime_dict.get('score_value'), # Score numérico
               'rank': original_rank_in_sorted_full_list, # El rank calculado
               'members': anime_dict.get('members_count'), # members_count numérico
               'scored_by': anime_dict.get('members_count'), # Para consistencia con displayAnimeCards
               'episodes': anime_dict.get('episodes'),
               'type': anime_dict.get('type'),
               'year': anime_dict.get('animeSeason', {}).get('year') if isinstance(anime_dict.get('animeSeason'), dict) else None,
               'status': anime_dict.get('status'),
               'genres': genres_list_for_output,
               'studios': [{'name': studio} for studio in anime_dict.get('studios', [])] if isinstance(anime_dict.get('studios'), list) else [],
               'synopsis': (anime_dict.get('synonyms', [])[0] if isinstance(anime_dict.get('synonyms'), list) and anime_dict.get('synonyms') else anime_dict.get('synopsis', 'Sin descripción.'))
               # ... otros campos que displayAnimeCards o displayRankingList puedan necesitar ...
            })

        pagination_info = {
            "current_page": page, "limit": limit,
            "total_results": total_results, "total_pages": total_pages,
            "has_next_page": page < total_pages
        }
        
        # La API de Jikan para /top/anime devuelve {data: [...], pagination: {...}}
        # Para ser consistente, devolvemos la misma estructura.
        return jsonify({"data": results_output, "pagination": pagination_info})

    except Exception as e:
        print(f">>> ERROR en custom_ranking: {e}")
        import traceback; traceback.print_exc()
        return jsonify({"error": "Error procesando ranking custom", "data": [], "pagination": None}), 500


# --- Ejecutar Servidor (Configuración para Render) ---
# Render buscará un callable llamado 'app' por defecto, así que no necesitamos el if __name__ == '__main__': app.run()
# Simplemente asegúrate que tu Procfile (si usas uno) o el comando de inicio de Render llame a este archivo
# de una manera que Flask pueda ser servido por un servidor WSGI como Gunicorn.
# Ejemplo para Gunicorn: gunicorn app:app
# No es necesario if __name__ == '__main__': app.run(debug=True) para producción en Render.
# Si quieres probar localmente con `python app.py`, puedes descomentar:
if __name__ == '__main__':
  app.run(debug=True, host='0.0.0.0', port=int(os.environ.get('PORT', 5001)))