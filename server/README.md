# EasyTunr Server

Backend Flask con autenticacion JWT, conversion OMR y export a MusicXML.

## 1. Ejecucion recomendada (WSL + Docker)

Desde la raiz del repo:

```bash
bash ./wsl-up.sh
```

URLs:

- API: http://localhost:5000
- Swagger UI: http://localhost:5000/docs
- OpenAPI JSON: http://localhost:5000/openapi.json

Parar servicios:

```bash
bash ./wsl-down.sh
```

## 2. Ejecucion local sin Docker (solo backend)

```bash
cd server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python server.py
```

## 3. Variables de entorno

Archivo `server/.env`:

```env
MONGO_URI=mongodb://localhost:27017/easytunr
JWT_SECRET_KEY=tu_clave_super_secreta
OMR_ENGINE=custom-omr
OMR_MODEL_WEIGHTS=
OMR_CONFIDENCE=0.25
OMR_DEVICE=cpu
OMR_SEQ2SEQ_MODEL_ID=
OMR_SEQ2SEQ_MAX_NEW_TOKENS=256
OMR_SEQ2SEQ_NUM_BEAMS=2
OMR_STAFF_PROJECTION_FACTOR=0.55
```

Notas:

- Si `OMR_MODEL_WEIGHTS` esta vacio, el backend usa fallback heuristico.
- Cuando tengas un `best.pt`, solo actualiza `OMR_MODEL_WEIGHTS` y reinicia.
- Para conversion estable y editable en MuseScore, usa `OMR_ENGINE=custom-omr`.
- El modo `seq2seq` es opcional/experimental y requiere un modelo OMR realmente compatible.

## 4. Flujo OMR en API

Endpoint principal: `POST /upload/photo`

Pipeline:

1. Guarda imagen en `server/uploads/`.
2. Ejecuta transcripcion OMR.
3. Guarda `*.omr.json` y `*.musicxml` en `server/uploads/conversions/`.
4. Guarda metadata en MongoDB (`users.sheets`).

## 5. Integrar modelo externo (.pt)

El entrenamiento se hace fuera del repo (por ejemplo en Google Colab).
Cuando tengas `best.pt`:

1. Guarda el archivo en una ruta estable (local o dentro de `server/`).
2. Configura en `server/.env`:

```env
OMR_MODEL_WEIGHTS=C:\ruta\a\best.pt
OMR_CONFIDENCE=0.25
OMR_DEVICE=cpu
```

3. Reinicia backend.

## 6. Usar enfoque CRNN/Pixel2Sequence (sin entrenamiento local)

Tambien puedes usar un modelo preentrenado de tipo image-to-sequence (staff-wise).

Configura en `server/.env`:

```env
OMR_ENGINE=seq2seq
OMR_SEQ2SEQ_MODEL_ID=tu-org/tu-modelo-omr
OMR_DEVICE=cuda
OMR_SEQ2SEQ_MAX_NEW_TOKENS=256
OMR_SEQ2SEQ_NUM_BEAMS=2
OMR_STAFF_PROJECTION_FACTOR=0.55
```

Notas practicas:

- El pipeline segmenta por pentagramas para reducir consumo de memoria.
- El endpoint sigue siendo `POST /upload/photo`.
- Si la secuencia no se puede parsear a notas, se aplica fallback heuristico para mantener salida MusicXML.
- El parser actual admite tokens como `C4`, `D#5:q`, `Eb4:0.5`.

### Arranque rapido recomendado (estable)

1. Instala dependencias del backend:

```bash
cd server
python -m pip install -r requirements.txt
```

2. Arranca el servidor:

```bash
python server.py
```

3. Sube una imagen a `POST /upload/photo` desde la app.

Que se descarga automaticamente la primera vez:

- Paquetes Python de `requirements.txt` (incluye `torch`, `transformers`, `Pillow`).
- Si activas `seq2seq`, tambien se descargan pesos del modelo en `OMR_SEQ2SEQ_MODEL_ID`.

No tienes que entrenar ningun modelo localmente.
