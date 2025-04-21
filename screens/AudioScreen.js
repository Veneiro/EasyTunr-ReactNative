import React, { useState } from "react";
import { View, Text, Button, StyleSheet, Alert, Platform } from "react-native";
import { Audio } from "expo-av";
import * as DocumentPicker from "expo-document-picker";

const AudioScreen = ({ navigation }) => {
  const [recording, setRecording] = useState(null);
  const [audioUri, setAudioUri] = useState(null);
  const [audioType, setAudioType] = useState("audio/m4a"); // default para grabaciones

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permiso denegado", "Se necesita acceso al micrófono.");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY
      );

      setRecording(recording);
    } catch (error) {
      console.error("Error al iniciar grabación", error);
      Alert.alert("Error", "No se pudo iniciar la grabación.");
    }
  };

  const stopRecording = async () => {
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setAudioUri(uri);
      setAudioType("audio/m4a"); // o ajusta a "audio/x-m4a" si lo requiere el backend
      setRecording(null);
    } catch (error) {
      console.error("Error al detener grabación", error);
      Alert.alert("Error", "No se pudo detener la grabación.");
    }
  };

  const pickAudioFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "audio/*" });
      if (result.type === "success") {
        setAudioUri(result.uri);
        // Deducimos el tipo MIME básico (puedes mejorarlo si lo necesitas)
        const ext = result.name.split('.').pop().toLowerCase();
        const mimeType = ext === 'mp3' ? 'audio/mpeg' :
                         ext === 'wav' ? 'audio/wav' :
                         ext === 'm4a' ? 'audio/m4a' :
                         'audio/*';
        setAudioType(mimeType);
      }
    } catch (error) {
      console.error("Error al seleccionar archivo", error);
      Alert.alert("Error", "No se pudo seleccionar el archivo.");
    }
  };

  const convertToMusicXml = async () => {
    if (!audioUri) {
      Alert.alert("Error", "No hay archivo grabado ni seleccionado.");
      return;
    }

    try {
      const formData = new FormData();
      const filename = audioUri.split("/").pop();

      formData.append("audio", {
        uri: audioUri,
        name: filename,
        type: audioType,
      });

      const response = await fetch("http://localhost:5000/upload", {
        method: "POST",
        body: formData,
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      const data = await response.json();
      if (response.ok) {
        Alert.alert("Éxito", "El archivo se convirtió a MusicXML.");
        navigation.navigate("Conversions");
      } else {
        console.error("Fallo en conversión:", data);
        Alert.alert("Error", data.error || "Conversión fallida.");
      }
    } catch (error) {
      console.error("Error en la conversión", error);
      Alert.alert("Error", "No se pudo enviar el archivo.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Grabación o Carga de Audio</Text>
      <Button
        title={recording ? "Detener Grabación" : "Iniciar Grabación"}
        onPress={recording ? stopRecording : startRecording}
      />
      <Button title="Seleccionar Archivo de Audio" onPress={pickAudioFile} />
      <Button title="Convertir a MusicXML" onPress={convertToMusicXml} disabled={!audioUri} />
      {audioUri && <Text>Archivo listo: {audioUri.split("/").pop()}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
  },
});

export default AudioScreen;
