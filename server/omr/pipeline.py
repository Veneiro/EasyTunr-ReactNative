import os
import re
from dataclasses import dataclass

import cv2
import numpy as np


@dataclass
class OMRPipelineConfig:
    engine: str = "custom-omr"
    model_weights: str | None = None
    confidence: float = 0.25
    device: str = "cpu"
    seq2seq_model_id: str | None = None
    seq2seq_max_new_tokens: int = 256
    seq2seq_num_beams: int = 2
    staff_projection_factor: float = 0.55


class OMRPipeline:
    def __init__(self, config: OMRPipelineConfig):
        self.config = config
        self.engine = (config.engine or "custom-omr").strip().lower()
        self.detector = self._load_detector(config.model_weights)
        self._seq2seq_runtime = None

    def _load_detector(self, weights_path):
        if not weights_path:
            return None
        if not os.path.exists(weights_path):
            return None
        try:
            from ultralytics import YOLO

            return YOLO(weights_path)
        except Exception:
            return None

    def transcribe(self, image_path):
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError(f"No se pudo cargar la imagen: {image_path}")

        if self.engine == "seq2seq":
            return self._transcribe_seq2seq(image)

        gray, binary = self._preprocess(image)
        symbols = self._detect_symbols(image, binary)

        if not symbols:
            symbols = self._heuristic_notehead_detection(binary)

        notes = self._symbols_to_notes(symbols, binary)

        return {
            "engine": "custom-omr",
            "model_used": bool(self.detector),
            "symbols": symbols,
            "notes": notes,
        }

    def _transcribe_seq2seq(self, image):
        runtime = self._get_seq2seq_runtime()
        if runtime is None:
            raise RuntimeError(
                "OMR_ENGINE=seq2seq requiere OMR_SEQ2SEQ_MODEL_ID y dependencias instaladas (torch, transformers, Pillow)."
            )

        _, binary = self._preprocess(image)
        staff_crops = self._split_staffs(binary)
        if not staff_crops:
            staff_crops = [cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)]

        staff_sequences = []
        notes = []
        x_cursor = 0.0

        for idx, crop in enumerate(staff_crops):
            sequence = runtime["infer"](crop)
            staff_sequences.append({"staff_index": idx, "sequence": sequence})

            staff_notes = self._sequence_to_notes(sequence, idx, x_offset=x_cursor)
            notes.extend(staff_notes)
            x_cursor += max(float(len(staff_notes)) * 40.0, 280.0)

        # Si el modelo devuelve secuencias vacias o no parseables, se mantiene una salida util.
        if not notes:
            fallback_symbols = self._heuristic_notehead_detection(binary)
            notes = self._symbols_to_notes(fallback_symbols, binary)

        return {
            "engine": "seq2seq",
            "model_used": True,
            "model_id": self.config.seq2seq_model_id,
            "staff_sequences": staff_sequences,
            "symbols": [],
            "notes": notes,
        }

    def _get_seq2seq_runtime(self):
        if self._seq2seq_runtime is not None:
            return self._seq2seq_runtime

        model_id = (self.config.seq2seq_model_id or "").strip()
        if not model_id:
            return None

        try:
            import torch
            from PIL import Image
            from transformers import (
                AutoProcessor,
                AutoTokenizer,
                VisionEncoderDecoderModel,
            )
        except Exception as exc:
            raise RuntimeError(
                "No se pudo importar runtime seq2seq. Instala torch, transformers y Pillow."
            ) from exc

        device = self.config.device if self.config.device != "cpu" else ("cuda" if torch.cuda.is_available() else "cpu")
        dtype = torch.float16 if device == "cuda" else torch.float32

        model = VisionEncoderDecoderModel.from_pretrained(model_id, torch_dtype=dtype).to(device)
        processor = AutoProcessor.from_pretrained(model_id)
        tokenizer = AutoTokenizer.from_pretrained(model_id)

        def infer(gray_crop):
            rgb = cv2.cvtColor(gray_crop, cv2.COLOR_GRAY2RGB)
            pil_img = Image.fromarray(rgb)

            with torch.no_grad():
                pixel_values = processor(images=pil_img, return_tensors="pt").pixel_values.to(device, dtype=dtype)
                generated_ids = model.generate(
                    pixel_values,
                    max_new_tokens=self.config.seq2seq_max_new_tokens,
                    num_beams=self.config.seq2seq_num_beams,
                )
            return tokenizer.batch_decode(generated_ids, skip_special_tokens=True)[0]

        self._seq2seq_runtime = {
            "device": device,
            "model_id": model_id,
            "infer": infer,
        }
        return self._seq2seq_runtime

    def _split_staffs(self, binary):
        inv = 255 - binary
        projection = inv.sum(axis=1).astype(np.float32)

        factor = max(min(float(self.config.staff_projection_factor), 0.95), 0.10)
        threshold = float(projection.mean()) * factor

        bands = []
        start = None
        min_h = max(12, int(binary.shape[0] * 0.01))
        pad = max(8, int(binary.shape[0] * 0.01))

        for y, val in enumerate(projection):
            if val > threshold and start is None:
                start = y
            elif val <= threshold and start is not None:
                if y - start >= min_h:
                    y1 = max(0, start - pad)
                    y2 = min(binary.shape[0], y + pad)
                    bands.append((y1, y2))
                start = None

        if start is not None:
            y1 = max(0, start - pad)
            y2 = binary.shape[0]
            if y2 - y1 >= min_h:
                bands.append((y1, y2))

        merged = []
        for y1, y2 in bands:
            if not merged:
                merged.append([y1, y2])
                continue
            prev = merged[-1]
            if y1 - prev[1] <= pad:
                prev[1] = max(prev[1], y2)
            else:
                merged.append([y1, y2])

        crops = [binary[y1:y2, :] for y1, y2 in merged if (y2 - y1) >= min_h]
        return crops

    def _sequence_to_notes(self, sequence, staff_idx, x_offset=0.0):
        if not sequence or not sequence.strip():
            return []

        tokens = re.split(r"\s+|\|", sequence.strip())
        duration_map = {
            "w": 4.0,
            "h": 2.0,
            "q": 1.0,
            "e": 0.5,
            "s": 0.25,
        }

        notes = []
        x = float(x_offset)

        for tok in tokens:
            token = tok.strip()
            if not token:
                continue

            # Acepta formatos como C4, D#5:q, Eb4:0.5
            match = re.match(r"^([A-Ga-g][#b]?)(\d)(?::([a-zA-Z]|\d+(?:\.\d+)?))?$", token)
            if not match:
                continue

            pitch_base = match.group(1).upper()
            octave = match.group(2)
            dur_raw = match.group(3)

            duration = 1.0
            if dur_raw:
                lower = dur_raw.lower()
                if lower in duration_map:
                    duration = duration_map[lower]
                else:
                    try:
                        duration = max(float(dur_raw), 0.25)
                    except ValueError:
                        duration = 1.0

            notes.append(
                {
                    "pitch": f"{pitch_base}{octave}",
                    "duration": float(duration),
                    "x": x,
                    "source_label": f"seq2seq_staff_{staff_idx}",
                }
            )
            x += 40.0

        return notes

    def _preprocess(self, image):
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (3, 3), 0)
        binary = cv2.adaptiveThreshold(
            gray,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            31,
            8,
        )
        return gray, binary

    def _detect_symbols(self, image, binary):
        if self.detector is None:
            return []

        detections = []
        results = self.detector.predict(
            source=image,
            conf=self.config.confidence,
            device=self.config.device,
            verbose=False,
        )

        for result in results:
            names = result.names
            for box in result.boxes:
                cls_id = int(box.cls.item())
                conf = float(box.conf.item())
                x1, y1, x2, y2 = [float(v) for v in box.xyxy[0].tolist()]
                label = str(names.get(cls_id, cls_id))
                detections.append(
                    {
                        "label": label,
                        "bbox": [x1, y1, x2, y2],
                        "confidence": conf,
                    }
                )

        return detections

    def _heuristic_notehead_detection(self, binary):
        inv = 255 - binary

        params = cv2.SimpleBlobDetector_Params()
        params.filterByArea = True
        params.minArea = 20
        params.maxArea = 2500
        params.filterByColor = True
        params.blobColor = 255
        params.filterByCircularity = False
        params.filterByInertia = False
        params.filterByConvexity = False

        detector = cv2.SimpleBlobDetector_create(params)
        keypoints = detector.detect(inv)

        symbols = []
        for kp in keypoints:
            r = max(kp.size * 0.8, 4)
            x1 = kp.pt[0] - r
            y1 = kp.pt[1] - r
            x2 = kp.pt[0] + r
            y2 = kp.pt[1] + r
            symbols.append(
                {
                    "label": "noteheadBlack",
                    "bbox": [x1, y1, x2, y2],
                    "confidence": 0.2,
                }
            )

        # Fallback adicional por contornos para casos donde blob detector no encuentra suficiente informacion.
        if len(symbols) < 4:
            line_kernel_w = max(20, int(binary.shape[1] * 0.04))
            line_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (line_kernel_w, 1))
            staff_lines = cv2.morphologyEx(inv, cv2.MORPH_OPEN, line_kernel)
            no_staff = cv2.subtract(inv, staff_lines)

            open_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
            cleaned = cv2.morphologyEx(no_staff, cv2.MORPH_OPEN, open_kernel)

            contours, _ = cv2.findContours(cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            contour_symbols = []

            for cnt in contours:
                area = cv2.contourArea(cnt)
                if area < 18 or area > 2800:
                    continue

                x, y, w, h = cv2.boundingRect(cnt)
                if w <= 0 or h <= 0:
                    continue

                ratio = w / float(h)
                if ratio < 0.45 or ratio > 2.4:
                    continue

                rect_area = float(w * h)
                extent = area / rect_area if rect_area > 0 else 0.0
                if extent < 0.35:
                    continue

                contour_symbols.append(
                    {
                        "label": "noteheadBlack",
                        "bbox": [float(x), float(y), float(x + w), float(y + h)],
                        "confidence": 0.3,
                    }
                )

            if len(contour_symbols) > len(symbols):
                symbols = contour_symbols

        symbols.sort(key=lambda s: s["bbox"][0])
        return symbols

    def _symbols_to_notes(self, symbols, binary):
        top_line, spacing = self._estimate_staff(binary)

        notes = []
        for symbol in symbols:
            label = str(symbol.get("label", "")).lower()
            if "note" not in label:
                continue

            x1, y1, x2, y2 = symbol["bbox"]
            y_center = (y1 + y2) / 2.0
            pitch = self._pitch_from_y(y_center, top_line, spacing)
            notes.append(
                {
                    "pitch": pitch,
                    "duration": 1.0,
                    "x": float((x1 + x2) / 2.0),
                    "source_label": symbol["label"],
                }
            )

        notes.sort(key=lambda n: n["x"])
        return notes

    def _estimate_staff(self, binary):
        ink = (binary < 128).astype(np.uint8)
        projection = ink.sum(axis=1).astype(np.float32)

        threshold = projection.mean() + projection.std()
        candidates = np.where(projection > threshold)[0]

        if len(candidates) == 0:
            return 100.0, 10.0

        groups = []
        current = [candidates[0]]
        for idx in candidates[1:]:
            if idx - current[-1] <= 1:
                current.append(idx)
            else:
                groups.append(current)
                current = [idx]
        groups.append(current)

        centers = [float(np.mean(g)) for g in groups]
        if len(centers) < 2:
            return centers[0], 10.0

        diffs = np.diff(centers)
        spacing = float(np.median(diffs))
        spacing = max(spacing, 6.0)
        top_line = float(min(centers))
        return top_line, spacing

    def _pitch_from_y(self, y, top_line, spacing):
        # Aproximacion para clave de sol: linea superior ~ F5.
        half_step_px = spacing / 2.0
        if half_step_px <= 0:
            half_step_px = 5.0

        step_delta = int(round((y - top_line) / half_step_px))
        return self._diatonic_shift("F5", -step_delta)

    def _diatonic_shift(self, start_pitch, step_shift):
        letter = start_pitch[0]
        octave = int(start_pitch[1])
        alphabet = ["C", "D", "E", "F", "G", "A", "B"]

        idx = alphabet.index(letter)
        absolute = idx + octave * 7 + step_shift

        if absolute < 0:
            absolute = 0

        new_octave = absolute // 7
        new_letter = alphabet[absolute % 7]
        return f"{new_letter}{new_octave}"
