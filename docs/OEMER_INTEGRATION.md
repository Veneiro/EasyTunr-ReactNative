# Integración de Oemer OMR

Guía sobre la integración del motor OCR de partituras **oemer** en EasyTunr.

## Estado de la Integración

✅ **Completada**:
- `omr/pipeline.py`: Método `_transcribe_oemer()` implementado
- `omr/musicxml.py`: Nuevas funciones para exportar scores de music21 directamente
- `server/server.py`: Endpoint `/upload/photo` actualizado para manejar scores de oemer
- Fallback automático a otros motores si oemer falla

## Flujo de Conversión de Imagen

```
1. Cliente sube imagen
   ↓
2. POST /upload/photo → uploadPhoto()
   ↓
3. convert_image_to_musicxml(image_path)
   ├─ omr_pipeline.transcribe(image_path)
   │  └─ _transcribe_oemer(image_path)
   │     └─ oemer.ete.extract(image_path)
   │        └─ Retorna: music21.stream.Score
   ├─ Guardar Score en result["score"]
   ├─ Extraer notas: score_to_notes(score)
   ├─ Guardar JSON metadatos (sin objeto Score)
   └─ Exportar MusicXML: write_score_to_musicxml(score, output_path)
   ↓
4. MongoDB registra conversión
   ├─ sheets.insert_one({ omr_file, mxl_file, engine: "oemer", ... })
   └─ Retorna URLs de descarga
   ↓
5. Cliente obtiene MusicXML + JSON de metadata
```

## Configuración

### Variables de Entorno

En `server/.env`:

```bash
# Motor OMR (oemer, seq2seq, custom-omr)
OMR_ENGINE=oemer

# Dispositivo de cómputo (cpu, cuda)
OMR_DEVICE=cpu

# Factor de proyección de pentagramas (0.1-0.95)
OMR_STAFF_PROJECTION_FACTOR=0.55
```

**Nota**: El código fuente en `server.py` (línea ~67) define el default como `oemer`. Si quieres cambiar, modifica:
- `.env` (si ejecutas localmente con `python server.py`)
- Docker: `docker-compose.yml` con `-e OMR_ENGINE=...`

### Instalación de Dependencias

```bash
cd server
pip install -r requirements.txt

# oemer ya está en requirements.txt, pero verifica:
pip install oemer music21
```

## API Reference

### POST /upload/photo

Convierte una imagen de partitura a MusicXML.

**Request:**
```http
POST /upload/photo HTTP/1.1
Authorization: Bearer <JWT_TOKEN>
Content-Type: multipart/form-data

photo=<binary_image_file>
name=<display_name>
```

**Response (200 OK):**
```json
{
  "message": "Upload and conversion successful",
  "sheet": {
    "_id": "...",
    "user_email": "user@example.com",
    "name": "Sheet 1",
    "omr_file": "base.omr.json",
    "mxl_file": "base.musicxml",
    "engine": "oemer",
    "created_at": "2024-01-01T12:00:00Z"
  }
}
```

**Response (400 Bad Request):**
```json
{
  "message": "Photo and name are required"
}
```

### Archivos Generados

Se guardan en `uploads/conversions/`:

- **`{base}.omr.json`**: Metadatos de la conversión
  ```json
  {
    "engine": "oemer",
    "status": "success",
    "notes": [
      {"pitch": "C4", "duration": 1.0},
      {"pitch": "D4", "duration": 0.5},
      ...
    ]
  }
  ```

- **`{base}.musicxml`**: Archivo MusicXML estándar (abre en MuseScore, Finale, etc.)

## Código Relevante

### Funciones Principales

#### `server/omr/pipeline.py`

```python
def _transcribe_oemer(self, image_path):
    """Procesa imagen con oemer, retorna Score y notas."""
    from oemer.ete import extract
    from omr.musicxml import score_to_notes
    
    score = extract(image_path)
    notes = score_to_notes(score)
    
    return {
        "engine": "oemer",
        "status": "success",
        "notes": notes,
        "score": score  # Para exportar directamente a MusicXML
    }
```

#### `server/omr/musicxml.py`

```python
def write_score_to_musicxml(score_obj, output_path, title="..."):
    """Exporta un music21.Score directamente a MusicXML."""
    if not score_obj.metadata:
        score_obj.metadata = metadata.Metadata(title=title, composer="EasyTunr (oemer)")
    score_obj.write("musicxml", fp=output_path)

def score_to_notes(score_obj):
    """Extrae notas del Score para compatibilidad con pipeline."""
    notes_list = []
    for n in score_obj.flatten().notes:
        if isinstance(n, note.Note):
            notes_list.append({
                "pitch": n.pitch.nameWithOctave,
                "duration": float(n.quarterLength)
            })
    return notes_list
```

#### `server/server.py`

```python
def convert_image_to_musicxml(image_path):
    """Convierte imagen → MusicXML usando engine configurado."""
    result = omr_pipeline.transcribe(image_path)
    
    score_obj = result.pop("score", None)
    
    # Guardar JSON sin objeto Score
    with open(omr_path, "w") as f:
        json.dump(result, f)
    
    # Exportar a MusicXML
    if score_obj is not None:
        write_score_to_musicxml(score_obj, mxl_path, title=base)
    else:
        write_musicxml(result.get("notes", []), mxl_path, title=base)
```

## Pruebas

### Test Manual

1. **Levanta el backend:**
   ```bash
   cd server
   docker-compose up
   # O localmente:
   # python server.py (requiere MongoDB)
   ```

2. **Autenticate:**
   ```bash
   curl -X POST http://localhost:5000/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"123456"}'
   
   # Obtén el JWT_TOKEN
   ```

3. **Sube una imagen:**
   ```bash
   curl -X POST http://localhost:5000/upload/photo \
     -H "Authorization: Bearer <JWT_TOKEN>" \
     -F "photo=@test_score.png" \
     -F "name=Test Sheet"
   ```

4. **Descarga el resultado:**
   ```bash
   # Obtendrás omr_file y mxl_file del response anterior
   curl http://localhost:5000/uploads/conversions/filename.musicxml > result.musicxml
   ```

5. **Abre en MuseScore/Finale:**
   - [MuseScore](https://musescore.com) (gratuito)
   - Finale
   - Sibelius
   - Notion

### Test Automático

```bash
cd server
python -c "
from omr.pipeline import OMRPipeline, OMRPipelineConfig
config = OMRPipelineConfig(engine='oemer', device='cpu')
pipeline = OMRPipeline(config)
result = pipeline.transcribe('test_score.png')
print('Notas:', len(result['notes']))
print('Engine:', result['engine'])
print('Status:', result['status'])
"
```

## Troubleshooting

### Error: "No se puede importar oemer"
```
pip install oemer
# Si falla en Windows, intenta desde WSL/Docker
```

### Error: "No se pudo cargar la imagen"
- Verifica que el archivo sea PNG/JPG válido
- Tamaño mínimo: ~100x100px
- Máximo: ~5000x5000px (performance)

### MusicXML vacío o sin notas
- Oemer requiere partituras claras en formato estándar
- Prueba con partitura escaneada de calidad
- Verifica `uploads/conversions/{base}.omr.json` para debugging

### MongoDB desconectado (503 error)
```bash
docker-compose up mongo  # Levanta solo MongoDB
# O localmente: mongod --dbpath ~/data/mongo
```

## Motor Anterior (custom-omr)

El motor basado en YOLO sigue disponible. Para usarlo:

1. En `server/.env`:
   ```
   OMR_ENGINE=custom-omr
   ```

2. Coloca pesos del modelo en `server/omr/models/` (o usa los default)

3. O fuerza en código:
   ```python
   config = OMRPipelineConfig(engine="custom-omr", ...)
   ```

## Próximas Mejoras

- [ ] GUI para seleccionar motor OMR
- [ ] Corrección manual de notas antes de guardar
- [ ] Validación de pentagramas incompletos
- [ ] Exportar a otros formatos (MIDI, LilyPond, MNX)
- [ ] Batch conversion
