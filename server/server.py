import os
from flask import Flask, request, jsonify, send_from_directory
from basic_pitch import ICASSP_2022_MODEL_PATH
from basic_pitch.inference import predict_and_save
import soundfile as sf
from flask_cors import CORS

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

@app.route('/convert', methods=['POST'])
def convert():
    if 'audio' not in request.files:
        print("No se encontró el archivo en la solicitud.")
        return jsonify({"error": "No file part"}), 400
    
    audio_file = request.files['audio']
    if audio_file.filename == '':
        print("El archivo está vacío o no se seleccionó.")
        return jsonify({"error": "No selected file"}), 400

    print(f"Archivo recibido: {audio_file.filename}")
    # Aquí agregarías el proceso de conversión, solo para demostración
    return jsonify({"midi_file": "https://path_to_midi_file.mid"})


def preprocess_audio(input_audio_path):
    audio, sr = sf.read(input_audio_path)
    if len(audio.shape) > 1:
        audio = audio.mean(axis=1)  # Convertir a mono si es estéreo
    sf.write(input_audio_path, audio, sr)


def transcribe_audio_to_midi(input_audio_path, output_midi_dir):
    os.makedirs(output_midi_dir, exist_ok=True)
    predict_and_save(
        [input_audio_path],
        output_directory=output_midi_dir,
        save_midi=True,
        sonify_midi=False,
        save_model_outputs=False,
        save_notes=False,
        model_or_model_path=ICASSP_2022_MODEL_PATH
    )
    midi_filename = os.path.basename(input_audio_path).replace(".wav", "_basic_pitch.mid")
    return os.path.join(output_midi_dir, midi_filename)


@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

if __name__ == '__main__':
    app.run(debug=True)
