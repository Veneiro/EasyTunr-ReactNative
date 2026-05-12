import os
import subprocess
import glob
from dataclasses import dataclass

@dataclass
class OMRPipelineConfig:
    oemer_enabled: bool = True

class OMRPipeline:
    def transcribe(self, image_path):
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"No se encuentra la imagen: {image_path}")

        # Definimos la carpeta de salida (siempre la carpeta uploads)
        output_folder = os.path.dirname(image_path)
        # Nombre base del archivo sin extensión
        filename_no_ext = os.path.splitext(os.path.basename(image_path))[0]
        
        try:
            print(f"Ejecutando oemer para: {image_path}")
            # Ejecutamos oemer. El parámetro -o indica el directorio de salida.
            result = subprocess.run(
                ["oemer", image_path, "-o", output_folder],
                capture_output=True,
                text=True,
                check=True,
                timeout=300
            )
            
            # Oemer genera un archivo llamado '{nombre_imagen}.musicxml'
            # Lo buscamos específicamente en la carpeta de salida
            expected_xml = os.path.join(output_folder, f"{filename_no_ext}.musicxml")
            
            if not os.path.exists(expected_xml):
                # Si no lo encuentra con el nombre exacto, busca cualquier .musicxml nuevo
                xml_files = glob.glob(os.path.join(output_folder, f"{filename_no_ext}*.musicxml"))
                if xml_files:
                    expected_xml = xml_files[0]
                else:
                    return {"status": "error", "error": "Oemer no generó el archivo .musicxml"}

            return {
                "status": "success",
                "musicxml_path": expected_xml,
                "filename": os.path.basename(expected_xml)
            }

        except Exception as e:
            return {"status": "error", "error": str(e)}