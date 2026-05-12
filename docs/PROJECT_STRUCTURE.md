# EasyTunr - Estructura del Proyecto

## 📁 Estructura

```
EasyTunr-ReactNative/
├── server/                    # Backend Flask + OMR
│   ├── server.py             # App principal con endpoints REST
│   ├── requirements.txt       # Dependencias Python
│   ├── Dockerfile            # Docker image para producción
│   ├── omr/                  # Motor OMR (Optical Music Recognition)
│   │   ├── pipeline.py       # Orquestador de motores (oemer, seq2seq, custom-omr)
│   │   ├── musicxml.py       # Exportación a MusicXML
│   │   └── __init__.py
│   └── uploads/              # Carpeta generada con archivos subidos
│
├── screens/                   # Frontend React Native
│   ├── js/                   # Pantallas (Login, Home, Photo, Audio, etc.)
│   ├── components/           # Componentes reutilizables
│   ├── styles/              # Estilos (StyleSheet de React Native)
│   └── views/               # Vistas renderizadas
│
├── lib/
│   └── api.js               # Cliente HTTP para backend (detecta plataforma)
│
├── android/                  # Proyecto Android (generado por Expo)
├── ios/                      # Proyecto iOS (generado por Expo)
├── assets/                   # Recursos estáticos
│
├── docker-compose.yml        # Stack: MongoDB 7 + Flask backend
├── package.json              # Dependencias Node.js (React Native + Expo)
├── app.json                  # Configuración de Expo
├── babel.config.js           # Babel transpiler config
├── metro.config.js           # Metro bundler config (React Native)
│
├── docs/                     # 📄 Documentación
│   ├── README.md            # Índice de docs
│   └── OEMER_INTEGRATION.md # Guía de oemer OMR
│
├── wsl-up.sh                # Script: Levanta MongoDB + server en WSL
├── wsl-down.sh              # Script: Apaga servicios
├── wsl-logs.sh              # Script: Ver logs
│
└── .gitignore               # Archivos ignorados por Git

# Archivos generados (no commiteados)
- node_modules/              # Dependencias NPM
- server/.venv/              # Virtual env Python
- server/uploads/            # Archivos subidos por usuarios
- __pycache__/              # Caché de bytecode Python
```

## 🚀 Cómo Usar

### Desarrollo Local

```bash
# 1. Backend (requiere MongoDB corriendo)
cd server
pip install -r requirements.txt
python server.py
# Corre en http://localhost:5000

# 2. Frontend (en otra terminal)
npm install
npm expo start
# Escanea QR con Expo Go app o usa emulador
```

### Con Docker (recomendado)

```bash
# Levanta MongoDB + Backend juntos
docker-compose up

# En otra terminal, frontend
npm expo start
```

### Usando WSL Scripts

```bash
bash wsl-up.sh    # Levanta MongoDB + backend
bash wsl-logs.sh  # Ver logs
bash wsl-down.sh  # Apagar
```

## 🔑 Variables de Entorno

**server/.env**:
```
MONGO_URI=mongodb://localhost:27017/easytunr
JWT_SECRET_KEY=1234
OMR_ENGINE=oemer          # Motor de OMR: oemer, seq2seq, custom-omr
OMR_DEVICE=cpu            # cpu o cuda
OMR_STAFF_PROJECTION_FACTOR=0.55
```

**Frontend (.env.local - opcional)**:
```
EXPO_PUBLIC_API_URL=http://10.0.2.2:5000  # Para Android emulator
```

## 📚 Documentación

- **docs/OEMER_INTEGRATION.md** - Guía completa de OCR de partituras
- **README.md** - Overview general del proyecto

## 🔧 Tech Stack

**Backend**:
- Flask 3.1.0 (Python)
- MongoDB 7 (Base de datos)
- PyMongo 4.10.1 (Driver)
- music21 9.3.0 (Procesamiento de música)
- oemer (OCR de partituras)
- librosa (Audio processing)

**Frontend**:
- React Native 0.83.4
- Expo 55.0.23
- React 18.3.1

**DevOps**:
- Docker & Docker Compose
- Gunicorn (WSGI server)

## 📋 Endpoints Principales

| Método | Path | Descripción |
|--------|------|-------------|
| POST | `/register` | Crear usuario |
| POST | `/login` | Autenticación JWT |
| POST | `/upload/photo` | Convertir imagen → MusicXML |
| POST | `/upload/audio` | Convertir audio → MusicXML |
| GET | `/sheets` | Listar partituras del usuario |
| GET | `/health` | Estado del servicio |

## 🐛 Troubleshooting

### "Cannot connect to MongoDB"
```bash
# Verifica que esté corriendo
mongosh --eval "db.adminCommand('ping')"
# O con docker-compose
docker-compose ps
```

### "ImportError: No module named 'oemer'"
```bash
cd server
pip install oemer
```

### API endpoint not reachable en emulador Android
- Asegúrate que `lib/api.js` use `10.0.2.2:5000` (no localhost)
- O configura `EXPO_PUBLIC_API_URL=http://10.0.2.2:5000`

## 📝 Notas

- Los archivos subidos se guardan en `server/uploads/` (no commiteado)
- MongoDB data se persiste en volumen Docker `mongo_data` si usas docker-compose
- Frontend necesita backend + MongoDB para funcionar correctamente
