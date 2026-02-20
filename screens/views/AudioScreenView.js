import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import styles from "../styles/AudioScreenStyle";

export default function AudioScreenView({
  recording,
  audioUri,
  startRecording,
  stopRecording,
  pickAudioFile,
  uploadAudio,
  loading,
}) {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>🎤 Convertir Audio a MusicXML</Text>
        <Text style={styles.subtitle}>
          Graba un audio o selecciona un archivo para convertirlo en partitura.
        </Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, recording ? styles.buttonActive : null]}
            onPress={recording ? stopRecording : startRecording}
          >
            <Text style={styles.buttonText}>
              {recording ? "⏹ Detener Grabación" : "🎙 Grabar Audio"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={pickAudioFile}>
            <Text style={styles.buttonText}>📁 Seleccionar Archivo</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[
            styles.convertButton,
            !audioUri || loading ? styles.convertButtonDisabled : null,
          ]}
          onPress={uploadAudio}
          disabled={!audioUri || loading}
        >
          <Text style={styles.convertButtonText}>🎼 Convertir a MusicXML</Text>
        </TouchableOpacity>
        {loading && (
          <ActivityIndicator size="large" color="#6C63FF" style={{ marginTop: 16 }} />
        )}
        {audioUri && (
          <View style={styles.fileInfo}>
            <Text style={styles.fileLabel}>Archivo listo:</Text>
            <Text style={styles.fileName}>{audioUri.split("/").pop()}</Text>
          </View>
        )}
      </View>
    </View>
  );
}