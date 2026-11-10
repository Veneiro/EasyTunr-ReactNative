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

| Variable | Descripcion |
|----------|-------------|
| `MONGO_URI` | Cadena de conexion a MongoDB |
| `JWT_SECRET_KEY` | Secreto para firmar los JWT (>= 32 caracteres) |
| `JWT_ACCESS_TOKEN_EXPIRES_SECONDS` | Vida del access token (por defecto 600) |
| `FLASK_DEBUG` | `1` activa el modo debug al usar `python server.py` |

## 4. Endpoints

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/health` | - | Estado del servicio |
| POST | `/register` | - | Crear usuario |
| POST | `/login` | - | Devuelve un access token |
| POST | `/auth/refresh` | JWT | Renueva un token que aun no ha caducado |
| GET | `/user` | JWT | Email del usuario actual |
| POST | `/upload/photo` | JWT | Imagen a MusicXML (asincrono, devuelve `task_id`) |
| POST | `/upload/audio` | JWT | Audio a MusicXML (asincrono, devuelve `task_id`) |
| GET | `/conversion_status/<task_id>` | JWT | Estado de una conversion |
| GET | `/sheets` | JWT | Partituras del usuario |
| PATCH | `/sheets/reorder` | JWT | Reordenar partituras |
| DELETE | `/sheets/<sheet_key>` | JWT | Borrar una partitura y sus archivos |
| GET | `/uploads/sheets/<filename>` | JWT | Archivo original (imagen/audio) |
| GET | `/uploads/conversions/<filename>` | JWT | MusicXML / metadatos generados |

## 5. Flujo de conversion

1. El archivo subido se guarda en `uploads/` con un nombre UUID.
2. Un hilo en segundo plano convierte el archivo (ver [docs/OEMER_INTEGRATION.md](../docs/OEMER_INTEGRATION.md)).
3. El resultado se guarda en `uploads/conversions/` y la entrada se anade a `users.sheets` en MongoDB.
4. El original se conserva, porque la app lo muestra y lo reproduce. Se borra al eliminar la partitura o si la conversion falla.

Limitacion conocida: el estado de las tareas (`conversion_tasks`) vive en memoria, asi que se
pierde al reiniciar y solo funciona con 1 worker de gunicorn (como esta configurado ahora).
