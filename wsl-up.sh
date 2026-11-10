#!/usr/bin/env bash
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  echo "[ERROR] Docker no esta instalado en esta distro WSL."
  echo "Instala Docker Engine + Compose plugin dentro de WSL y vuelve a ejecutar este script."
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "[ERROR] Falta docker compose plugin."
  echo "Instala docker-compose-plugin en WSL."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "[INFO] Intentando iniciar el servicio docker..."
  if command -v sudo >/dev/null 2>&1; then
    sudo service docker start >/dev/null 2>&1 || true
  fi
fi

if ! docker info >/dev/null 2>&1; then
  echo "[ERROR] Docker daemon no esta corriendo en WSL."
  echo "Arrancalo con: sudo service docker start"
  exit 1
fi

if [[ "$(pwd)" == /mnt/* ]]; then
  echo "[WARN] Estas ejecutando el repo desde /mnt/* (disco Windows)."
  echo "Para mejor rendimiento en WSL, mueve el repo a ~/projects."
fi

# Some networks can reach Docker Hub API but block its layer CDN.
# Pre-seed essential images from mirror.gcr.io and tag them locally.
if ! docker image inspect mongo:7 >/dev/null 2>&1; then
  echo "[INFO] Precargando mongo:7 desde mirror.gcr.io..."
  docker pull mirror.gcr.io/library/mongo:7
  docker tag mirror.gcr.io/library/mongo:7 mongo:7
fi

if ! docker image inspect python:3.11-slim >/dev/null 2>&1; then
  echo "[INFO] Precargando python:3.11-slim desde mirror.gcr.io..."
  docker pull mirror.gcr.io/library/python:3.11-slim
  docker tag mirror.gcr.io/library/python:3.11-slim python:3.11-slim
fi

# server/.env no se versiona: si no existe, se crea desde la plantilla con un secreto aleatorio.
if [[ ! -f server/.env ]]; then
  echo "[INFO] Creando server/.env a partir de server/.env.example..."
  secret="$(head -c 48 /dev/urandom | base64 | tr -d '/+=
')"
  sed "s|^JWT_SECRET_KEY=.*|JWT_SECRET_KEY=${secret}|" server/.env.example > server/.env
fi

BUILD_FLAG=""
if [[ "${1:-}" == "--build" ]]; then
  BUILD_FLAG="--build"
fi

echo "[INFO] Levantando servicios con Docker Compose..."
docker compose up ${BUILD_FLAG} -d

echo "[OK] Servicios levantados"
echo "API:    http://localhost:5000"
echo "Swagger:http://localhost:5000/docs"
echo "OpenAPI:http://localhost:5000/openapi.json"
echo "Logs:   docker compose logs -f"
