import os
from datetime import datetime, timedelta
import json
from bson import ObjectId
from dotenv import dotenv_values
from flask import Flask, request, jsonify, send_from_directory, Response, send_file
from flask_cors import CORS
from flask_pymongo import PyMongo
from werkzeug.utils import secure_filename
from flask_bcrypt import Bcrypt
from flask_jwt_extended import (
    JWTManager,
    create_access_token,
    get_jwt_identity,
    jwt_required,
)
import librosa
import numpy as np
from pymongo.errors import ServerSelectionTimeoutError
from music21 import stream, note
from PIL import Image
import threading
import uuid

from omr.pipeline import OMRPipeline

app = Flask(__name__)
CORS(app, 
     resources={r"/*": {"origins": "*"}}, 
     supports_credentials=True,
     allow_headers=["Content-Type", "Authorization"],
     expose_headers=["Content-Disposition"],
     methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
bcrypt = Bcrypt(app)
jwt = JWTManager(app)

basedir = os.path.abspath(os.path.dirname(__file__))
UPLOAD_FOLDER = os.path.join(basedir, "uploads")
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
os.makedirs(os.path.join(UPLOAD_FOLDER, "conversions"), exist_ok=True)

config = {**dotenv_values(os.path.join(basedir, ".env")), **os.environ}

app.config["MONGO_URI"] = config.get("MONGO_URI")
app.config["JWT_SECRET_KEY"] = config.get("JWT_SECRET_KEY")

# Configure access token lifetime (seconds) via env JWT_ACCESS_TOKEN_EXPIRES_SECONDS
try:
    expires_seconds = int(config.get("JWT_ACCESS_TOKEN_EXPIRES_SECONDS", "600"))
except ValueError:
    expires_seconds = 600
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(seconds=expires_seconds)

# Warn if the JWT secret is too short (helps diagnose InsecureKeyLengthWarning)
if app.config.get("JWT_SECRET_KEY") and len(app.config.get("JWT_SECRET_KEY")) < 32:
    app.logger.warning(
        "JWT_SECRET_KEY length is %d bytes; recommended >= 32 bytes for HS256. Generate a stronger secret.",
        len(app.config.get("JWT_SECRET_KEY")),
    )

if not app.config["MONGO_URI"]:
    raise RuntimeError("MONGO_URI no esta configurada")

if not app.config["JWT_SECRET_KEY"]:
    raise RuntimeError("JWT_SECRET_KEY no esta configurada")

mongo = PyMongo(app)


def get_sheet_key(sheet):
    for field in ("sheet_key", "musicxml", "omr", "audio", "filename", "name"):
        value = sheet.get(field)
        if value:
            return str(value)
    return ""


def normalize_sheet(sheet):
    normalized = {}
    for k, v in sheet.items():
        if isinstance(v, ObjectId):
            normalized[k] = str(v)
        else:
            normalized[k] = v
    normalized["sheet_key"] = get_sheet_key(normalized)
    return normalized


def mongo_unavailable_response():
    return (
        jsonify(
            {
                "message": "No se puede conectar a MongoDB. Verifica que el servicio esté activo y que MONGO_URI sea correcta.",
            }
        ),
        503,
    )

omr_pipeline = OMRPipeline()


def build_openapi_spec():
    return {
        "openapi": "3.0.3",
        "info": {
            "title": "EasyTunr API",
            "version": "0.1.0",
            "description": "API Flask para autenticacion, carga de archivos y conversion OMR.",
        },
        "servers": [{"url": "http://localhost:5000", "description": "Local"}],
        "components": {
            "securitySchemes": {
                "bearerAuth": {
                    "type": "http",
                    "scheme": "bearer",
                    "bearerFormat": "JWT",
                }
            },
            "schemas": {
                "AuthCredentials": {
                    "type": "object",
                    "required": ["email", "password"],
                    "properties": {
                        "email": {"type": "string", "format": "email"},
                        "password": {"type": "string", "minLength": 6},
                    },
                },
                "RegisterResponse": {
                    "type": "object",
                    "properties": {"message": {"type": "string"}},
                },
                "LoginResponse": {
                    "type": "object",
                    "properties": {
                        "token": {"type": "string"},
                        "email": {"type": "string"},
                        "token_expires_in_seconds": {"type": "number"},
                    },
                },
                "UserResponse": {
                    "type": "object",
                    "properties": {"email": {"type": "string"}},
                },
                "SheetsResponse": {
                    "type": "object",
                    "properties": {
                        "sheets": {
                            "type": "array",
                            "items": {"type": "object"},
                        }
                    },
                },
                "HealthResponse": {
                    "type": "object",
                    "properties": {
                        "status": {"type": "string"},
                        "service": {"type": "string"},
                    },
                },
                "MessageResponse": {
                    "type": "object",
                    "properties": {"message": {"type": "string"}},
                },
                "ConversionStatusResponse": {
                    "type": "object",
                    "properties": {
                        "task_id": {"type": "string"},
                        "status": {"type": "string", "enum": ["pending", "processing", "completed", "failed"]},
                        "message": {"type": "string", "nullable": True},
                        "result": {"type": "object", "nullable": True}
                    },
                    "required": ["task_id", "status"]
                },
                "ErrorResponse": {
                    "type": "object",
                    "properties": {"message": {"type": "string"}},
                },
            },
        },
        "paths": {
            "/health": {
                "get": {
                    "summary": "Estado del servicio",
                    "responses": {
                        "200": {
                            "description": "Servicio listo",
                            "content": {
                                "application/json": {
                                    "schema": {"$ref": "#/components/schemas/HealthResponse"}
                                }
                            },
                        }
                    },
                }
            },
            "/register": {
                "post": {
                    "summary": "Registrar usuario",
                    "requestBody": {
                        "required": True,
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/AuthCredentials"}
                            }
                        },
                    },
                    "responses": {
                        "201": {
                            "description": "Usuario creado",
                            "content": {
                                "application/json": {
                                    "schema": {"$ref": "#/components/schemas/RegisterResponse"}
                                }
                            },
                        },
                        "400": {
                            "description": "Usuario ya existe",
                            "content": {
                                "application/json": {
                                    "schema": {"$ref": "#/components/schemas/ErrorResponse"}
                                }
                            },
                        },
                    },
                }
            },
            "/login": {
                "post": {
                    "summary": "Iniciar sesion",
                    "requestBody": {
                        "required": True,
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/AuthCredentials"}
                            }
                        },
                    },
                    "responses": {
                        "200": {
                            "description": "Token emitido",
                            "content": {
                                "application/json": {
                                    "schema": {"$ref": "#/components/schemas/LoginResponse"}
                                }
                            },
                        },
                        "401": {
                            "description": "Credenciales invalidas",
                            "content": {
                                "application/json": {
                                    "schema": {"$ref": "#/components/schemas/ErrorResponse"}
                                }
                            },
                        },
                    },
                }
            },
            "/user": {
                "get": {
                    "summary": "Perfil del usuario autenticado",
                    "security": [{"bearerAuth": []}],
                    "responses": {
                        "200": {
                            "description": "Usuario autenticado",
                            "content": {
                                "application/json": {
                                    "schema": {"$ref": "#/components/schemas/UserResponse"}
                                }
                            },
                        },
                        "404": {
                            "description": "Usuario no encontrado",
                            "content": {
                                "application/json": {
                                    "schema": {"$ref": "#/components/schemas/ErrorResponse"}
                                }
                            },
                        },
                    },
                }
            },
            "/auth/refresh": {
                "post": {
                    "summary": "Refrescar token de acceso",
                    "security": [{"bearerAuth": []}],
                    "responses": {
                        "200": {"description": "Nuevo token emitido", "content": {"application/json": {"schema": {"$ref": "#/components/schemas/LoginResponse"}}}}
                    }
                }
            },
            "/upload/audio": {
                "post": {
                    "summary": "Convertir audio a MusicXML",
                    "security": [{"bearerAuth": []}],
                    "requestBody": {
                        "required": True,
                        "content": {
                            "multipart/form-data": {
                                "schema": {
                                    "type": "object",
                                    "required": ["audio"],
                                    "properties": {
                                        "audio": {"type": "string", "format": "binary"}
                                    },
                                }
                            }
                        },
                    },
                    "responses": {
                        "202": {"description": "Conversion iniciada en segundo plano", "content": {"application/json": {"schema": {"$ref": "#/components/schemas/ConversionStatusResponse"}}}},
                        "400": {"description": "Archivo ausente o invalido"},
                    },
                }
            },
            "/upload/photo": {
                "post": {
                    "summary": "Convertir imagen OMR a MusicXML",
                    "security": [{"bearerAuth": []}],
                    "requestBody": {
                        "required": True,
                        "content": {
                            "multipart/form-data": {
                                "schema": {
                                    "type": "object",
                                    "required": ["photo", "name"],
                                    "properties": {
                                        "photo": {"type": "string", "format": "binary"},
                                        "name": {"type": "string"},
                                    },
                                }
                            }
                        },
                    },
                    "responses": {
                        "202": {"description": "Conversion iniciada en segundo plano", "content": {"application/json": {"schema": {"$ref": "#/components/schemas/ConversionStatusResponse"}}}},
                        "400": {"description": "Datos faltantes"},
                    },
                }
            },
            "/sheets": {
                "get": {
                    "summary": "Obtener partituras del usuario",
                    "security": [{"bearerAuth": []}],
                    "responses": {
                        "200": {
                            "description": "Listado de sheets",
                            "content": {
                                "application/json": {
                                    "schema": {"$ref": "#/components/schemas/SheetsResponse"}
                                }
                            },
                        }
                    },
                }
            },
            "/conversion_status/{task_id}": {
                "get": {
                    "summary": "Obtener estado de la conversión",
                    "security": [{"bearerAuth": []}],
                    "parameters": [
                        {
                            "name": "task_id",
                            "in": "path",
                            "required": True,
                            "schema": {"type": "string"}
                        }
                    ],
                    "responses": {
                        "200": {
                            "description": "Estado de la tarea de conversión",
                            "content": {"application/json": {"schema": {"$ref": "#/components/schemas/ConversionStatusResponse"}}}
                            },
                    }
                }
            },
            "/sheets/{sheet_key}": {
                "delete": {
                    "summary": "Eliminar una partitura",
                    "security": [{"bearerAuth": []}],
                    "parameters": [{"name": "sheet_key", "in": "path", "required": True, "schema": {"type": "string"}}],
                    "responses": {
                        "200": {"description": "Eliminado correctamente", "content": {"application/json": {"schema": {"$ref": "#/components/schemas/MessageResponse"}}}}
                    }
                }
            },
            "/sheets/reorder": {
                "patch": {
                    "summary": "Reordenar partituras",
                    "security": [{"bearerAuth": []}],
                    "requestBody": {"content": {"application/json": {"schema": {"type": "object", "properties": {"sheet_keys": {"type": "array", "items": {"type": "string"}}}}}}},
                    "responses": {
                        "200": {"description": "Orden actualizado", "content": {"application/json": {"schema": {"$ref": "#/components/schemas/SheetsResponse"}}}}
                    }
                }
            },
            "/uploads/sheets/{filename}": {
                "get": {
                    "summary": "Descargar archivo original (foto/audio)",
                    "security": [{"bearerAuth": []}],
                    "parameters": [
                        {
                            "name": "filename",
                            "in": "path",
                            "required": True,
                            "schema": {"type": "string"},
                        }
                    ],
                    "responses": {"200": {"description": "Archivo servido"}},
                }
            },
            "/uploads/conversions/{filename}": {
                "get": {
                    "summary": "Descargar conversion OMR",
                    "security": [{"bearerAuth": []}],
                    "parameters": [
                        {
                            "name": "filename",
                            "in": "path",
                            "required": True,
                            "schema": {"type": "string"},
                        }
                    ],
                    "responses": {
                        "200": {"description": "Archivo servido"},
                        "403": {"description": "No autorizado"},
                        "404": {"description": "Archivo no encontrado"},
                    },
                }
            },
        },
    }


SWAGGER_UI_HTML = """
<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>EasyTunr API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        background: #0f172a;
      }
      #swagger-ui {
        background: #fff;
      }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.onload = function() {
        window.ui = SwaggerUIBundle({
          url: "/openapi.json",
          dom_id: '#swagger-ui',
          deepLinking: true,
          presets: [SwaggerUIBundle.presets.apis],
          layout: "BaseLayout"
        });
      };
    </script>
  </body>
</html>
"""


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "easytunr-server"}), 200


@app.route("/openapi.json", methods=["GET"])
def openapi_json():
    return jsonify(build_openapi_spec())


@app.route("/docs", methods=["GET"])
def swagger_docs():
    return Response(SWAGGER_UI_HTML, mimetype="text/html")


# Guardar archivo con un nombre único
def save_image_file_with_unique_name(file):
    extension = os.path.splitext(file.filename)[1]
    if not extension:
        extension = ".jpg"
    unique_filename = f"{uuid.uuid4()}{extension}"
    file_path = os.path.join(UPLOAD_FOLDER, unique_filename)
    file.save(file_path)
    return file_path, unique_filename

def save_audio_file_with_unique_name(file):
    extension = os.path.splitext(file.filename)[1] or ".wav"
    unique_filename = f"{uuid.uuid4()}{extension}"
    file_path = os.path.join(UPLOAD_FOLDER, unique_filename)
    file.save(file_path)
    return file_path, unique_filename


# JWT error handlers for clearer debugging responses
@jwt.unauthorized_loader
def jwt_unauthorized_callback(callback_msg):
    app.logger.warning("JWT unauthorized: %s", callback_msg)
    return jsonify({"error": "authorization_required", "message": callback_msg}), 401


@jwt.invalid_token_loader
def jwt_invalid_token_callback(callback_msg):
    app.logger.warning("JWT invalid token: %s", callback_msg)
    return jsonify({"error": "invalid_token", "message": callback_msg}), 422


@jwt.expired_token_loader
def jwt_expired_token_callback(header, payload):
    app.logger.info("JWT expired token for user=%s", payload.get("sub"))
    return jsonify({"error": "token_expired", "message": "Token has expired"}), 401


@jwt.revoked_token_loader
def jwt_revoked_token_callback(callback_msg):
    app.logger.warning("JWT revoked token: %s", callback_msg)
    return jsonify({"error": "token_revoked", "message": callback_msg}), 401


@app.route("/user", methods=["GET"])
@jwt_required()
def get_user():
    current_user_id = get_jwt_identity()
    user = mongo.db.users.find_one({"_id": ObjectId(current_user_id)})
    if user:
        return jsonify({"email": user["email"]}), 200
    return jsonify({"message": "Usuario no encontrado"}), 404

# Global dictionary to store conversion task statuses
conversion_tasks = {}
conversion_tasks_lock = threading.Lock()


@app.route("/upload/audio", methods=["POST"])
@jwt_required()
def upload():
    current_user_id = get_jwt_identity()
    if "audio" not in request.files:
        return jsonify({"error": "No file part"}), 400

    audio_file = request.files["audio"]
    if audio_file.filename == "":
        return jsonify({"error": "No selected file"}), 400

    original_name = audio_file.filename
    file_path, unique_filename = save_audio_file_with_unique_name(audio_file)
    
    task_id = str(uuid.uuid4())
    with conversion_tasks_lock:
        conversion_tasks[task_id] = {"status": "pending", "message": "Archivo recibido, iniciando procesamiento..."}

    thread = threading.Thread(
        target=_process_audio_conversion_task,
        args=(current_user_id, file_path, original_name, unique_filename, task_id)
    )
    thread.start()

    return jsonify({
        "task_id": task_id,
        "status": "pending",
        "message": "Conversión de audio iniciada en segundo plano."
    }), 202

def _process_audio_conversion_task(current_user_id, audio_file_path, original_name, unique_filename, task_id):
    with app.app_context():
        with conversion_tasks_lock:
            conversion_tasks[task_id] = {"status": "processing", "message": "Iniciando conversión de audio..."}
        try:
            musicxml_filename = convert_audio_to_musicxml(audio_file_path)
            
            mongo.db.users.update_one(
                {"_id": ObjectId(current_user_id)},
                {"$push": {"sheets": {
                    "type": "audio", 
                    "name": original_name, 
                    "filename": unique_filename, 
                    "audio": unique_filename, 
                    "musicxml": musicxml_filename, 
                    "created_at": datetime.utcnow()
                }}}
            )
            
            with conversion_tasks_lock:
                conversion_tasks[task_id] = {
                    "status": "completed", 
                    "message": "Conversión de audio exitosa", 
                    "result": {"musicxml_url": f"/uploads/conversions/{musicxml_filename}"}
                }
        except Exception as e:
            app.logger.error("Task %s Error: %s", task_id, e, exc_info=True)
            with conversion_tasks_lock:
                conversion_tasks[task_id] = {"status": "failed", "message": str(e)}
            if os.path.exists(audio_file_path):
                os.remove(audio_file_path)


@app.route("/upload/photo", methods=["POST"])
@jwt_required()
def uploadPhoto():
    current_user_id = get_jwt_identity()
    
    if "photo" not in request.files:
        return jsonify({"message": "Falta el archivo de foto"}), 400
    
    photo = request.files["photo"]
    original_name = photo.filename
    photo_path, unique_filename = save_image_file_with_unique_name(photo)
    
    task_id = str(uuid.uuid4())
    with conversion_tasks_lock:
        conversion_tasks[task_id] = {"status": "pending", "message": "Imagen recibida, iniciando OMR..."}

    thread = threading.Thread(
        target=_process_omr_conversion_task,
        args=(current_user_id, photo_path, original_name, unique_filename, task_id)
    )
    thread.start()

    return jsonify({
        "task_id": task_id,
        "status": "pending",
        "message": "Conversión OMR iniciada en segundo plano."
    }), 202

def _process_omr_conversion_task(current_user_id, photo_path, original_name, unique_filename, task_id):
    with app.app_context():
        with conversion_tasks_lock:
            conversion_tasks[task_id] = {"status": "processing", "message": "Procesando imagen..."}
        try:
            omr_filename, musicxml_filename = convert_image_to_musicxml(photo_path)
            
            new_sheet = {
                "type": "omr", 
                "name": original_name, 
                "filename": unique_filename, 
                "omr": omr_filename, 
                "musicxml": musicxml_filename, 
                "created_at": datetime.utcnow()
            }
            
            mongo.db.users.update_one(
                {"_id": ObjectId(current_user_id)},
                {"$push": {"sheets": new_sheet}}
            )

            with conversion_tasks_lock:
                conversion_tasks[task_id] = {
                    "status": "completed", 
                    "message": "Conversión OMR exitosa", 
                    "result": {"musicxml_url": f"/uploads/conversions/{musicxml_filename}"}
                }
        except Exception as e:
            app.logger.error("Task %s Error: %s", task_id, e, exc_info=True)
            with conversion_tasks_lock:
                conversion_tasks[task_id] = {"status": "failed", "message": str(e)}
            if os.path.exists(photo_path):
                os.remove(photo_path)

@app.route("/conversion_status/<task_id>", methods=["GET"])
@jwt_required()
def get_conversion_status(task_id):
    with conversion_tasks_lock:
        task_info = conversion_tasks.get(task_id)
    if not task_info:
        return jsonify({"error": "Tarea no encontrada"}), 404
    return jsonify({"task_id": task_id, **task_info}), 200


@app.route("/auth/refresh", methods=["POST"])
@jwt_required()
def refresh_access_token():
    current_user_id = get_jwt_identity()
    user = mongo.db.users.find_one({"_id": ObjectId(current_user_id)})
    if not user:
        return jsonify({"error": "Usuario no encontrado"}), 404

    access_token = create_access_token(identity=str(user["_id"]))
    return (
        jsonify(
            {
                "token": access_token,
                "email": user["email"],
                "token_expires_in_seconds": expires_seconds,
            }
        ),
        200,
    )


CONVERSIONS_FOLDER = os.path.join(UPLOAD_FOLDER, "conversions")
OMR_MAX_IMAGE_SIDE = 2500

# Parametros de la transcripcion de audio (melodia monofonica)
AUDIO_SAMPLE_RATE = 22050
AUDIO_HOP_LENGTH = 512
AUDIO_TEMPO_BPM = 120
AUDIO_MIN_NOTE_SECONDS = 0.08


def convert_image_to_musicxml(image_path):
    """Imagen de partitura -> (omr_json_filename, musicxml_filename) en uploads/conversions."""
    os.makedirs(CONVERSIONS_FOLDER, exist_ok=True)
    base = os.path.splitext(os.path.basename(image_path))[0]
    omr_file = f"{base}.omr.json"
    musicxml_file = f"{base}.musicxml"
    musicxml_path = os.path.join(CONVERSIONS_FOLDER, musicxml_file)

    # Reducir imagenes muy grandes acelera mucho oemer sin perder precision util.
    with Image.open(image_path) as img:
        if max(img.size) > OMR_MAX_IMAGE_SIDE:
            img.thumbnail((OMR_MAX_IMAGE_SIDE, OMR_MAX_IMAGE_SIDE), Image.Resampling.LANCZOS)
            img.save(image_path)

    result = omr_pipeline.transcribe(image_path, musicxml_path)  # lanza OMRError si falla

    metadata = {
        "engine": result["engine"],
        "source_image": os.path.basename(image_path),
        "musicxml": musicxml_file,
        "created_at": datetime.utcnow().isoformat() + "Z",
    }
    with open(os.path.join(CONVERSIONS_FOLDER, omr_file), "w", encoding="utf-8") as f:
        json.dump(metadata, f, ensure_ascii=True, indent=2)

    return omr_file, musicxml_file


def _frames_to_segments(midi_frames, frame_seconds):
    """Agrupa frames consecutivos con la misma nota MIDI (None = silencio)."""
    segments = []  # [midi | None, segundos]
    for value in midi_frames:
        if segments and segments[-1][0] == value:
            segments[-1][1] += frame_seconds
        else:
            segments.append([value, frame_seconds])

    # Fusionar segmentos demasiado cortos (ruido / transiciones) con el anterior.
    merged = []
    for value, seconds in segments:
        if merged and (seconds < AUDIO_MIN_NOTE_SECONDS or merged[-1][0] == value):
            merged[-1][1] += seconds
        else:
            merged.append([value, seconds])
    return merged


def convert_audio_to_musicxml(audio_path):
    """Audio (melodia monofonica) -> musicxml_filename en uploads/conversions.

    Usa pYIN (librosa) para estimar la frecuencia fundamental frame a frame,
    la redondea a semitonos y cuantiza las duraciones a semicorcheas a AUDIO_TEMPO_BPM.
    """
    os.makedirs(CONVERSIONS_FOLDER, exist_ok=True)
    base = os.path.splitext(os.path.basename(audio_path))[0]
    musicxml_file = f"{base}.musicxml"

    y, sr = librosa.load(audio_path, sr=AUDIO_SAMPLE_RATE, mono=True)
    if y.size == 0:
        raise ValueError("El archivo de audio esta vacio")

    f0, voiced_flag, _ = librosa.pyin(
        y,
        fmin=librosa.note_to_hz("C2"),
        fmax=librosa.note_to_hz("C7"),
        sr=sr,
        hop_length=AUDIO_HOP_LENGTH,
    )
    midi_frames = [
        int(round(librosa.hz_to_midi(hz))) if voiced and not np.isnan(hz) else None
        for hz, voiced in zip(f0, voiced_flag)
    ]
    segments = _frames_to_segments(midi_frames, AUDIO_HOP_LENGTH / sr)

    quarter_seconds = 60.0 / AUDIO_TEMPO_BPM
    s = stream.Stream()
    for midi_value, seconds in segments:
        quarter_length = max(0.25, round(seconds / quarter_seconds * 4) / 4)
        if midi_value is None:
            if s.notes:  # sin silencios iniciales
                s.append(note.Rest(quarterLength=quarter_length))
        else:
            s.append(note.Note(midi=midi_value, quarterLength=quarter_length))

    if not s.notes:
        raise ValueError("No se detecto ninguna melodia en el audio")

    s.write("musicxml", fp=os.path.join(CONVERSIONS_FOLDER, musicxml_file))
    return musicxml_file


@app.route("/sheets", methods=["GET"])
@jwt_required()
def get_sheets():
    current_user_id = get_jwt_identity()
    user = mongo.db.users.find_one({"_id": ObjectId(current_user_id)})
    if user and "sheets" in user:
        sheets = [normalize_sheet(sheet) for sheet in user["sheets"]]
        return jsonify({"sheets": sheets}), 200
    return jsonify({"sheets": []}), 200


@app.route("/sheets/<sheet_key>", methods=["DELETE"])
@jwt_required()
def delete_sheet(sheet_key):
    try:
        current_user_id = get_jwt_identity()
        user = mongo.db.users.find_one({"_id": ObjectId(current_user_id)})
        if not user:
            return jsonify({"error": "Usuario no encontrado"}), 404

        sheets = user.get("sheets", [])
        index = next((i for i, s in enumerate(sheets) if get_sheet_key(s) == sheet_key), -1)
        if index < 0:
            app.logger.warning("DELETE sheet not found: user=%s key=%s", current_user_id, sheet_key)
            return jsonify({"error": "Partitura no encontrada"}), 404

        target = sheets[index]
        remaining = [s for i, s in enumerate(sheets) if i != index]

        app.logger.info("Deleting sheet: user=%s key=%s name=%s", current_user_id, sheet_key, target.get("name"))

        mongo.db.users.update_one(
            {"_id": ObjectId(current_user_id)},
            {"$set": {"sheets": remaining}},
        )

        root_uploads = app.config["UPLOAD_FOLDER"]
        conversions_uploads = os.path.join(root_uploads, "conversions")
        file_candidates = [
            os.path.join(root_uploads, target.get("filename", "")),
            os.path.join(root_uploads, target.get("audio", "")),
            os.path.join(conversions_uploads, target.get("omr", "")),
            os.path.join(conversions_uploads, target.get("musicxml", "")),
        ]

        for path in file_candidates:
            if path and os.path.isfile(path):
                try:
                    os.remove(path)
                    app.logger.info("Deleted file: %s", path)
                except OSError as e:
                    app.logger.warning("Failed to delete file %s: %s", path, str(e))

        return jsonify({"success": True, "message": "Partitura eliminada", "deleted": normalize_sheet(target)}), 200
    except Exception as e:
        app.logger.error("Error en DELETE /sheets/%s: %s", sheet_key, str(e), exc_info=True)
        return jsonify({"error": f"Error al eliminar: {str(e)}"}), 500


@app.route("/sheets/reorder", methods=["PATCH"])
@jwt_required()
def reorder_sheets():
    current_user_id = get_jwt_identity()
    user = mongo.db.users.find_one({"_id": ObjectId(current_user_id)})
    if not user:
        return jsonify({"error": "Usuario no encontrado"}), 404

    payload = request.get_json(silent=True) or {}
    ordered_keys = payload.get("sheet_keys")
    if not isinstance(ordered_keys, list):
        return jsonify({"error": "sheet_keys debe ser una lista"}), 400

    app.logger.info("Reordering sheets: user=%s keys=%s", current_user_id, ordered_keys)

    sheets = user.get("sheets", [])
    by_key = {get_sheet_key(sheet): sheet for sheet in sheets}

    reordered = []
    seen = set()
    for key in ordered_keys:
        key_str = str(key)
        if key_str in by_key and key_str not in seen:
            reordered.append(by_key[key_str])
            seen.add(key_str)

    for sheet in sheets:
        key = get_sheet_key(sheet)
        if key not in seen:
            reordered.append(sheet)

    mongo.db.users.update_one(
        {"_id": ObjectId(current_user_id)},
        {"$set": {"sheets": reordered}},
    )

    return jsonify({"success": True, "sheets": [normalize_sheet(s) for s in reordered]}), 200


@app.route("/uploads/sheets/<filename>")
@jwt_required()
def download_img_sheet(filename):
    current_user_id = get_jwt_identity()
    user = mongo.db.users.find_one({"_id": ObjectId(current_user_id)})
    if not user:
        return jsonify({"error": "No autorizado"}), 403

    sheet = next((s for s in user.get("sheets", []) if s.get("filename") == filename or s.get("audio") == filename), None)
    if not sheet:
        return jsonify({"error": "Archivo no encontrado"}), 404

    ext = os.path.splitext(filename)[1]
    friendly_name = os.path.splitext(sheet.get("name", "archivo"))[0] + ext

    response = send_from_directory(app.config["UPLOAD_FOLDER"], filename, as_attachment=True, download_name=friendly_name)
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    return response


@app.route("/uploads/conversions/<filename>")
@jwt_required()
def download_conversion(filename):
    current_user_id = get_jwt_identity()
    user = mongo.db.users.find_one({"_id": ObjectId(current_user_id)})
    if not user or "sheets" not in user:
        return jsonify({"error": "No autorizado"}), 403

    sheet = None
    for s in user.get("sheets", []):
        if (get_sheet_key(s) == filename or s.get("musicxml") == filename or s.get("omr") == filename):
            sheet = s
            break

    if not sheet:
        return jsonify({"error": "Partitura no encontrada"}), 404

    is_json = filename.lower().endswith(".json")
    real_filename = sheet.get("omr") if is_json else (sheet.get("musicxml") or sheet.get("omr"))

    if not real_filename:
        return jsonify({"error": "Archivo no disponible"}), 404

    conversions_dir = os.path.abspath(os.path.join(app.config["UPLOAD_FOLDER"], "conversions"))
    file_path = os.path.join(conversions_dir, real_filename)

    if not os.path.isfile(file_path):
        return jsonify({"error": "Archivo físico no encontrado"}), 404

    # Determinar extensión y MimeType real
    actual_ext = os.path.splitext(real_filename)[1].lower()
    friendly_name = os.path.splitext(sheet.get("name", "partitura"))[0] + actual_ext

    mimetype = 'application/octet-stream'
    if is_json:
        mimetype = 'application/json'
    elif actual_ext == '.mxl':
        mimetype = 'application/vnd.recordare.musicxml'
    elif actual_ext in ['.musicxml', '.xml']:
        mimetype = 'application/vnd.recordare.musicxml+xml'

    response = send_file(file_path, as_attachment=True, download_name=friendly_name, mimetype=mimetype)
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response


@app.route("/register", methods=["POST"])
def register():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")

    try:
        if mongo.db.users.find_one({"email": email}):
            return jsonify({"message": "El usuario ya existe"}), 400

        hashed_password = bcrypt.generate_password_hash(password).decode("utf-8")
        mongo.db.users.insert_one({"email": email, "password": hashed_password})
        return jsonify({"message": "Usuario registrado exitosamente"}), 201
    except ServerSelectionTimeoutError:
        return mongo_unavailable_response()


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")

    try:
        # Verificar si el usuario existe
        user = mongo.db.users.find_one({"email": email})
        if not user:
            return jsonify({"message": "El usuario no existe"}), 404

        # Verificar si la contraseña es correcta
        if bcrypt.check_password_hash(user["password"], password):
            access_token = create_access_token(identity=str(user["_id"]))
            return (
                jsonify(
                    {
                        "token": access_token,
                        "email": email,
                        "token_expires_in_seconds": expires_seconds,
                    }
                ),
                200,
            )

        return jsonify({"message": "Contraseña incorrecta"}), 401
    except ServerSelectionTimeoutError:
        return mongo_unavailable_response()


if __name__ == "__main__":
    debug = str(config.get("FLASK_DEBUG", "0")).lower() in ("1", "true", "yes")
    app.run(host="0.0.0.0", port=int(config.get("PORT", "5000")), debug=debug)
