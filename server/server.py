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
CORS(app, origins=["*"])
bcrypt = Bcrypt(app)
jwt = JWTManager(app)

UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

config = dotenv_values(".env")

app.config["MONGO_URI"] = config["MONGO_URI"]
app.config["JWT_SECRET_KEY"] = config["JWT_SECRET_KEY"]

mongo = PyMongo(app)

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

@app.route('/upload', methods=['POST'])
@jwt_required()
def upload():
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
        # Cambia la ruta de 'audiveris.bat' por la ruta real de tu archivo .bat
        subprocess.run(['C:/Program Files/Audiveris/bin/Audiveris.bat', '-batch', '-transcribe', '-export', '-output', output_folder, image_path], check=True)
        return os.path.basename(image_path).replace('.jpg', '.omr')
    except subprocess.CalledProcessError as e:
        raise Exception(f"Error during OCR processing: {str(e)}")

@app.route('/uploads/sheets/<filename>')
def download_img_sheet(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/uploads/conversions/<filename>')
def download_conversion(filename):
    filename = secure_filename(filename)
    upload_folder = os.path.join(app.config['UPLOAD_FOLDER'], 'conversions')
    return send_from_directory(upload_folder, filename)

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

    user = mongo.db.users.find_one({"email": email})
    if user and bcrypt.check_password_hash(user['password'], password):
        access_token = create_access_token(identity=str(user['_id']))
        return jsonify({"token": access_token}), 200

    return jsonify({"message": "Credenciales incorrectas"}), 401

if __name__ == '__main__':
    app.run(debug=True)
