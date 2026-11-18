import os
import shutil
import subprocess
import tempfile
import threading
from dataclasses import dataclass, field


def _env_bool(name, default):
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass
class OMRPipelineConfig:
    """Configuración del motor Clarity-OMR (https://github.com/clquwu/Clarity-OMR)."""

    repo_path: str = field(default_factory=lambda: os.getenv("OMR_CLARITY_REPO_PATH", "/app/clarity"))
    python: str = field(default_factory=lambda: os.getenv("OMR_CLARITY_PYTHON", "python"))
    # cpu, cuda o auto (cuda si torch detecta una GPU).
    device: str = field(default_factory=lambda: os.getenv("OMR_DEVICE", "auto"))
    # --fast usa beam 2 en lugar de 5: bastante más rápido en CPU con algo menos de precisión.
    fast: bool = field(default_factory=lambda: _env_bool("OMR_CLARITY_FAST", True))
    timeout_seconds: int = field(default_factory=lambda: int(os.getenv("OMR_TIMEOUT_SECONDS", "1200")))


class OMRPipeline:
    """Transcribe una imagen de partitura a MusicXML con el modelo Clarity-OMR.

    Clarity detecta cada pentagrama con YOLO (stage A), lo transcribe con un
    encoder DaViT + decoder (stage B) y ensambla el resultado en MusicXML.
    """

    # El modelo ocupa ~1 GB en memoria: procesamos una partitura cada vez.
    _lock = threading.Semaphore(1)

    def __init__(self, config=None):
        self.config = config or OMRPipelineConfig()
        self._resolved_device = None

    def _device(self):
        if self._resolved_device:
            return self._resolved_device
        device = (self.config.device or "auto").strip().lower()
        if device == "auto":
            # Se consulta en un subproceso para no cargar torch en el servidor web.
            try:
                probe = subprocess.run(
                    [self.config.python, "-c", "import torch; print(torch.cuda.is_available())"],
                    capture_output=True,
                    text=True,
                    timeout=120,
                )
                device = "cuda" if probe.stdout.strip() == "True" else "cpu"
            except Exception:
                device = "cpu"
        print(f"Clarity-OMR usará el dispositivo: {device}", flush=True)
        self._resolved_device = device
        return device

    def transcribe(self, image_path):
        if not os.path.exists(image_path):
            return {"status": "error", "error": f"No se encuentra la imagen: {image_path}"}

        entrypoint = os.path.join(self.config.repo_path, "omr.py")
        if not os.path.isfile(entrypoint):
            return {
                "status": "error",
                "error": f"No se encuentra Clarity-OMR en {self.config.repo_path} (falta omr.py).",
            }

        output_folder = os.path.dirname(image_path)
        filename_no_ext = os.path.splitext(os.path.basename(image_path))[0]
        musicxml_path = os.path.join(output_folder, f"{filename_no_ext}.musicxml")

        device = self._device()
        command = [self.config.python, entrypoint, image_path, "-o", musicxml_path, "--device", device]
        # Clarity solo admite --fast en CPU.
        if self.config.fast and device == "cpu":
            command.append("--fast")

        env = os.environ.copy()
        # El checkpoint ya incluye el backbone completo: no descargar pesos de ImageNet.
        env.setdefault("OMR_DISABLE_BACKBONE_PRETRAINED", "1")

        work_dir = tempfile.mkdtemp(prefix="clarity-")
        command += ["--work-dir", work_dir]
        try:
            with self._lock:
                print(f"Ejecutando Clarity-OMR para: {image_path}", flush=True)
                result = subprocess.run(
                    command,
                    cwd=self.config.repo_path,
                    env=env,
                    capture_output=True,
                    text=True,
                    timeout=self.config.timeout_seconds,
                )
        except subprocess.TimeoutExpired:
            return {
                "status": "error",
                "error": f"Clarity-OMR superó el tiempo máximo ({self.config.timeout_seconds}s).",
            }
        finally:
            shutil.rmtree(work_dir, ignore_errors=True)

        stderr_tail = (result.stderr or "")[-4000:]
        if result.returncode != 0:
            return {
                "status": "error",
                "error": _summarize_error(stderr_tail) or f"Clarity-OMR terminó con código {result.returncode}",
                "stderr": stderr_tail,
            }

        if not os.path.isfile(musicxml_path):
            return {
                "status": "error",
                "error": "Clarity-OMR no generó el archivo MusicXML.",
                "stderr": stderr_tail,
            }

        return {
            "status": "success",
            "engine": "clarity-omr",
            "musicxml_path": musicxml_path,
            "filename": os.path.basename(musicxml_path),
        }


def _summarize_error(stderr):
    # La última línea no vacía del traceback suele ser el mensaje útil.
    lines = [line.strip() for line in stderr.splitlines() if line.strip()]
    if not lines:
        return ""
    last = lines[-1]
    if "No staff crops were detected" in last:
        return "No se detectaron pentagramas en la imagen. Prueba con una foto más nítida y recta."
    return last
