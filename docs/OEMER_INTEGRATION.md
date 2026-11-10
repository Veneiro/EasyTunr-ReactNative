# Conversiones a MusicXML

EasyTunr tiene dos conversiones, las dos asincronas y las dos implementadas en `server/server.py`.

## Imagen a MusicXML (oemer)

`POST /upload/photo` (multipart, campo `photo`) y despues `convert_image_to_musicxml()`:

1. Si la imagen mide mas de 2500 px por lado, se reduce (oemer va mucho mas rapido y no pierde precision util).
2. `OMRPipeline.transcribe()` (`server/omr/pipeline.py`) ejecuta el CLI `oemer` en un directorio temporal
   y mueve el `.musicxml` resultante a `uploads/conversions/{uuid}.musicxml`. Las imagenes intermedias se descartan.
3. Se guarda `uploads/conversions/{uuid}.omr.json` con metadatos (motor, imagen de origen y fecha).
4. Si oemer falla, no esta instalado o tarda mas de 300 s, se lanza `OMRError` y la tarea queda en `failed`
   con un mensaje legible.

Notas:

- La primera ejecucion de oemer descarga sus checkpoints (unos cientos de MB). Tarda, y vuelve a descargarlos
  si se reconstruye la imagen Docker.
- oemer necesita Python 3.10-3.12. En Windows nativo suele dar problemas, asi que es mejor usar Docker o WSL.
- Funciona mejor con partituras impresas, bien iluminadas y rectas.

## Audio a MusicXML (librosa pYIN)

`POST /upload/audio` (multipart, campo `audio`) y despues `convert_audio_to_musicxml()`:

1. `librosa.load` a 22050 Hz mono. Formatos comprimidos como m4a/mp3 necesitan ffmpeg, que ya viene en el Dockerfile.
2. `librosa.pyin` estima la frecuencia fundamental frame a frame (rango C2-C7).
3. Cada frame se redondea al semitono MIDI mas cercano. Los frames consecutivos iguales se agrupan en notas,
   y los fragmentos de menos de 80 ms se fusionan con la nota anterior.
4. Las duraciones se cuantizan a semicorcheas a 120 BPM y se escriben con music21.

Solo es fiable con melodias **monofonicas** (voz, silbido o un instrumento solo). Los parametros estan en las
constantes `AUDIO_*` al principio de esas funciones.

## Probar a mano

```bash
TOKEN=$(curl -s -X POST http://localhost:5000/login -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"123456"}' | python -c "import sys,json;print(json.load(sys.stdin)['token'])")

curl -X POST http://localhost:5000/upload/photo -H "Authorization: Bearer $TOKEN" -F "photo=@partitura.png"
# -> {"task_id": "...", "status": "pending"}

curl http://localhost:5000/conversion_status/<task_id> -H "Authorization: Bearer $TOKEN"
# -> {"status": "completed", "result": {"musicxml_url": "/uploads/conversions/<uuid>.musicxml"}}

curl -o resultado.musicxml http://localhost:5000/uploads/conversions/<uuid>.musicxml -H "Authorization: Bearer $TOKEN"
```

El `.musicxml` se puede abrir en MuseScore, Finale o Sibelius.

## Proximas mejoras

- [ ] Persistir el estado de las tareas (MongoDB) para poder usar varios workers
- [ ] Detectar el tempo del audio en lugar de fijar 120 BPM
- [ ] Correccion manual de notas antes de guardar
- [ ] Exportar a MIDI
