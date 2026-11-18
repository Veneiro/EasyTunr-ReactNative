# syntax=docker/dockerfile:1.7
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_DEFAULT_TIMEOUT=120

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ffmpeg \
        libglib2.0-0 \
        libgl1 \
        libsm6 \
        libsndfile1 \
        libxext6 \
        libxrender1 \
        build-essential \
    && rm -rf /var/lib/apt/lists/*

# Índice de PyTorch: cu126 (GPU NVIDIA, también funciona en CPU) o cpu (imagen ~5 GB más ligera).
ARG TORCH_INDEX=cu126

COPY requirements.txt ./
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --upgrade pip \
    && pip install --index-url https://download.pytorch.org/whl/${TORCH_INDEX} torch torchvision \
    && pip install --prefer-binary -r requirements.txt

COPY . .

EXPOSE 5000

CMD ["gunicorn", "-b", "0.0.0.0:5000", "server:app", "--workers", "1", "--threads", "4", "--timeout", "180", "--access-logfile", "-", "--error-logfile", "-", "--log-level", "info"]
