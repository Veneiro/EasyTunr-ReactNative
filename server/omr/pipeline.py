import glob
import os
import shutil
import subprocess
import tempfile


class OMRError(RuntimeError):
    """La transcripcion OMR ha fallado."""


class OMRPipeline:
    """Convierte una imagen de partitura a MusicXML usando oemer (CLI)."""

    def __init__(self, timeout_seconds=300):
        self.timeout_seconds = timeout_seconds

    def transcribe(self, image_path, output_path):
        """Ejecuta oemer sobre `image_path` y guarda el MusicXML en `output_path`.

        oemer escribe en un directorio temporal (MusicXML + imagenes intermedias),
        asi no quedan restos en la carpeta de uploads. Lanza OMRError si falla.
        """
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"No se encuentra la imagen: {image_path}")

        with tempfile.TemporaryDirectory(prefix="oemer-") as work_dir:
            try:
                subprocess.run(
                    ["oemer", image_path, "-o", work_dir],
                    capture_output=True,
                    text=True,
                    check=True,
                    timeout=self.timeout_seconds,
                )
            except FileNotFoundError as e:
                raise OMRError("oemer no esta instalado o no esta en el PATH") from e
            except subprocess.TimeoutExpired as e:
                raise OMRError(f"oemer supero el tiempo limite ({self.timeout_seconds}s)") from e
            except subprocess.CalledProcessError as e:
                detail = (e.stderr or e.stdout or "").strip().splitlines()
                raise OMRError(f"oemer fallo: {detail[-1] if detail else e}") from e

            xml_files = glob.glob(os.path.join(work_dir, "*.musicxml"))
            if not xml_files:
                raise OMRError("oemer no genero ningun archivo .musicxml")

            shutil.move(xml_files[0], output_path)

        return {"status": "success", "engine": "oemer", "musicxml_path": output_path}
