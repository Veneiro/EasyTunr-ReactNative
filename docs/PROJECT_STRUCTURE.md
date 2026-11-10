# EasyTunr - Estructura del Proyecto

```
EasyTunr-ReactNative/
├── App.js                    # Navegación, cabecera y control de sesión
├── lib/
│   ├── api.js                # URL base del backend (según plataforma / EXPO_PUBLIC_API_URL)
│   ├── authSession.js        # Token JWT en AsyncStorage, refresco y caducidad por inactividad
│   └── authImage.js          # Descarga de imágenes protegidas por JWT (data URI)
├── screens/
│   ├── js/                   # Lógica de cada pantalla (Login, Register, Home, Photo, Audio, Conversions)
│   ├── views/                # JSX de cada pantalla
│   ├── styles/               # StyleSheets + theme.js
│   └── components/           # AnimatedEntrance, GradientBackground, AuthImage
│
├── server/                   # Backend Flask
│   ├── server.py             # App: auth, subidas, conversiones, partituras, Swagger
│   ├── omr/pipeline.py       # Wrapper del CLI de oemer (imagen a MusicXML)
│   ├── requirements.txt      # Dependencias (las que usa Docker)
│   ├── pyproject.toml        # Mismas dependencias para Poetry
│   ├── Dockerfile
│   ├── .env.example          # Plantilla de server/.env (el .env real no se versiona)
│   └── uploads/              # Archivos subidos y conversiones (no versionado)
│
├── android/ ios/             # Proyectos nativos (Expo prebuild)
├── docker-compose.yml        # MongoDB 7 + backend
├── wsl-up.sh / wsl-down.sh / wsl-logs.sh
└── docs/
```

## Tech stack

**Frontend:** React Native 0.83, Expo 55, React 19.2, React Navigation 7, react-native-paper.

**Backend:** Flask 3, flask-jwt-extended, PyMongo, music21, oemer (OMR), librosa (pitch tracking de audio), Gunicorn.

**Infra:** Docker Compose (MongoDB 7 + backend), scripts para WSL.

## Troubleshooting

- **El emulador Android no llega a la API:** usa `10.0.2.2:5000` (es el valor por defecto) o define `EXPO_PUBLIC_API_URL`.
- **`RuntimeError: JWT_SECRET_KEY no esta configurada`:** falta `server/.env`. Cópialo desde `.env.example`, o arranca con `wsl-up.sh`, que lo crea.
- **Error 503 de MongoDB:** `docker compose ps` para comprobar que `easytunr-mongo` está healthy.
