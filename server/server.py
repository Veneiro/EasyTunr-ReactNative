import os
import subprocess
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename

app = Flask(__name__)
CORS(app, origins=["http://localhost:8081"])

UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

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
def upload():
    if 'photo' not in request.files:
        return jsonify({"error": "No file part"}), 400

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
        musicxml_path = convert_image_to_musicxml(file_path)
        return jsonify({"success": True, "musicXmlUrl": f'http://localhost:5000/uploads/{os.path.basename(musicxml_path)}'})
    except Exception as e:
        return jsonify({"error": f"Failed to convert image to MusicXML: {str(e)}"}), 500

def convert_image_to_musicxml(image_path):
    # Convertir la imagen a MusicXML usando Audiveris
    output_file = image_path.replace('.jpg', '.xml').replace('.png', '.xml')
    
    # Comando para ejecutar Audiveris con el archivo .bat
    try:
        # Cambia la ruta de 'audiveris.bat' por la ruta real de tu archivo .bat
        subprocess.run(['C:/Program Files/Audiveris/bin/Audiveris.bat', '--batch', image_path, '--output', output_file], check=True)
        return output_file
    except subprocess.CalledProcessError as e:
        raise Exception(f"Error during OCR processing: {str(e)}")

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

if __name__ == '__main__':
    app.run(debug=True)
