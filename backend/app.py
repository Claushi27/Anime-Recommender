# backend/app.py

import json
import os
from flask import Flask, jsonify, request, send_from_directory 
from flask_cors import CORS 
import re 
import time 
import math 
import pandas as pd 
from flask_sqlalchemy import SQLAlchemy 
from werkzeug.security import generate_password_hash, check_password_hash 
from flask_jwt_extended import create_access_token, jwt_required, JWTManager, get_jwt_identity 

# --- Definición de Rutas Base ---
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
STATIC_FOLDER = BASE_DIR
TEMPLATE_FOLDER = BASE_DIR

# --- Inicialización de Flask ---
app = Flask(__name__,
            static_folder=STATIC_FOLDER,
            template_folder=TEMPLATE_FOLDER,
            static_url_path='')

# --- Configuración de la Base de Datos y JWT ---
app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+mysqlconnector://root:@localhost/aniemotion_db' 
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = 'tu-super-secreta-y-larga-clave-jwt-aniemotion-123!@#' 
db = SQLAlchemy(app)
jwt = JWTManager(app)

# --- Habilitar CORS ---
CORS(app)

# --- Modelos SQLAlchemy ---
class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.TIMESTAMP, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.TIMESTAMP, server_default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())
    anime_list_entries = db.relationship('UserAnimeList', back_populates='user', lazy='dynamic', cascade="all, delete-orphan")
    reviews = db.relationship('AnimeReview', back_populates='user', lazy='dynamic', cascade="all, delete-orphan")
    def set_password(self, password): self.password_hash = generate_password_hash(password)
    def check_password(self, password): return check_password_hash(self.password_hash, password)
    def __repr__(self): return f'<User {self.username}>'

class UserAnimeList(db.Model):
    __tablename__ = 'user_anime_list'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    anime_mal_id = db.Column(db.Integer, nullable=False)
    status = db.Column(db.Enum('watching', 'completed', 'planned', 'dropped', 'on_hold', 'favorites', name='animestatusenum'), nullable=False)
    score = db.Column(db.Integer, db.CheckConstraint('score IS NULL OR (score >= 1 AND score <= 10)'))
    episodes_watched = db.Column(db.Integer)
    added_at = db.Column(db.TIMESTAMP, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.TIMESTAMP, server_default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())
    user = db.relationship('User', back_populates='anime_list_entries')
    __table_args__ = (db.UniqueConstraint('user_id', 'anime_mal_id', name='uk_user_anime'),)
    def __repr__(self): return f'<UserAnimeList user_id={self.user_id} anime_id={self.anime_mal_id} status={self.status}>'
    def to_dict(self):
        return {
            'id': self.id, 'user_id': self.user_id, 'anime_mal_id': self.anime_mal_id,
            'status': self.status, 'score': self.score, 'episodes_watched': self.episodes_watched,
            'added_at': self.added_at.isoformat() if self.added_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class AnimeReview(db.Model):
    __tablename__ = 'anime_reviews'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    anime_mal_id = db.Column(db.Integer, nullable=False)
    review_text = db.Column(db.Text, nullable=False)
    rating_given = db.Column(db.Integer, db.CheckConstraint('rating_given IS NULL OR (rating_given >= 1 AND rating_given <= 10)'))
    is_spoiler = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.TIMESTAMP, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.TIMESTAMP, server_default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())
    user = db.relationship('User', back_populates='reviews')
    __table_args__ = (db.UniqueConstraint('user_id', 'anime_mal_id', name='uk_user_anime_review'),)
    def __repr__(self): return f'<AnimeReview user_id={self.user_id} anime_id={self.anime_mal_id}>'
    def to_dict(self):
        return {
            'id': self.id, 'user_id': self.user_id, 'username': self.user.username, 
            'anime_mal_id': self.anime_mal_id, 'review_text': self.review_text,
            'rating_given': self.rating_given, 'is_spoiler': self.is_spoiler,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

# --- Mapeo TAGS a Emociones y Funciones Helper ---
# (Sin cambios)
tag_emotion_map = {
    'action': ['epic', 'tension'], 'adventure': ['epic', 'wonder'], 'comedy': ['happy', 'wonder'], 
    'drama': ['sad', 'nostalgia'], 'slice of life': ['nostalgia', 'happy'], 'horror': ['tension', 'wonder'],
    'thriller': ['tension', 'epic'], 'suspense': ['tension'], 'psychological': ['tension', 'sad'], 
    'sci-fi': ['wonder', 'epic'], 'fantasy': ['wonder', 'epic'], 'romance': ['nostalgia', 'happy'],
    'music': ['nostalgia', 'happy'], 'sports': ['epic', 'happy'], 'supernatural': ['wonder', 'tension'], 
    'mystery': ['tension', 'wonder'], 'default': ['epic', 'wonder']
}
def extract_mal_id(sources): # (Sin cambios)
    if not isinstance(sources, list): return None
    for url in sources:
        if isinstance(url, str) and 'myanimelist.net/anime/' in url:
            match = re.search(r'/anime/(\d+)', url)
            if match:
                try: return int(match.group(1))
                except ValueError: continue
    return None
def assign_emotions_from_tags(tags): # (Sin cambios)
    if not isinstance(tags, list) or len(tags) == 0: return ",".join(tag_emotion_map['default'])
    emotions_set = set(); found_specific_emotion = False
    for tag in tags:
        emotions = tag_emotion_map.get(str(tag).lower() if tag else "")
        if emotions and len(emotions) > 0:
            found_specific_emotion = True
            for emotion in emotions: emotions_set.add(emotion)
    if not found_specific_emotion and tags:
        for emotion in tag_emotion_map['default']: emotions_set.add(emotion)
    elif not tags:
         for emotion in tag_emotion_map['default']: emotions_set.add(emotion)
    final_emotions = list(emotions_set)
    return ",".join(final_emotions)

# --- Carga y Preprocesamiento de Datos JSON ---
# (Sin cambios)
anime_data = []
anime_df = None
try:
    start_time = time.time(); backend_dir = os.path.dirname(os.path.abspath(__file__))
    json_path = os.path.join(backend_dir, '..', 'data', 'anime-offline-database-minified.json')
    json_path = os.path.normpath(json_path)
    if not os.path.exists(json_path): print(f">>> ERROR: Archivo JSON no encontrado en: {json_path}")
    else:
        with open(json_path, 'r', encoding='utf-8') as f: raw_database_object = json.load(f)
        processed_count = 0; skipped_count = 0; temp_anime_list = []
        for anime_dict_raw in raw_database_object.get('data', []):
            anime_dict = dict(anime_dict_raw); mal_id = extract_mal_id(anime_dict.get('sources'))
            if mal_id:
                anime_dict['mal_id'] = mal_id; anime_dict['emotions_assigned'] = assign_emotions_from_tags(anime_dict.get('tags'))
                try:
                    anime_dict['score_value'] = float(anime_dict.get('score', {}).get('arithmeticMean', 0))
                    if anime_dict['score_value'] == 0 and anime_dict.get('score'):
                        if isinstance(anime_dict.get('score'), (int, float)): anime_dict['score_value'] = float(anime_dict.get('score'))
                except (ValueError, TypeError): anime_dict['score_value'] = 0.0
                try:
                    if 'num_scoring_users' in anime_dict.get('statistics', {}): anime_dict['members_count'] = int(anime_dict['statistics']['num_scoring_users'])
                    elif 'members' in anime_dict: anime_dict['members_count'] = int(anime_dict['members'])
                    else: anime_dict['members_count'] = int(anime_dict.get('score', {}).get('usersVoted', 0))
                except (ValueError, TypeError): anime_dict['members_count'] = 0
                temp_anime_list.append(anime_dict); processed_count += 1
            else: skipped_count += 1
        anime_data = temp_anime_list; anime_df = pd.DataFrame(temp_anime_list); end_time = time.time()
        print(f">>> Preprocesamiento completo. {processed_count} animes cargados, {skipped_count} omitidos. Tiempo: {end_time - start_time:.2f}s.")
        del raw_database_object, temp_anime_list
except Exception as e: print(f">>> ERROR FATAL al cargar/procesar JSON: {e}"); import traceback; traceback.print_exc()

# --- Rutas para Servir Frontend ---
# (Sin cambios)
@app.route('/')
def serve_index(): return send_from_directory(app.template_folder, 'index.html')
@app.route('/detalle.html')
def serve_detalle(): return send_from_directory(app.template_folder, 'detalle.html')
@app.route('/ranking.html')
def serve_ranking(): return send_from_directory(app.template_folder, 'ranking.html')
@app.route('/search.html')
def serve_search(): return send_from_directory(app.template_folder, 'search.html')

# --- Rutas de API para Autenticación ---
# (Sin cambios)
@app.route('/api/auth/register', methods=['POST'])
def register_user():
    data = request.get_json(); username = data.get('username'); email = data.get('email'); password = data.get('password')
    if not username or not email or not password: return jsonify({"msg": "Faltan datos"}), 400
    if User.query.filter_by(username=username).first(): return jsonify({"msg": "Usuario ya existe"}), 409
    if User.query.filter_by(email=email).first(): return jsonify({"msg": "Email ya registrado"}), 409
    new_user = User(username=username, email=email); new_user.set_password(password)
    try: db.session.add(new_user); db.session.commit(); return jsonify({"msg": "Usuario creado"}), 201
    except Exception as e: db.session.rollback(); print(f"Error: {e}"); return jsonify({"msg": "Error interno"}), 500

@app.route('/api/auth/login', methods=['POST'])
def login_user():
    data = request.get_json(); username_or_email = data.get('username_or_email'); password = data.get('password')
    if not username_or_email or not password: return jsonify({"msg": "Faltan datos"}), 400
    user = User.query.filter((User.username == username_or_email) | (User.email == username_or_email)).first()
    if user and user.check_password(password):
        access_token = create_access_token(identity=str(user.id))  
        return jsonify(access_token=access_token, user={'id': user.id, 'username': user.username, 'email': user.email}), 200
    else: return jsonify({"msg": "Credenciales incorrectas"}), 401

# --- Rutas de API para UserAnimeList ---
# (Sin cambios)
@app.route('/api/me/animelist', methods=['POST'])
@jwt_required()
def add_to_animelist():
    user_id_str = get_jwt_identity(); user_id = int(user_id_str); data = request.get_json()
    anime_mal_id = data.get('anime_mal_id'); status = data.get('status')
    score = data.get('score', None); episodes_watched = data.get('episodes_watched', None)
    if not anime_mal_id or not status: return jsonify({"msg": "anime_mal_id y status son requeridos"}), 400
    allowed_statuses = UserAnimeList.status.type.enums
    if status not in allowed_statuses:
        allowed_statuses_str = ', '.join(map(str, allowed_statuses))
        return jsonify({"msg": f"Status inválido. Valores permitidos: {allowed_statuses_str}"}), 400
    existing_entry = UserAnimeList.query.filter_by(user_id=user_id, anime_mal_id=anime_mal_id).first()
    if existing_entry: return jsonify({"msg": "Este anime ya está en tu lista. Actualízalo."}), 409
    new_entry = UserAnimeList(user_id=user_id, anime_mal_id=anime_mal_id, status=status, score=score, episodes_watched=episodes_watched)
    try: db.session.add(new_entry); db.session.commit(); return jsonify(new_entry.to_dict()), 201
    except Exception as e: db.session.rollback(); print(f"Error: {e}"); return jsonify({"msg": "Error interno"}), 500

@app.route('/api/me/animelist', methods=['GET'])
@jwt_required()
def get_my_animelist():
    user_id_str = get_jwt_identity(); user_id = int(user_id_str)
    user_list_entries = UserAnimeList.query.filter_by(user_id=user_id).order_by(UserAnimeList.updated_at.desc()).all()
    return jsonify([entry.to_dict() for entry in user_list_entries]), 200

@app.route('/api/me/animelist/<int:anime_mal_id>', methods=['GET'])
@jwt_required()
def get_animelist_entry(anime_mal_id):
    user_id_str = get_jwt_identity(); user_id = int(user_id_str)
    entry = UserAnimeList.query.filter_by(user_id=user_id, anime_mal_id=anime_mal_id).first()
    if not entry: return jsonify({"msg": "Anime no encontrado en tu lista"}), 404
    return jsonify(entry.to_dict()), 200

@app.route('/api/me/animelist/<int:anime_mal_id>', methods=['PUT'])
@jwt_required()
def update_animelist_entry(anime_mal_id):
    user_id_str = get_jwt_identity(); user_id = int(user_id_str); data = request.get_json()
    entry = UserAnimeList.query.filter_by(user_id=user_id, anime_mal_id=anime_mal_id).first()
    if not entry: return jsonify({"msg": "Anime no encontrado en lista para actualizar"}), 404
    if 'status' in data:
        allowed_statuses = UserAnimeList.status.type.enums
        if data['status'] not in allowed_statuses:
            allowed_statuses_str = ', '.join(map(str, allowed_statuses))
            return jsonify({"msg": f"Status inválido. Valores permitidos: {allowed_statuses_str}"}), 400
        entry.status = data['status']
    if 'score' in data: entry.score = data['score'] 
    if 'episodes_watched' in data: entry.episodes_watched = data['episodes_watched']
    try: db.session.commit(); return jsonify(entry.to_dict()), 200
    except Exception as e: db.session.rollback(); print(f"Error: {e}"); return jsonify({"msg": "Error interno"}), 500

@app.route('/api/me/animelist/<int:anime_mal_id>', methods=['DELETE'])
@jwt_required()
def delete_animelist_entry(anime_mal_id):
    user_id_str = get_jwt_identity(); user_id = int(user_id_str)
    entry = UserAnimeList.query.filter_by(user_id=user_id, anime_mal_id=anime_mal_id).first()
    if not entry: return jsonify({"msg": "Anime no encontrado en lista para eliminar"}), 404
    try: db.session.delete(entry); db.session.commit(); return jsonify({"msg": "Anime eliminado de lista"}), 200
    except Exception as e: db.session.rollback(); print(f"Error: {e}"); return jsonify({"msg": "Error interno"}), 500

# --- 👈 NUEVAS Rutas de API para AnimeReview ---
@app.route('/api/anime/<int:anime_mal_id>/reviews', methods=['POST'])
@jwt_required()
def create_anime_review(anime_mal_id):
    user_id_str = get_jwt_identity()
    user_id = int(user_id_str)
    data = request.get_json()

    review_text = data.get('review_text')
    rating_given = data.get('rating_given', None) # Opcional
    is_spoiler = data.get('is_spoiler', False)   # Opcional, default False

    if not review_text:
        return jsonify({"msg": "El texto de la review es requerido"}), 400
    
    # Verificar si ya existe una review para este usuario y anime
    existing_review = AnimeReview.query.filter_by(user_id=user_id, anime_mal_id=anime_mal_id).first()
    if existing_review:
        return jsonify({"msg": "Ya has escrito una review para este anime. Edítala en su lugar."}), 409

    new_review = AnimeReview(
        user_id=user_id,
        anime_mal_id=anime_mal_id,
        review_text=review_text,
        rating_given=rating_given,
        is_spoiler=is_spoiler
    )
    try:
        db.session.add(new_review)
        db.session.commit()
        return jsonify(new_review.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        print(f"Error al crear review: {e}")
        return jsonify({"msg": "Error interno al crear la review"}), 500

@app.route('/api/anime/<int:anime_mal_id>/reviews', methods=['GET'])
def get_anime_reviews(anime_mal_id):
    # Aquí podrías añadir paginación si esperas muchas reviews
    reviews = AnimeReview.query.filter_by(anime_mal_id=anime_mal_id).order_by(AnimeReview.created_at.desc()).all()
    return jsonify([review.to_dict() for review in reviews]), 200

@app.route('/api/reviews/<int:review_id>', methods=['PUT'])
@jwt_required()
def update_anime_review(review_id):
    user_id_str = get_jwt_identity()
    user_id = int(user_id_str)
    data = request.get_json()

    review = AnimeReview.query.get(review_id)
    if not review:
        return jsonify({"msg": "Review no encontrada"}), 404
    
    if review.user_id != user_id:
        return jsonify({"msg": "No autorizado para editar esta review"}), 403 # Forbidden

    if 'review_text' in data:
        review.review_text = data['review_text']
    if 'rating_given' in data:
        review.rating_given = data['rating_given']
    if 'is_spoiler' in data:
        review.is_spoiler = data['is_spoiler']
    
    try:
        db.session.commit()
        return jsonify(review.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        print(f"Error al actualizar review: {e}")
        return jsonify({"msg": "Error interno al actualizar la review"}), 500

@app.route('/api/reviews/<int:review_id>', methods=['DELETE'])
@jwt_required()
def delete_anime_review(review_id):
    user_id_str = get_jwt_identity()
    user_id = int(user_id_str)

    review = AnimeReview.query.get(review_id)
    if not review:
        return jsonify({"msg": "Review no encontrada"}), 404
    
    if review.user_id != user_id:
        # En un caso real, podrías permitir a administradores borrar cualquier review
        return jsonify({"msg": "No autorizado para eliminar esta review"}), 403

    try:
        db.session.delete(review)
        db.session.commit()
        return jsonify({"msg": "Review eliminada exitosamente"}), 200
    except Exception as e:
        db.session.rollback()
        print(f"Error al eliminar review: {e}")
        return jsonify({"msg": "Error interno al eliminar la review"}), 500


# --- Rutas de la API (Existentes para recomendaciones y detalles de JSON) ---
# (Se mantienen igual)
@app.route('/api/recommendations/emotion/<string:emotion_tag>')
def recommend_by_emotion(emotion_tag):
    # (Lógica existente sin cambios)
    if not anime_data: return jsonify({"error": "Datos de anime no disponibles (lista)", "recommendations": [], "pagination": None}), 500
    try:
        page = int(request.args.get('page', 1)); limit = int(request.args.get('limit', 20))
        if page < 1: page = 1; 
        if limit < 1: limit = 20
        filtered_anime_list = [anime for anime in anime_data if emotion_tag in anime.get('emotions_assigned', '').split(',')]
        if not filtered_anime_list: return jsonify({"recommendations": [], "pagination": {"current_page": page, "limit": limit, "total_results": 0, "total_pages": 0, "has_next_page": False}})
        sorted_list = sorted(filtered_anime_list, key=lambda x: (x.get('score_value', 0), x.get('members_count', 0)), reverse=True)
        total_results = len(sorted_list); total_pages = math.ceil(total_results / limit) if total_results > 0 else 0
        if page > total_pages and total_pages > 0: page = total_pages
        start_index = (page - 1) * limit; end_index = start_index + limit
        paginated_list = sorted_list[start_index:end_index]
        recommendations_output = []
        for anime_row in paginated_list:
            anime_synonyms = anime_row.get('synonyms', []); synopsis_text = anime_synonyms[0] if isinstance(anime_synonyms, list) and anime_synonyms else 'Sin sinopsis disponible.'
            genre_tags_str = ""; 
            if isinstance(anime_row.get('tags'), list): genre_tags_str = ", ".join(filter(None, map(str, anime_row.get('tags', []))))
            recommendations_output.append({'mal_id': anime_row.get('mal_id'),'title': anime_row.get('title'),'rating': anime_row.get('score_value', 'N/A'),'genre': genre_tags_str,'Emotions': anime_row.get('emotions_assigned'),'Image_URL': anime_row.get('picture'),'thumbnailURL': anime_row.get('thumbnail'),'Synopsis': synopsis_text,'score': anime_row.get('score_value', 0),'scored_by': anime_row.get('members_count', 0),'images': {'jpg': {'image_url': anime_row.get('thumbnail'), 'large_image_url': anime_row.get('picture')}},'studios': [{'name': studio} for studio in anime_row.get('studios', [])] if isinstance(anime_row.get('studios'), list) else [],'episodes': anime_row.get('episodes'),'type': anime_row.get('type')})
        pagination_info = {"current_page": page, "limit": limit, "total_results": total_results, "total_pages": total_pages, "has_next_page": page < total_pages}
        return jsonify({"recommendations": recommendations_output, "pagination": pagination_info})
    except Exception as e: import traceback; traceback.print_exc(); return jsonify({"error": "Error procesando recomendación", "recommendations": [], "pagination": None}), 500

@app.route('/api/anime/<int:anime_id>')
def get_anime_details_by_id(anime_id):
    # (Lógica existente sin cambios)
    if not anime_data: return jsonify({"error": "Datos no cargados"}), 500
    try:
        found_anime = next((anime for anime in anime_data if anime.get('mal_id') == anime_id), None)
        if found_anime:
            anime_synonyms = found_anime.get('synonyms', []); synopsis_text = anime_synonyms[0] if isinstance(anime_synonyms, list) and anime_synonyms else 'Sin sinopsis detallada.'
            genres_list = []; 
            if isinstance(found_anime.get('tags'), list): genres_list = [{'name': str(tag)} for tag in found_anime.get('tags')]
            details = {'mal_id': found_anime.get('mal_id'), 'title': found_anime.get('title'),'title_japanese': next((s for s in found_anime.get('synonyms', []) if any(c in s for c in '一二三四五六七八九十百千万人日年月曜火水木金土')), None),'images': { 'jpg': { 'image_url': found_anime.get('thumbnail'), 'large_image_url': found_anime.get('picture')}},'score': found_anime.get('score_value'),'rank': None, 'popularity': None,'members': found_anime.get('members_count'),'synopsis': synopsis_text, 'type': found_anime.get('type'), 'episodes': found_anime.get('episodes'),'status': found_anime.get('status'),'aired': { 'string': f"{found_anime.get('animeSeason', {}).get('season', 'N/A')} {found_anime.get('animeSeason', {}).get('year', 'N/A')}" },'duration': f"{found_anime.get('duration', {}).get('value')} seg" if found_anime.get('duration') else 'N/A','rating': None, 'studios': [{'name': studio} for studio in found_anime.get('studios', [])] if isinstance(found_anime.get('studios'), list) else [],'source': found_anime.get('sources')[0] if isinstance(found_anime.get('sources'), list) and found_anime.get('sources') else 'N/A','genres': genres_list,'emotions_assigned': found_anime.get('emotions_assigned', '').split(','),'trailer': None}
            return jsonify({"data": details})
        else: return jsonify({"error": f"Anime con ID {anime_id} no encontrado"}), 404
    except Exception as e: import traceback; traceback.print_exc(); return jsonify({"error": "Error obteniendo detalles"}), 500

@app.route('/api/ranking/custom')
def custom_ranking():
    # (Lógica existente sin cambios)
    global anime_df
    if anime_df is None or anime_df.empty: return jsonify({"error": "Datos de anime no disponibles (DataFrame)", "data": [], "pagination": None}), 500
    try:
        min_votes_threshold = int(request.args.get('min_votes', 10000)); page = int(request.args.get('page', 1)); limit = int(request.args.get('limit', 25))
        df_copy = anime_df.copy()
        if 'members_count' not in df_copy.columns or not pd.api.types.is_numeric_dtype(df_copy['members_count']): pass
        else: df_copy = df_copy[df_copy['members_count'] >= min_votes_threshold]
        if 'score_value' not in df_copy.columns or not pd.api.types.is_numeric_dtype(df_copy['score_value']): sorted_df = df_copy
        else: sorted_df = df_copy.sort_values(by=['score_value', 'members_count'], ascending=[False, False])
        total_results = len(sorted_df); total_pages = math.ceil(total_results / limit) if total_results > 0 else 0
        if page > total_pages and total_pages > 0: page = total_pages
        start_index = (page - 1) * limit; end_index = start_index + limit
        paginated_df = sorted_df.iloc[start_index:end_index]
        results_output = []
        for i, anime_row_series in paginated_df.iterrows():
            anime_dict = anime_row_series.to_dict()
            try: original_rank_in_sorted_full_list = sorted_df.index.get_loc(i) + 1
            except KeyError: original_rank_in_sorted_full_list = -1 
            genres_list_for_output = []
            if isinstance(anime_dict.get('tags'), list): genres_list_for_output = [{'name': str(tag)} for tag in anime_dict.get('tags')]
            elif isinstance(anime_dict.get('tags'), str): genres_list_for_output = [{'name': tag.strip()} for tag in anime_dict.get('tags').split(',') if tag.strip()]
            results_output.append({'mal_id': anime_dict.get('mal_id'),'title': anime_dict.get('title'),'images': {'jpg': {'image_url': anime_dict.get('thumbnail'), 'large_image_url': anime_dict.get('picture')}},'score': anime_dict.get('score_value'),'rank': original_rank_in_sorted_full_list,'members': anime_dict.get('members_count'),'scored_by': anime_dict.get('members_count'),'episodes': anime_dict.get('episodes'),'type': anime_dict.get('type'),'year': anime_dict.get('animeSeason', {}).get('year') if isinstance(anime_dict.get('animeSeason'), dict) else None,'status': anime_dict.get('status'),'genres': genres_list_for_output,'studios': [{'name': studio} for studio in anime_dict.get('studios', [])] if isinstance(anime_dict.get('studios'), list) else [],'synopsis': (anime_dict.get('synonyms', [])[0] if isinstance(anime_dict.get('synonyms'), list) and anime_dict.get('synonyms') else anime_dict.get('synopsis', 'Sin descripción.'))})
        pagination_info = {"current_page": page, "limit": limit,"total_results": total_results, "total_pages": total_pages,"has_next_page": page < total_pages}
        return jsonify({"data": results_output, "pagination": pagination_info})
    except Exception as e: import traceback; traceback.print_exc(); return jsonify({"error": "Error procesando ranking custom", "data": [], "pagination": None}), 500

# --- Ejecutar Servidor ---
if __name__ == '__main__':
  with app.app_context():
    db.create_all()
  app.run(debug=True, host='0.0.0.0', port=int(os.environ.get('PORT', 5001)))
