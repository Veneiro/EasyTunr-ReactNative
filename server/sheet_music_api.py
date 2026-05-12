import os
from datetime import datetime, timedelta
import json
import subprocess
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
from PIL import Image
from pymongo.errors import ServerSelectionTimeoutError
from music21 import stream, note, midi, converter

from omr.pipeline import OMRPipeline, OMRPipelineConfig
from omr.musicxml import write_musicxml, write_score_to_musicxml

import threading # New import for background tasks
import uuid # New import for unique task IDs
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

config = {**dotenv_values(".env"), **os.environ}

app.config["MONGO_URI"] = config.get("MONGO_URI")
app.config["JWT_SECRET_KEY"] = config.get("JWT_SECRET_KEY")

# Configure access token lifetime (seconds) via env JWT_ACCESS_TOKEN_EXPIRES_SECONDS
try:
    expires_seconds = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRES_SECONDS", "600"))
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
                "ConversionStatusResponse": { # New schema for conversion status
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
            "/uploads/sheets/{filename}": { # Re-added and updated path for original uploaded files
                "get": {
                    "summary": "Descargar archivo original subido (foto o audio)",
                    "security": [{"bearerAuth": []}], # Added JWT requirement
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
            "/users": {
                "get": {
                    "summary": "Listado de usuarios",
                    "responses": {
                        "200": {"description": "Listado devuelto"}
                    },
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
            "/conversion_status/{task_id}": { # New path for checking conversion status
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
                    },
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


@app.route("/users", methods=["GET"])
def getUses():
    users = list(mongo.db.users.find())
    return jsonify({"users": [normalize_sheet(u) for u in users]})


# Guardar archivo con un nombre único
def save_image_file_with_unique_name(file):
    import uuid

    extension = os.path.splitext(file.filename)[1]
    if not extension:
        extension = ".jpg"
    unique_filename = f"{uuid.uuid4()}{extension}"
    file_path = os.path.join(UPLOAD_FOLDER, unique_filename)
    file.save(file_path)
    return file_path, unique_filename

def save_audio_file_with_unique_name(file):
    import uuid

    extension = os.path.splitext(file.filename)[1] or ".wav"
    unique_filename = f"{uuid.uuid4()}{extension}"
    file_path = os.path.join(UPLOAD_FOLDER, unique_filename)
    file.save(file_path)
    return file_path, unique_filename


@app.before_request
def log_authorization_header():
    # Debug helper: log presence of Authorization header for troubleshooting 401s
    try:
        auth = request.headers.get("Authorization")
        if auth:
            app.logger.info("Authorization header present (trimmed): %s", auth[:100])
        else:
            app.logger.info("No Authorization header present in request")
    except Exception:
        pass


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
    app.logger.warning("JWT expired token: headers=%s payload=%s", header, payload)
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
# Also used for global configuration like sonic_annotator_path
conversion_tasks = {}
conversion_tasks_lock = threading.Lock()

@app.route("/upload/audio", methods=["POST"])
@jwt_required()
def upload():
    current_user = get_jwt_identity()
    app.logger.info("/upload/audio called: headers=%s files=%s form=%s", dict(request.headers), list(request.files.keys()), dict(request.form))
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

    # Start conversion in a new thread
    thread = threading.Thread(
        target=_process_audio_conversion_task,
        args=(current_user, file_path, original_name, unique_filename, task_id) # Corrected current_user_id to current_user
    )
    thread.start()

    return jsonify({
        "task_id": task_id,
        "status": "pending",
        "message": "Conversión de audio iniciada en segundo plano."
    }), 202

def _process_audio_conversion_task(current_user_id, audio_file_path, original_name, unique_filename, task_id):
    with app.app_context(): # Needed to access Flask app context (e.g., mongo.db)
        with conversion_tasks_lock:
            conversion_tasks[task_id] = {"status": "processing", "message": "Iniciando conversión de audio..."}
        app.logger.info(f"Task {task_id}: Starting audio conversion for user {current_user_id}")
        try:
            musicxml_filename = convert_audio_to_musicxml(audio_file_path)
            
            mongo.db.users.update_one(
                {"_id": ObjectId(current_user_id)},
                {"$push": {"sheets": {"type": "audio", "name": original_name, "filename": unique_filename, "audio": unique_filename, "musicxml": musicxml_filename, "created_at": datetime.utcnow()}}}
            )
            
            with conversion_tasks_lock:
                conversion_tasks[task_id] = {"status": "completed", "message": "Conversión de audio exitosa", "result": {"musicxml_url": f"/uploads/conversions/{musicxml_filename}"}}
            app.logger.info(f"Task {task_id}: Audio conversion completed for user {current_user_id}")
        except Exception as e:
            app.logger.error(f"Task {task_id}: Error during audio conversion for user {current_user_id}: {str(e)}", exc_info=True)
            with conversion_tasks_lock:
                conversion_tasks[task_id] = {"status": "failed", "message": f"Error al convertir el audio: {str(e)}"}
        finally:
            if os.path.exists(audio_file_path):
                os.remove(audio_file_path) # Clean up original audio file

@app.route("/upload/photo", methods=["POST"])
@jwt_required()
def uploadPhoto():
    current_user_id = get_jwt_identity()
    
    if "photo" not in request.files:
        return jsonify({"message": "Falta el archivo de foto"}), 400
    
    photo = request.files["photo"]
    if photo.filename == "":
        return jsonify({"error": "No selected file"}), 400

    original_name = photo.filename
    # Guardar la imagen original con un nombre único
    photo_path, unique_filename = save_image_file_with_unique_name(photo)
    
    task_id = str(uuid.uuid4())
    with conversion_tasks_lock:
        conversion_tasks[task_id] = {"status": "pending", "message": "Archivo recibido, iniciando procesamiento..."}

    # Start conversion in a new thread
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
    with app.app_context(): # Needed to access Flask app context (e.g., mongo.db)
        with conversion_tasks_lock:
            conversion_tasks[task_id] = {"status": "processing", "message": "Iniciando conversión OMR..."}
        app.logger.info(f"Task {task_id}: Starting OMR conversion for user {current_user_id}")
        try:
            omr_filename, musicxml_filename = convert_image_to_musicxml(photo_path)
            
            new_sheet = {"type": "omr", "name": original_name, "filename": unique_filename, "omr": omr_filename, "musicxml": musicxml_filename, "created_at": datetime.utcnow()}
            
            mongo.db.users.update_one(
                {"_id": ObjectId(current_user_id)},
                {"$push": {"sheets": new_sheet}}
            )

            with conversion_tasks_lock:
                conversion_tasks[task_id] = {"status": "completed", "message": "Conversión OMR exitosa", "result": {"musicxml_url": f"/uploads/conversions/{musicxml_filename}"}}
            app.logger.info(f"Task {task_id}: OMR conversion completed for user {current_user_id}")
        except Exception as e:
            app.logger.error(f"Task {task_id}: Error during OMR conversion for user {current_user_id}: {str(e)}", exc_info=True)
            with conversion_tasks_lock:
                conversion_tasks[task_id] = {"status": "failed", "message": f"Error en conversión OMR: {str(e)}"}
        finally:
            if os.path.exists(photo_path):
                os.remove(photo_path) # Clean up original photo file

@app.route("/conversion_status/<task_id>", methods=["GET"])
@jwt_required()
def get_conversion_status(task_id):
    with conversion_tasks_lock:
        task_info = conversion_tasks.get(task_id)
    if not task_info:
        return jsonify({"error": "Tarea de conversión no encontrada"}), 404
    return jsonify({"task_id": task_id, "status": task_info["status"], "message": task_info.get("message"), "result": task_info.get("result")}), 200

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
                # This variable is not defined in this scope.
                # It should be app.config["JWT_ACCESS_TOKEN_EXPIRES"].total_seconds()
                "token": access_token,
                "email": user["email"],
                "token_expires_in_seconds": expires_seconds,
            }
        ),
        200,
    )


def is_binary_mxl(filepath):
    """Detecta si un archivo es un MusicXML comprimido (formato ZIP) buscando el header 'PK'."""
    try:
        with open(filepath, 'rb') as f:
            return f.read(2) == b'PK'
    except Exception:
        return False

def convert_image_to_musicxml(image_path):
    """Convierte una imagen de partitura a MusicXML usando el motor OMR configurado.

    Para oemer, ejecuta la CLI oficial y usa directamente el MusicXML generado.
    """
    output_folder = os.path.join(UPLOAD_FOLDER, "conversions")
    os.makedirs(output_folder, exist_ok=True)

    base = os.path.splitext(os.path.basename(image_path))[0]
    omr_file = f"{base}.omr.json"

    omr_path = os.path.join(output_folder, omr_file)

    # Optimización: Redimensionar si la imagen es demasiado grande.
    # Oemer procesa mucho más rápido imágenes con una resolución balanceada.
    # 2000-2500px es el punto óptimo para precisión vs tiempo de procesamiento.
    with Image.open(image_path) as img:
        if max(img.size) > 2500:
            img.thumbnail((2500, 2500), Image.Resampling.LANCZOS)
            img.save(image_path)

    result = omr_pipeline.transcribe(image_path)
    try:
        app.logger.info("OMR result keys: %s", list(result.keys()))
        app.logger.info(
            "OMR result types: musicxml_path=%s teaser_path=%s",
            result.get("musicxml_path"),
            result.get("teaser_path"),
        )
        app.logger.info("OMR result status: %s", result.get("status"))
        if result.get("stderr"):
            app.logger.warning("OMR stderr: %s", result.get("stderr"))
    except Exception:
        pass

    # Guardar metadatos de la conversión para la lista de partituras.
    with open(omr_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=True, indent=2)

    musicxml_source = result.get("musicxml_path")
    app.logger.info(
        "Checking musicxml: source=%s exists=%s",
        musicxml_source,
        os.path.isfile(musicxml_source) if musicxml_source else False
    )
    
    if not musicxml_source:
        app.logger.error("OMR pipeline did not return musicxml_path. Result: %s", result)
        raise RuntimeError(f"OMR pipeline no devolvió musicxml_path para {image_path}")
    
    if not os.path.isfile(musicxml_source):
        app.logger.error(
            "MusicXML file not found. Expected: %s. Available files in %s: %s",
            musicxml_source,
            os.path.dirname(musicxml_source),
            os.listdir(os.path.dirname(musicxml_source)) if os.path.isdir(os.path.dirname(musicxml_source)) else "dir doesn't exist"
        )
        raise RuntimeError(f"OMR no generó MusicXML en {musicxml_source}")

    # Detección inteligente del contenido real
    actual_ext = ".mxl" if is_binary_mxl(musicxml_source) else ".musicxml"
    mxl_file = f"{base}{actual_ext}"
    mxl_path = os.path.join(output_folder, mxl_file)

    if os.path.abspath(musicxml_source) != os.path.abspath(mxl_path):
        import shutil
        app.logger.info("Copying MusicXML from %s to %s", musicxml_source, mxl_path)
        shutil.copyfile(musicxml_source, mxl_path)
    
    return omr_file, mxl_file

def convert_audio_to_musicxml(audio_path):
    #audio_path = ensure_wav(audio_path)
    output_folder = os.path.join(UPLOAD_FOLDER, "conversions")
    os.makedirs(output_folder, exist_ok=True)
    base_filename = os.path.splitext(os.path.basename(audio_path))[0]
    output_csv = os.path.join(output_folder, f"{base_filename}_melodia.csv")
    xml_path = os.path.join(output_folder, f"{base_filename}.musicxml")
    sonic_annotator_path = "sonic-annotator" # Defined sonic_annotator_path

    # En Docker/Linux, asumimos que sonic-annotator está en el PATH
    melodia_plugin = "vamp:mtg-melodia:melodia"
    
    try:
        with open(output_csv, "w") as out_csv:
            subprocess.run([
                sonic_annotator_path,
                "-d", melodia_plugin,
                audio_path,
                "-w", "csv",
                "--csv-stdout"
            ], check=True, stdout=out_csv)
    except Exception as e:
        print(f"Error ejecutando sonic-annotator: {e}")
        raise
    
    # 2. Procesa el CSV para extraer las notas
    times = []
    freqs = []
    with open(output_csv, "r") as f:
        for line in f:
            parts = line.strip().split(",")
            if len(parts) >= 2:
                try:
                    time = float(parts[1])
                    freq = float(parts[2])
                    if freq > 0:
                        times.append(time)
                        freqs.append(freq)
                except ValueError:
                    continue

    # 3. Crea el MusicXML con music21
    s = stream.Stream()
    if freqs:
        # Optimización: Agrupar frecuencias consecutivas para evitar "ruido" de notas infinitas
        last_freq = freqs[0]
        duration_count = 0
        for freq in freqs:
            if abs(freq - last_freq) < 1.0: # Frecuencia similar, misma nota
                duration_count += 1
            else:
                n = note.Note()
                n.pitch.frequency = last_freq
                n.quarterLength = max(0.25, 0.05 * duration_count)
                s.append(n)
                last_freq = freq
                duration_count = 1
        # Añadir la última nota
        n = note.Note()
        n.pitch.frequency = last_freq
        n.quarterLength = max(0.25, 0.05 * duration_count)
        s.append(n)

    print("Saving MusicXML to:", xml_path)
    s.write('musicxml', fp=xml_path)
    print("MusicXML saved.")
    return os.path.basename(xml_path) # Return only the filename

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
    if not user or "sheets" not in user:
        return jsonify({"error": "No autorizado"}), 403

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

@app.route("/uploads/sheets/<filename>", methods=["GET"])
@jwt_required()
def download_img_sheet(filename):
    current_user_id = get_jwt_identity()
    user = mongo.db.users.find_one({"_id": ObjectId(current_user_id)})
    if not user or "sheets" not in user:
        return jsonify({"error": "Usuario no encontrado"}), 404

    sheet = next((s for s in user["sheets"] if s.get("filename") == filename or s.get("audio") == filename), None)
    if not sheet:
        return jsonify({"error": "Archivo no encontrado o no autorizado"}), 404

    ext = os.path.splitext(filename)[1]
    friendly_name = os.path.splitext(sheet.get("name", filename))[0] + ext

    return send_from_directory(app.config["UPLOAD_FOLDER"], filename, as_attachment=True, download_name=friendly_name)


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
        app.logger.error(f"Download error: sheet not found for key {filename}")
        return jsonify({"error": "Partitura no encontrada"}), 404

    # Determinar qué archivo físico servir (JSON o MusicXML)
    is_json = filename.lower().endswith(".json")
    if is_json:
        real_filename = sheet.get("omr")
    else:
        # Priorizar musicxml, si no existe (conversión fallida o parcial) usar omr
        real_filename = sheet.get("musicxml") or sheet.get("omr")

    if not real_filename:
        return jsonify({"error": "Archivo de conversión no disponible"}), 404

    # Ruta absoluta para máxima fiabilidad al servir el archivo
    conversions_dir = os.path.abspath(os.path.join(app.config["UPLOAD_FOLDER"], "conversions"))
    file_path = os.path.join(conversions_dir, real_filename)

    if not os.path.isfile(file_path):
        app.logger.error(f"File not found on disk: {file_path}")
        return jsonify({"error": f"Archivo físico no encontrado: {real_filename}"}), 404

    # Determinar extensión y nombre amigable
    actual_ext = os.path.splitext(real_filename)[1].lower()
    if is_json:
        friendly_name = os.path.splitext(sheet.get("name", "partitura"))[0] + ".json"
        mimetype = 'application/json'
    else:
        friendly_name = os.path.splitext(sheet.get("name", "partitura"))[0] + actual_ext
        # Usar el MIME-type correcto según si es binario (.mxl) o texto (.musicxml)
        if actual_ext == ".mxl":
            mimetype = 'application/vnd.recordare.musicxml'
        else:
            mimetype = 'application/vnd.recordare.musicxml+xml'

    app.logger.info(f"Serving conversion: disk={real_filename} as={friendly_name} size={os.path.getsize(file_path)} bytes")

    response = send_file(
        file_path,
        as_attachment=True,
        download_name=friendly_name,
        mimetype=mimetype,
        conditional=False # Evita que solicitudes parciales del navegador den problemas
    )

    # Forzar headers de no-cache para asegurar que el navegador siempre pida el archivo real
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
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")), debug=True)
