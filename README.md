# EasyTunr

Proyecto con frontend React Native y backend Python (OMR) + MongoDB.

## Arranque rapido (WSL)

Desde Ubuntu en WSL, en la raiz del repo:

```bash
bash ./wsl-up.sh
```

Si cambiaste dependencias del backend o Dockerfile, fuerza reconstruccion:

```bash
bash ./wsl-up.sh --build
```

Servicios levantados:

- API backend: http://localhost:5000
- Swagger UI: http://localhost:5000/docs
- MongoDB: mongodb://localhost:27017

Parar servicios:

```bash
bash ./wsl-down.sh
```

Ver errores del backend en tiempo real:

```bash
bash ./wsl-logs.sh
```

Si cambiaste `server/Dockerfile` (por ejemplo logs de Gunicorn), reconstruye:

```bash
bash ./wsl-up.sh --build
```

WSL aqui se usa solo para levantar Docker (backend + Mongo).

## Frontend

En otra terminal:

```bash
npm install
npm start
```

## Documentacion

- Backend: [server/README.md](server/README.md)

## Modelo OMR externo (.pt)

El entrenamiento del modelo se realiza fuera del proyecto (por ejemplo en Google Colab).
Cuando tengas el archivo `.pt`, solo tienes que configurarlo en `server/.env`:

```env
OMR_MODEL_WEIGHTS=C:\ruta\a\tu\best.pt
OMR_CONFIDENCE=0.25
OMR_DEVICE=cpu
```

Reinicia backend y listo.

Tambien puedes usar un modelo preentrenado CRNN/Pixel2Sequence sin entrenar localmente:

```env
OMR_ENGINE=seq2seq
OMR_SEQ2SEQ_MODEL_ID=tu-org/tu-modelo-omr
OMR_DEVICE=cuda
```

El endpoint no cambia (`POST /upload/photo`).

## Seq2Seq sin entrenar (lo minimo que necesitas)

1. Instalar dependencias del backend:

```bash
cd server
python -m pip install -r requirements.txt
```

2. Arrancar backend:

```bash
python server.py
```

3. Probar conversion de imagen desde la app (`/upload/photo`).

Descargas necesarias:

- Dependencias Python (pip).
- Pesos del modelo Hugging Face configurado en `server/.env`.
