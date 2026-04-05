import os
import json
import subprocess
from bson import ObjectId
from dotenv import dotenv_values
from flask import Flask, request, jsonify, send_from_directory, Response
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
from music21 import stream, note, midi

from omr.pipeline import OMRPipeline, OMRPipelineConfig
from omr.musicxml import write_musicxml

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)
bcrypt = Bcrypt(app)
jwt = JWTManager(app)

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

config = {**dotenv_values(".env"), **os.environ}

app.config["MONGO_URI"] = config.get("MONGO_URI")
app.config["JWT_SECRET_KEY"] = config.get("JWT_SECRET_KEY")

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

omr_config = OMRPipelineConfig(
    engine=os.getenv("OMR_ENGINE", "custom-omr"),
    model_weights=os.getenv("OMR_MODEL_WEIGHTS"),
    confidence=float(os.getenv("OMR_CONFIDENCE", "0.25")),
    device=os.getenv("OMR_DEVICE", "cpu"),
    seq2seq_model_id=os.getenv("OMR_SEQ2SEQ_MODEL_ID"),
    seq2seq_max_new_tokens=int(os.getenv("OMR_SEQ2SEQ_MAX_NEW_TOKENS", "256")),
    seq2seq_num_beams=int(os.getenv("OMR_SEQ2SEQ_NUM_BEAMS", "2")),
    staff_projection_factor=float(os.getenv("OMR_STAFF_PROJECTION_FACTOR", "0.55")),
)
omr_pipeline = OMRPipeline(omr_config)


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
                        "200": {"description": "Conversion exitosa"},
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
                        "200": {"description": "Conversion exitosa"},
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
            "/uploads/sheets/{filename}": {
                "get": {
                    "summary": "Descargar archivo subido",
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


@app.route("/users", methods=["GET"])
def getUses():
    users = mongo.db.users.find()
    return jsonify({"users": users})


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

    unique_filename = f"{uuid.uuid4()}"
    file_path = os.path.join(UPLOAD_FOLDER, unique_filename)
    file.save(file_path)
    return file_path, unique_filename


# @app.after_request
# def add_cors_headers(response):
#     response.headers["Access-Control-Allow-Origin"] = "*"
#     response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
#     response.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type"
#     return response


@app.before_request
def handle_options_request():
    if request.method == "OPTIONS":
        response = app.make_default_options_response()
        headers = response.headers

        # Configurar encabezados CORS
        headers["Access-Control-Allow-Origin"] = "*"
        headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type"

        return response


@app.route("/user", methods=["GET"])
@jwt_required()
def get_user():
    current_user_id = get_jwt_identity()
    user = mongo.db.users.find_one({"_id": ObjectId(current_user_id)})
    if user:
        return jsonify({"email": user["email"]}), 200
    return jsonify({"message": "Usuario no encontrado"}), 404


@app.route("/upload/audio", methods=["POST"])
@jwt_required()
def upload():
    current_user = get_jwt_identity()
    if "audio" not in request.files:
        return jsonify({"error": "No file part"}), 400

    audio_file = request.files["audio"]
    if audio_file.filename == "":
        return jsonify({"error": "No selected file"}), 400

    file_path, unique_filename = save_audio_file_with_unique_name(audio_file)

    try:
        musicxml_file = convert_audio_to_musicxml(file_path)
        mongo.db.users.update_one(
            {"_id": ObjectId(current_user)},
            {
                "$push": {
                    "sheets": {
                        "type": "audio",
                        "name": unique_filename,
                        "filename": unique_filename,
                        "audio": unique_filename,
                        "musicxml": musicxml_file,
                    }
                }
            },
        )
        return jsonify({"success": True, "musicXmlUrl": musicxml_file}), 200
    except Exception as e:
        return jsonify({"error": f"Error al convertir el audio: {str(e)}"}), 500


@app.route("/upload/photo", methods=["POST"])
@jwt_required()
def uploadPhoto():
    current_user = get_jwt_identity()
    if "photo" not in request.files:
        return jsonify({"error": "No file part"}), 400
    if "name" not in request.form:
        return jsonify({"error": "No name part"}), 400

    name = request.form["name"]
    photo_file = request.files["photo"]
    if photo_file.filename == "":
        return jsonify({"error": "No selected file"}), 400

    file_path, unique_filename = save_image_file_with_unique_name(photo_file)

    try:
        omr_file, mxl_file = convert_image_to_musicxml(file_path)
        mongo.db.users.update_one(
            {"_id": ObjectId(current_user)},
            {
                "$push": {
                    "sheets": {
                        "type": "photo",
                        "name": name,
                        "filename": unique_filename,
                        "omr": omr_file,
                        "musicxml": mxl_file,
                    }
                }
            },
        )
        return jsonify({"success": True, "omr": omr_file, "musicXmlUrl": mxl_file})
    except Exception as e:
        print("Error en conversión:", e)
        return jsonify({"error": f"Failed to convert image to MusicXML: {str(e)}"}), 500


def convert_image_to_musicxml(image_path):
    # Pipeline OMR propio: deteccion de simbolos -> notas -> MusicXML.
    output_folder = os.path.join(UPLOAD_FOLDER, "conversions")
    os.makedirs(output_folder, exist_ok=True)

    base = os.path.splitext(os.path.basename(image_path))[0]
    omr_file = f"{base}.omr.json"
    mxl_file = f"{base}.musicxml"

    omr_path = os.path.join(output_folder, omr_file)
    mxl_path = os.path.join(output_folder, mxl_file)

    result = omr_pipeline.transcribe(image_path)

    with open(omr_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=True, indent=2)

    write_musicxml(result["notes"], mxl_path, title=base)
    return omr_file, mxl_file

def convert_audio_to_musicxml(audio_path):
    #audio_path = ensure_wav(audio_path)
    output_csv = audio_path.replace(".wav", "_melodia.csv")
    xml_path = audio_path.replace(".wav", ".musicxml")

    audio_path = '/mnt/c/Users/mateo/Documents/GitHub/EasyTunr-ReactNative/server/' + audio_path.replace('\\', '/')
    print("Audio path:", audio_path)
    # sonic_annotator_path = "C:\\Program Files\\sonic-annotator-win64\\sonic-annotator.exe"
    # melodia_plugin = "vamp:mtg-melodia:melodia"
    # with open(output_csv, "w") as out_csv:
    #     subprocess.run([
    #         sonic_annotator_path,
    #         "-d", melodia_plugin,
    #         audio_path,
    #         "-w", "csv",
    #         "--csv-stdout"
    #     ], check=True, stdout=out_csv)
    sonic_annotator_path = "/mnt/c/sonic-annotator/sonic-annotator"
    melodia_plugin = "vamp:mtg-melodia:melodia"
    with open(output_csv, "w") as out_csv:
        subprocess.run([
            "wsl",
            "-e",
            sonic_annotator_path,
            "-d", melodia_plugin,
            audio_path,
            "-w", "csv",
            "--csv-stdout"
        ], check=True, stdout=out_csv)
    
    # 1. Ejecuta Sonic Annotator con Melodia para extraer la melodía
    #output_csv = audio_path.replace(".wav", "_melodia.csv")
    # sonic_annotator_path = "C:\\Program Files\\sonic-annotator-win64\\sonic-annotator.exe"
    # melodia_plugin = "vamp:mtg-melodia:melodia"
    # subprocess.run([
    #     sonic_annotator_path,
    #     "-d", melodia_plugin,
    #     audio_path,
    #     "-w", "csv",
    #     "--csv-stdout"
    # ], check=True, stdout=open(output_csv, "w"))
    # sonic_annotator_path = "/mnt/c/sonic-annotator/sonic-annotator"
    # melodia_plugin = "vamp:mtg-melodia:melodia"
    # subprocess.run([
    #     "wsl",
    #     "-e",
    #     sonic_annotator_path,
    #     "-d", melodia_plugin,
    #     audio_path,
    #     "-w", "csv",
    #     "--csv-stdout"
    # ], check=True, stdout=open(output_csv, "w"))
    
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
    #i = 0
    for freq in freqs:
        pitch = note.Note()
        pitch.pitch.frequency = freq
        pitch.quarterLength = 0.25
        s.append(pitch)
        #if i > 1000:
        #    break
        #i += 1

    print("Saving MusicXML to:", xml_path)
    s.write('musicxml', fp=xml_path)
    print("MusicXML saved.")
    return xml_path

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
            except OSError:
                pass

    return jsonify({"success": True, "deleted": normalize_sheet(target)}), 200


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
def download_img_sheet(filename):
    response = send_from_directory(app.config["UPLOAD_FOLDER"], filename)
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response


@app.route("/uploads/conversions/<filename>")
@jwt_required()
def download_conversion(filename):
    current_user_id = get_jwt_identity()
    user = mongo.db.users.find_one({"_id": ObjectId(current_user_id)})
    if not user or "sheets" not in user:
        return jsonify({"error": "No autorizado"}), 403

    # Busca la sheet correspondiente
    sheet = next(
        (
            s
            for s in user["sheets"]
            if s.get("omr") == filename or s.get("musicxml") == filename
        ),
        None,
    )
    if not sheet:
        return jsonify({"error": "Archivo no encontrado"}), 404

    # Decide el nombre de descarga según la extensión
    ext = os.path.splitext(filename)[1]
    download_name = os.path.splitext(sheet["name"])[0] + ext

    upload_folder = os.path.join(app.config["UPLOAD_FOLDER"], "conversions")
    response = send_from_directory(
        upload_folder, filename, as_attachment=True, download_name=download_name
    )
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response


@app.route("/register", methods=["POST"])
def register():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")

    if mongo.db.users.find_one({"email": email}):
        return jsonify({"message": "El usuario ya existe"}), 400

    hashed_password = bcrypt.generate_password_hash(password).decode("utf-8")
    mongo.db.users.insert_one({"email": email, "password": hashed_password})
    return jsonify({"message": "Usuario registrado exitosamente"}), 201


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")

    # Verificar si el usuario existe
    user = mongo.db.users.find_one({"email": email})
    if not user:
        return jsonify({"message": "El usuario no existe"}), 404

    # Verificar si la contraseña es correcta
    if bcrypt.check_password_hash(user["password"], password):
        access_token = create_access_token(identity=str(user["_id"]))
        return jsonify({"token": access_token, "email": email}), 200

    return jsonify({"message": "Contraseña incorrecta"}), 401


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")), debug=True)
