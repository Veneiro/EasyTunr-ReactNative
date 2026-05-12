import React, { useState } from "react";
import { Audio } from "expo-av";
import * as DocumentPicker from "expo-document-picker";
import AudioScreenView from "../views/AudioScreenView";
import { Alert } from "react-native";
import { apiUrl } from "../../lib/api";
import { clearAuthSession, getValidAccessToken } from "../../lib/authSession";

const AudioScreen = ({ navigation }) => {
  const [recording, setRecording] = useState(null);
  const [audioUri, setAudioUri] = useState(null);
  const [audioType, setAudioType] = useState("audio/m4a");
  const [loading, setLoading] = useState(false);

  const startRecording = async () => {
    try {
      const { status, canAskAgain } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permiso denegado",
          "No se otorgaron permisos de micrófono. Por favor, verifica los ajustes del dispositivo.",
          [{ text: "OK" }]
        );
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        allowsRecordingAndroid: true,
      });
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync({
        android: {
          extension: ".mp3",
          outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
          audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
        ios: {
          extension: ".mp3",
          outputFormat: Audio.RECORDING_OPTION_IOS_OUTPUT_FORMAT_MPEG4AAC,
          audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_MAX,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
      });
      await recording.startAsync();
      setRecording(recording);
    } catch (error) {
      Alert.alert("Error", `No se pudo iniciar la grabación: ${error.message}`);
    }
  };

  const stopRecording = async () => {
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setAudioUri(uri);
      setAudioType("audio/m4a");
      setRecording(null);
    } catch (error) {
      Alert.alert("Error", "No se pudo detener la grabación.");
    }
  };

  const pickAudioFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "audio/*" });
      if (!result.canceled) {
        setAudioUri(result.assets[0].uri);
        const ext = result.assets[0].name.split(".").pop().toLowerCase();
        const mimeType =
          ext === "mp3"
            ? "audio/mpeg"
            : ext === "wav"
            ? "audio/wav"
            : ext === "m4a"
            ? "audio/m4a"
            : "audio/*";
        setAudioType(mimeType);
      }
    } catch (error) {
      Alert.alert("Error", "No se pudo seleccionar el archivo.");
    }
  };

  const uploadAudio = async () => {
    if (!audioUri) {
      Alert.alert("Error", "No hay archivo grabado ni seleccionado.");
      return;
    }
    setLoading(true);
    try {
      const token = await getValidAccessToken();
      if (!token) {
        Alert.alert("Error", "No se encontró un token de autenticación.");
        setLoading(false);
        return;
      }
      const filename =
        audioUri
          .split("/")
          .pop()
          .replace(/[^a-zA-Z0-9.-]/g, "_") || `audio-${Date.now()}.mp3`;
      const fileType = audioType || "audio/mp3";
      const file = await fetch(
        //Platform.OS === "ios" ? audioUri.replace("file://", "") : 
        audioUri
      );
      const blob = await file.blob();
      const formData = new FormData();
      formData.append("audio", blob, filename);
      const response = await fetch(apiUrl("/upload/audio"), {
        method: "POST",
        body: formData,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        await clearAuthSession();
        navigation.reset({ index: 0, routes: [{ name: "Login" }] });
        setLoading(false);
        return;
      }

      const result = await response.json();
      if (response.ok && result.success) {
        Alert.alert("Éxito", "El audio se ha convertido a MusicXML.");
        navigation.navigate("Conversions");
      } else {
        Alert.alert("Error", result.error || "Conversión fallida.");
      }
    } catch (error) {
      Alert.alert("Error", `No se pudo enviar el archivo: ${error.message}`);
    }
    setLoading(false);
  };

  const convertToMusicXml = async () => {
    await uploadAudio(audioUri);
  };

  return (
    <AudioScreenView
      recording={recording}
      audioUri={audioUri}
      startRecording={startRecording}
      stopRecording={stopRecording}
      pickAudioFile={pickAudioFile}
      convertToMusicXml={convertToMusicXml}
      loading={loading}
      uploadAudio={uploadAudio}
    />
  );
};

export default AudioScreen;
