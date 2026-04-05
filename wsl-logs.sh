#!/usr/bin/env bash
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  echo "[ERROR] Docker no esta instalado en esta distro WSL."
  exit 1
fi

echo "[INFO] Estado de contenedores:"
docker compose ps || true

echo "[INFO] Ultimos logs del backend:"
docker compose logs --tail=120 server || true
echo "[INFO] Siguiendo logs en tiempo real (Ctrl+C para salir)..."
docker compose logs -f --tail=40 server
