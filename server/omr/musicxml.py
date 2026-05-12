from music21 import meter, metadata, note, stream


def write_musicxml(notes, output_path, title="EasyTunr Transcription"):
    """Escribe notas en formato MusicXML.
    
    Args:
        notes: Lista de diccionarios con keys 'pitch' y 'duration'.
        output_path: Ruta donde guardar el archivo.
        title: Título de la partitura.
    """
    score = stream.Score()
    part = stream.Part()

    part.append(meter.TimeSignature("4/4"))
    for n in notes:
        pitch_name = n.get("pitch", "C4")
        duration = float(n.get("duration", 1.0))
        part.append(note.Note(pitch_name, quarterLength=max(duration, 0.25)))

    if len(part.notes) == 0:
        # MusicXML valido aunque no haya notas detectadas.
        part.append(note.Rest(quarterLength=1.0))

    score.append(part)
    score.insert(0, metadata.Metadata(title=title, composer="EasyTunr OMR"))
    score.write("musicxml", fp=output_path)
    return output_path


def write_score_to_musicxml(score_obj, output_path, title="EasyTunr Transcription"):
    """Escribe un objeto music21.stream.Score directamente a MusicXML.
    
    Args:
        score_obj: Objeto music21.stream.Score (ej. de oemer).
        output_path: Ruta donde guardar el archivo.
        title: Título (opcional, si el score ya tiene metadata se preserva).
    """
    try:
        # Si el score no tiene metadatos, añadirlos
        if not score_obj.metadata:
            score_obj.metadata = metadata.Metadata(title=title, composer="EasyTunr (oemer)")
        score_obj.write("musicxml", fp=output_path)
        return output_path
    except Exception as e:
        print(f"Error guardando score a MusicXML: {e}")
        raise


def score_to_notes(score_obj):
    """Extrae una lista de notas compatibles desde un music21.stream.Score.
    
    Args:
        score_obj: Objeto music21.stream.Score.
    
    Returns:
        Lista de dicts con format {"pitch": "C4", "duration": 1.0}.
    """
    notes_list = []
    try:
        # Flatten para iterar sobre todas las notas independiente de la estructura
        flat = score_obj.flatten()
        for n in flat.notes:
            if isinstance(n, note.Note):
                notes_list.append({
                    "pitch": n.pitch.nameWithOctave,
                    "duration": float(n.quarterLength)
                })
            elif isinstance(n, note.Rest):
                notes_list.append({
                    "pitch": "Rest",
                    "duration": float(n.quarterLength)
                })
    except Exception as e:
        print(f"Error extrayendo notas del score: {e}")
    return notes_list
