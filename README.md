# EasyTunr

App React Native (Expo) que convierte partituras fotografiadas y grabaciones de audio a MusicXML.
Backend Flask (Python) + MongoDB.

## Arranque rapido

### 1. Backend + MongoDB (Docker en WSL)

Desde Ubuntu en WSL, en la raiz del repo:

```bash
bash ./wsl-up.sh            # la primera vez crea server/.env con un JWT_SECRET_KEY aleatorio
bash ./wsl-up.sh --build    # si cambiaste requirements.txt o el Dockerfile
bash ./wsl-logs.sh          # logs del backend en tiempo real
bash ./wsl-down.sh          # parar servicios
```

Servicios:

- API backend: http://localhost:5000
- Swagger UI: http://localhost:5000/docs
- MongoDB: mongodb://localhost:27017

### 2. Frontend

En otra terminal:

```bash
npm install
npm start
```

Por defecto la app apunta a `http://10.0.2.2:5000` en el emulador Android y a
`http://127.0.0.1:5000` en iOS/web. Para otra URL (por ejemplo un movil fisico), crea
`.env.local` con `EXPO_PUBLIC_API_URL=http://<ip-del-pc>:5000`.

## Configuracion

`server/.env` **no se sube a git**. La plantilla es [server/.env.example](server/.env.example).
Si arrancas el backend sin Docker, copiala a `server/.env` y genera un secreto:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

## Documentacion

- [server/README.md](server/README.md): backend, variables y endpoints
- [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md): estructura del proyecto
- [docs/OEMER_INTEGRATION.md](docs/OEMER_INTEGRATION.md): como funcionan las conversiones imagen/audio a MusicXML
