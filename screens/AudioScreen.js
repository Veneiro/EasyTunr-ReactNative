import React, { useState } from "react";
import { View, Text, Button, StyleSheet, Alert } from "react-native";
import { Audio } from "expo-av";
import * as DocumentPicker from "expo-document-picker";

const AudioScreen = ({ navigation }) => {
  const [recording, setRecording] = useState(null);
  const [audioUri, setAudioUri] = useState(null);

  // Iniciar grabación
  const startRecording = async () => {
    try {
      await Audio.requestPermissionsAsync();
      const { recording } = await Audio.Recording.createAsync(
        Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY
      );
      setRecording(recording);
    } catch (error) {
      console.error("Error al grabar", error);
    }
  };

  // Detener grabación
  const stopRecording = async () => {
    if (!recording) return;
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    setAudioUri(uri); // Aquí guardamos la URI del archivo grabado
    setRecording(null);
  };

  // Seleccionar un archivo de audio
  const pickAudioFile = async () => {
    let result = await DocumentPicker.getDocumentAsync({ type: "audio/*" });
    if (result.type === "success") {
      setAudioUri(result.uri); // Almacena la URI del archivo seleccionado
    }
  };

  // Convertir el archivo (ya sea grabado o seleccionado) a MIDI
  const convertToMidi = async () => {
    if (audioUri) {
      console.log("Audio URI antes de enviar:", audioUri);
  
      try {
        const formData = new FormData();
        
        // Verifica si el URI es válido
        const audioUriParts = audioUri.split("/");
        const audioFileName = audioUriParts[audioUriParts.length - 1];
  
        // Crea un objeto que represente el archivo con la URI
        formData.append("audio", {
          uri: audioUri,
          name: audioFileName,   // Esto debe coincidir con el nombre del archivo
          type: "audio/wav",     // Asegúrate de usar el tipo correcto
        });
  
        // Realiza la solicitud POST al backend
        const response = await fetch("http://localhost:5000/convert", {
          method: "POST",
          body: formData,
          headers: {
            'Content-Type': 'multipart/form-data',  // Asegúrate de que el tipo de contenido sea el correcto
          },
        });
  
        if (response.ok) {
          const data = await response.json();
          console.log("Respuesta del servidor:", data);
  
          if (data && data.midi_file) {
            Alert.alert("Conversión exitosa", "Archivo MIDI disponible");
            navigation.navigate("Conversions", { midiFileUrl: data.midi_file });
          } else {
            Alert.alert("Error", "La conversión falló, intenta nuevamente.");
          }
        } else {
          const errorData = await response.json();
          console.log("Error al convertir:", errorData);
          Alert.alert("Error", "Hubo un problema con la conversión.");
        }
      } catch (error) {
        console.error("Error al realizar la conversión:", error);
        Alert.alert("Error", "Hubo un problema con la conversión.");
      }
    }
  };
  

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Grabación o Carga de Audio</Text>
      <Button title={recording ? "Detener Grabación" : "Iniciar Grabación"} onPress={recording ? stopRecording : startRecording} />
      <Button title="Seleccionar Archivo de Audio" onPress={pickAudioFile} />
      <Button title="Convertir a MIDI" onPress={convertToMidi} disabled={!audioUri} />
      {audioUri && <Text>Archivo seleccionado o grabado: {audioUri}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
  },
});

export default AudioScreen;
