# EasyTunr Server

Backend Flask con autenticacion JWT, conversion imagen/audio a MusicXML y MongoDB.

## 1. Ejecucion recomendada (WSL + Docker)

Desde la raiz del repo:

```bash
bash ./wsl-up.sh
```

- API: http://localhost:5000
- Swagger UI: http://localhost:5000/docs
- OpenAPI JSON: http://localhost:5000/openapi.json

Docker Compose lee `server/.env` y sobrescribe `MONGO_URI` para apuntar al contenedor `mongo`.

## 2. Ejecucion local sin Docker

Requiere MongoDB corriendo en local y Python 3.10-3.12 (rango que admite oemer).

```bash
cd server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env     # y rellena JWT_SECRET_KEY
python server.py
```

`server.py` lee `server/.env` aunque lo lances desde otra carpeta.

## 3. Variables de entorno (`server/.env`)

```env
MONGO_URI=mongodb://localhost:27017/easytunr
JWT_SECRET_KEY=tu_clave_super_secreta
OMR_ENGINE=clarity-omr
OMR_DEVICE=cpu
OMR_CLARITY_REPO_PATH=C:\ruta\a\Clarity-OMR
OMR_CLARITY_PYTHON=python
OMR_CLARITY_FAST=true
OMR_MODEL_WEIGHTS=
OMR_CONFIDENCE=0.25
OMR_SEQ2SEQ_MODEL_ID=clquwu/Clarity-OMR
OMR_SEQ2SEQ_MAX_NEW_TOKENS=256
OMR_SEQ2SEQ_NUM_BEAMS=2
OMR_STAFF_PROJECTION_FACTOR=0.55
```

## 4. Endpoints

- `OMR_ENGINE=clarity-omr` ahora ejecuta el flujo oficial del repo `clquwu/Clarity-OMR` (deteccion de pentagramas + reconocimiento + export MusicXML).
- Debes clonar ese repo y configurar `OMR_CLARITY_REPO_PATH`.
- Si `OMR_ENGINE` es distinto a `clarity-omr`, se usa el pipeline interno de EasyTunr.

## 5. Flujo de conversion

1. El archivo subido se guarda en `uploads/` con un nombre UUID.
2. Un hilo en segundo plano convierte el archivo (ver [docs/OEMER_INTEGRATION.md](../docs/OEMER_INTEGRATION.md)).
3. El resultado se guarda en `uploads/conversions/` y la entrada se anade a `users.sheets` en MongoDB.
4. El original se conserva, porque la app lo muestra y lo reproduce. Se borra al eliminar la partitura o si la conversion falla.

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

## 7. Clarity-OMR como flujo principal

1. Clona el repo oficial:

```bash
git clone https://github.com/clquwu/Clarity-OMR.git
cd Clarity-OMR
pip install -r requirements.txt
```

2. Configura EasyTunr:

```env
OMR_ENGINE=clarity-omr
OMR_DEVICE=cpu
OMR_CLARITY_REPO_PATH=C:\ruta\a\Clarity-OMR
OMR_CLARITY_PYTHON=python
OMR_CLARITY_FAST=true
```

3. Reinicia backend.

Con esto, `POST /upload/photo` ejecuta `omr.py` del proyecto Clarity-OMR y guarda el MusicXML real generado por ese modelo en `uploads/conversions/`.
