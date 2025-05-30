import React, { useState } from "react";
import { View, Text, Button, StyleSheet, Alert, Platform } from "react-native";
import { Audio } from "expo-av";
import * as DocumentPicker from "expo-document-picker";
import AsyncStorage from '@react-native-async-storage/async-storage';

const AudioScreen = ({ navigation }) => {
  const [recording, setRecording] = useState(null);
  const [audioUri, setAudioUri] = useState(null);
  const [audioType, setAudioType] = useState("audio/m4a");

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
      setAudioType("audio/m4a");
      setRecording(null);
      console.log("Archivo grabado en:", uri);
    } catch (error) {
      console.error("Error al detener grabación", error);
      Alert.alert("Error", "No se pudo detener la grabación.");
    }
  };

  const pickAudioFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "audio/*" });
      if (!result.canceled) {
        console.log("Archivo seleccionado:", result);
        setAudioUri(result.assets[0].uri);
        const ext = result.assets[0].name.split('.').pop().toLowerCase();
        const mimeType =
          ext === 'mp3' ? 'audio/mpeg' :
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

  const uploadAudio = async (uri) => {
    if (!uri) {
      Alert.alert("Error", "No hay archivo grabado ni seleccionado.");
      return;
    }

    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Error", "No se encontró un token de autenticación.");
        return;
      }

      // Obtener el archivo desde la URI
      const filename = uri.split("/").pop().replace(/[^a-zA-Z0-9.-]/g, "_") || `audio-${Date.now()}.m4a`;
      const fileType = audioType || "audio/m4a";

      // Convertir la URI a Blob
      const file = await fetch(Platform.OS === "ios" ? uri.replace("file://", "") : uri);
      const blob = await file.blob();

      // Crear FormData
      const formData = new FormData();
      formData.append("audio", blob, filename);
      console.log("FormData preparado:", { uri, name: filename, type: fileType });

      // Hacer la solicitud POST
      const response = await fetch("http://localhost:5000/upload/audio", { // Reemplazar con la IP de tu servidor
        method: "POST",
        body: formData,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();
      console.log("Respuesta del servidor:", { status: response.status, result });

      if (response.ok) {
        Alert.alert("Éxito", "El archivo se convirtió a MusicXML.");
        navigation.navigate("Conversions");
      } else {
        console.error("Fallo en conversión:", result);
        Alert.alert("Error", result.error || "Conversión fallida.");
      }
    } catch (error) {
      console.error("Error en la conversión:", error);
      Alert.alert("Error", `No se pudo enviar el archivo: ${error.message}`);
    }
  };

  const convertToMusicXml = async () => {
    await uploadAudio(audioUri);
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