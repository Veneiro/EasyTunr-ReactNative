#!/usr/bin/env bash
# Prepara Docker en WSL para usar la GPU NVIDIA.
#
# El Docker snap de Ubuntu no puede acceder a la GPU en WSL (WSL expone la GPU
# por /dev/dxg y el snap solo busca /dev/nvidiactl). Este script:
#   1. Guarda las imagenes de EasyTunr y los datos de MongoDB del Docker snap.
#   2. Sustituye el Docker snap por Docker Engine oficial (apt).
#   3. Configura NVIDIA Container Toolkit y prueba la GPU.
#   4. Restaura las imagenes y los datos de MongoDB.
#
# Uso: sudo bash ./wsl-setup-gpu.sh   (solo hace falta una vez)
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "[ERROR] Ejecuta este script con sudo: sudo bash ./wsl-setup-gpu.sh"
  exit 1
fi

if ! /usr/lib/wsl/lib/nvidia-smi >/dev/null 2>&1; then
  echo "[ERROR] WSL no ve ninguna GPU NVIDIA. Actualiza el driver de NVIDIA en Windows."
  exit 1
fi

BACKUP_DIR=/var/tmp/easytunr-docker-backup

on_abort() {
  echo
  echo "[AVISO] Script interrumpido. Es seguro volver a ejecutarlo: sudo bash ./wsl-setup-gpu.sh"
  echo "        No borres $BACKUP_DIR hasta que todo funcione."
}
trap on_abort INT ERR
MONGO_VOLUME=easytunr-reactnative_mongo_data
IMAGES=(easytunr-reactnative-server:latest mongo:7 python:3.11-slim)

docker_ready() {
  for _ in $(seq 1 30); do
    docker info >/dev/null 2>&1 && return 0
    sleep 1
  done
  return 1
}

# --- 1. Copia de seguridad desde el Docker snap -------------------------------
if snap list docker >/dev/null 2>&1; then
  echo "[INFO] Docker snap detectado: guardando imagenes y datos en $BACKUP_DIR ..."
  mkdir -p "$BACKUP_DIR"
  # Por si una ejecucion anterior se interrumpio con el snap ya detenido.
  snap start docker >/dev/null 2>&1 || true
  docker_ready || { echo "[ERROR] El Docker snap no responde."; exit 1; }

  docker rm -f easytunr-server easytunr-mongo >/dev/null 2>&1 || true

  existing_images=()
  for image in "${IMAGES[@]}"; do
    docker image inspect "$image" >/dev/null 2>&1 && existing_images+=("$image")
  done
  if [[ ${#existing_images[@]} -gt 0 ]]; then
    docker save -o "$BACKUP_DIR/images.tar" "${existing_images[@]}"
  fi

  if docker volume inspect "$MONGO_VOLUME" >/dev/null 2>&1; then
    mongo_path=$(docker volume inspect "$MONGO_VOLUME" --format '{{.Mountpoint}}')
    # Mismas etiquetas al restaurar para que Compose no proponga recrear el volumen.
    docker volume inspect "$MONGO_VOLUME" \
      --format '{{range $k, $v := .Labels}}{{$k}}={{$v}}{{"\n"}}{{end}}' > "$BACKUP_DIR/mongo_labels"
    snap stop docker
    rm -rf "$BACKUP_DIR/mongo_data"
    cp -a "$mongo_path" "$BACKUP_DIR/mongo_data"
  fi

  # --purge: sin instantanea automatica (duplicaria >20 GB); la copia de arriba
  # ya guarda lo necesario.
  echo "[INFO] Desinstalando el Docker snap..."
  snap stop docker >/dev/null 2>&1 || true
  snap remove --purge docker
  hash -r
fi

# --- 2. Docker Engine oficial ------------------------------------------------
if ! command -v dockerd >/dev/null 2>&1; then
  echo "[INFO] Instalando Docker Engine oficial..."
  apt-get update
  apt-get install -y ca-certificates curl gnupg
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  codename=$(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $codename stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

if [[ -n "${SUDO_USER:-}" ]]; then
  usermod -aG docker "$SUDO_USER"
fi

# --- 3. NVIDIA Container Toolkit ---------------------------------------------
if ! command -v nvidia-ctk >/dev/null 2>&1; then
  echo "[INFO] Instalando NVIDIA Container Toolkit..."
  curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey \
    | gpg --dearmor --yes -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
  curl -fsSL https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list \
    | sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' \
    > /etc/apt/sources.list.d/nvidia-container-toolkit.list
  apt-get update
  apt-get install -y nvidia-container-toolkit
fi

echo "[INFO] Configurando Docker para usar el runtime de NVIDIA..."
nvidia-ctk runtime configure --runtime=docker
if pidof systemd >/dev/null 2>&1; then
  systemctl enable docker >/dev/null 2>&1 || true
  systemctl restart docker
else
  service docker restart
fi
docker_ready || { echo "[ERROR] Docker no arranco."; exit 1; }

echo "[INFO] Probando la GPU dentro de un contenedor..."
docker run --rm --gpus all ubuntu:22.04 nvidia-smi --query-gpu=name,memory.total --format=csv,noheader

# --- 4. Restaurar imagenes y datos -------------------------------------------
if [[ -f "$BACKUP_DIR/images.tar" ]]; then
  echo "[INFO] Restaurando imagenes..."
  docker load -i "$BACKUP_DIR/images.tar"
fi

if [[ -d "$BACKUP_DIR/mongo_data" ]]; then
  echo "[INFO] Restaurando datos de MongoDB..."
  label_args=()
  while IFS= read -r label; do
    [[ -n "$label" ]] && label_args+=(--label "$label")
  done < "$BACKUP_DIR/mongo_labels"
  docker volume create "${label_args[@]}" "$MONGO_VOLUME" >/dev/null
  mongo_path=$(docker volume inspect "$MONGO_VOLUME" --format '{{.Mountpoint}}')
  cp -a "$BACKUP_DIR/mongo_data/." "$mongo_path/"
fi

echo
echo "[OK] Docker con GPU listo."
echo "     Cierra y vuelve a abrir la terminal de WSL (por el grupo docker) y ejecuta: ./wsl-up.sh"
echo "     Cuando compruebes que todo funciona, puedes borrar la copia: sudo rm -rf $BACKUP_DIR"
