import os
import subprocess
from bson import ObjectId
from dotenv import dotenv_values
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_pymongo import PyMongo
from werkzeug.utils import secure_filename
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager, create_access_token, get_jwt_identity, jwt_required

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)
bcrypt = Bcrypt(app)
jwt = JWTManager(app)

UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

config = dotenv_values(".env")

app.config["MONGO_URI"] = config["MONGO_URI"]
app.config["JWT_SECRET_KEY"] = config["JWT_SECRET_KEY"]

mongo = PyMongo(app)
audiveris_route = 'C:/Program Files/Audiveris/Audiveris.exe'

@app.route('/users', methods=['GET'])
def getUses():
    users = mongo.db.users.find()
    return jsonify({"users": users})

# Guardar archivo con un nombre único
def save_file_with_unique_name(file):
    base_filename = os.path.splitext(file.filename)[0]
    extension = os.path.splitext(file.filename)[1]
    counter = 1
    unique_filename = file.filename

    while os.path.exists(os.path.join(UPLOAD_FOLDER, unique_filename)):
        unique_filename = f"{base_filename}_{counter}{extension}"
        counter += 1

    file_path = os.path.join(UPLOAD_FOLDER, unique_filename)
    file.save(file_path)
    return file_path, unique_filename

@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type"
    return response

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

@app.route('/user', methods=['GET'])
@jwt_required()
def get_user():
    current_user_id = get_jwt_identity()
    user = mongo.db.users.find_one({"_id": ObjectId(current_user_id)})
    if user:
        return jsonify({"email": user["email"]}), 200
    return jsonify({"message": "Usuario no encontrado"}), 404

@app.route('/upload/audio', methods=['POST'])
@jwt_required()
def upload():
    current_user = get_jwt_identity()

    if 'audio' not in request.files:
        return jsonify({"error": "No file part"}), 400

    audio_file = request.files['audio']
    if audio_file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    # Guardar el archivo de audio
    filename = secure_filename(audio_file.filename)
    audio_path = os.path.join(UPLOAD_FOLDER, filename)
    audio_file.save(audio_path)

    # Convertir el audio a MusicXML
    try:
        musicxml_file = convert_audio_to_musicxml(audio_path)

        mongo.db.users.update_one(
            {"_id": ObjectId(current_user)},
            {"$push": {"sheets": {"name": filename, "filename": filename, "musicxml": musicxml_file}}}
        )

        return jsonify({"success": True, "musicXmlUrl": musicxml_file}), 200
    except Exception as e:
        return jsonify({"error": f"Error al convertir el audio: {str(e)}"}), 500

@app.route('/upload/photo', methods=['POST'])
@jwt_required()
def uploadPhoto():
    current_user = get_jwt_identity()

    if 'photo' not in request.files:
        return jsonify({"error": "No file part"}), 400
    if 'name' not in request.form:
        return jsonify({"error": "No name part"}), 400
    
    name = request.form['name']

    photo_file = request.files['photo']
    if photo_file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    # Asegurarse de que el nombre del archivo sea seguro
    filename = secure_filename(photo_file.filename)

    # Si no tiene extensión, agregar .jpg como extensión predeterminada
    if not filename.lower().endswith(('.png', '.jpg', '.jpeg')):
        filename = f"{filename}.jpg"

    file_path = os.path.join(UPLOAD_FOLDER, filename)

    # Guardar el archivo
    photo_file.save(file_path)

    # Ahora convierte la imagen a MusicXML usando Audiveris
    try:
        musicxml_file = convert_image_to_musicxml(file_path)

        mongo.db.users.update_one({"_id": ObjectId(current_user)}, {"$push": {"sheets": {"name": name, "filename": filename, "musicxml": musicxml_file}}})

        return jsonify({"success": True, "musicXmlUrl": musicxml_file})
    except Exception as e:
        return jsonify({"error": f"Failed to convert image to MusicXML: {str(e)}"}), 500

def convert_image_to_musicxml(image_path):
    # Convertir la imagen a MusicXML usando Audiveris
    output_folder = os.path.join(UPLOAD_FOLDER, 'conversions')

    # Comando para ejecutar Audiveris con el archivo .bat
    try:
        subprocess.run([audiveris_route, '-batch', '-transcribe', '-export', '-output', output_folder, image_path], check=True)
        return os.path.basename(image_path).replace('.jpg', '.omr')
    except subprocess.CalledProcessError as e:
        raise Exception(f"Error during OCR processing: {str(e)}")

def convert_audio_to_musicxml(audio_path):
    # Implementa la lógica para convertir audio a MusicXML
    # Aquí puedes usar herramientas como Audiveris o cualquier otra librería
    output_folder = os.path.join(UPLOAD_FOLDER, 'conversions')
    os.makedirs(output_folder, exist_ok=True)

    # Simulación de conversión (reemplaza esto con la lógica real)
    musicxml_file = os.path.join(output_folder, os.path.basename(audio_path).replace('.wav', '.mxl'))
    with open(musicxml_file, 'w') as f:
        f.write("<musicxml>Simulación de conversión</musicxml>")

    return os.path.basename(musicxml_file)
    
@app.route('/sheets', methods=['GET'])
@jwt_required()
def get_sheets():
    current_user_id = get_jwt_identity()
    user = mongo.db.users.find_one({"_id": ObjectId(current_user_id)})
    if user and "sheets" in user:
        sheets = []
        for sheet in user["sheets"]:
            # Verificar si los archivos existen
            omr_path = os.path.join(app.config['UPLOAD_FOLDER'], 'conversions', sheet["musicxml"].replace('.mxl', '.omr'))
            mxl_path = os.path.join(app.config['UPLOAD_FOLDER'], 'conversions', sheet["musicxml"])
            if os.path.exists(omr_path) and os.path.exists(mxl_path):
                sheets.append(sheet)
        return jsonify({"sheets": sheets}), 200
    return jsonify({"sheets": []}), 200

@app.route('/uploads/sheets/<filename>')
def download_img_sheet(filename):
    response = send_from_directory(app.config['UPLOAD_FOLDER'], filename)
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

@app.route('/uploads/conversions/<filename>')
def download_conversion(filename):
    filename = secure_filename(filename)
    upload_folder = os.path.join(app.config['UPLOAD_FOLDER'], 'conversions')
    response = send_from_directory(upload_folder, filename)
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    if mongo.db.users.find_one({"email": email}):
        return jsonify({"message": "El usuario ya existe"}), 400

    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
    mongo.db.users.insert_one({"email": email, "password": hashed_password})
    return jsonify({"message": "Usuario registrado exitosamente"}), 201

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    # Verificar si el usuario existe
    user = mongo.db.users.find_one({"email": email})
    if not user:
        return jsonify({"message": "El usuario no existe"}), 404

    # Verificar si la contraseña es correcta
    if bcrypt.check_password_hash(user['password'], password):
        access_token = create_access_token(identity=str(user['_id']))
        return jsonify({"token": access_token, "email": email}), 200

    return jsonify({"message": "Contraseña incorrecta"}), 401

if __name__ == '__main__':
    app.run(debug=True)
