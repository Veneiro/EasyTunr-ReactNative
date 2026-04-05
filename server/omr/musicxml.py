from music21 import meter, metadata, note, stream


def write_musicxml(notes, output_path, title="EasyTunr Transcription"):
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
