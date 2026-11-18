import React from "react";
import { View, Text, TextInput, TouchableOpacity, Image, ActivityIndicator, Platform } from "react-native";
import styles from "../styles/PhotoConverterStyle";
import GradientBackground from "../components/GradientBackground";
import { theme } from "../styles/theme";
import AnimatedEntrance from "../components/AnimatedEntrance";

export default function PhotoConverterView({
  image,
  name,
  setName,
  isPdf,
  uploading,
  uploadPhase,
  elapsedSeconds,
  pickImage,
  pickPdf,
  takePhoto,
  uploadImage,
  fileInputRef,
  cameraInputRef,
  onFileChange,
  webFile,
}) {
  return (
    <GradientBackground>
      <View style={styles.container}>
        <AnimatedEntrance delay={60}>
          <View style={styles.panel}>
          <Text style={styles.title}>📷 Escanear Partitura</Text>
          {uploading ? (
            <>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.uploadStatusTitle}>Procesando tu partitura</Text>
              <Text style={styles.uploadStatusText}>{uploadPhase || "Trabajando..."}</Text>
              <Text style={styles.uploadElapsedText}>Tiempo transcurrido: {elapsedSeconds}s</Text>
              {elapsedSeconds >= 45 && (
                <Text style={styles.uploadHintText}>
                  Primeras ejecuciones pueden tardar por descarga/carga de modelos.
                </Text>
              )}
            </>
          ) : (
            <>
              <TextInput
                style={styles.input}
                placeholder="Nombre de la partitura (opcional)"
                value={name}
                onChangeText={setName}
              />
              <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.button} onPress={pickImage}>
                  <Text style={styles.buttonText}>🖼️ Seleccionar Imagen</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.button} onPress={takePhoto}>
                  <Text style={styles.buttonText}>📷 Tomar Foto</Text>
                </TouchableOpacity>
                {Platform.OS !== "web" && (
                  <TouchableOpacity style={styles.button} onPress={pickPdf}>
                    <Text style={styles.buttonText}>📄 Seleccionar PDF</Text>
                  </TouchableOpacity>
                )}
              </View>
              {Platform.OS === "web" && (
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  ref={fileInputRef}
                  style={{ display: "none" }}
                  onChange={onFileChange}
                />
              )}
              {Platform.OS === "web" && (
                // En navegadores móviles, capture abre directamente la cámara trasera.
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  ref={cameraInputRef}
                  style={{ display: "none" }}
                  onChange={onFileChange}
                />
              )}
              {!image && (
                <Text style={styles.uploadHintText}>
                  Consejo: fotografía la partitura de frente, bien iluminada y sin sombras, con todo el ancho de los pentagramas visible.
                </Text>
              )}
              {image && !isPdf && <Image source={{ uri: image }} style={styles.image} />}
              {image && isPdf && (
                <View style={styles.pdfPlaceholder}>
                  <Text style={styles.pdfPlaceholderIcon}>📄</Text>
                  <Text style={styles.pdfPlaceholderText}>{image}</Text>
                </View>
              )}
              {image && (
                <TouchableOpacity
                  style={[styles.button, { marginTop: 20, width: "100%", maxWidth: 360 }]}
                  onPress={uploadImage}
                >
                  <Text style={styles.buttonText}>{isPdf ? "Subir PDF" : "Subir Imagen"}</Text>
                </TouchableOpacity>
              )}
            </>
          )}
          </View>
        </AnimatedEntrance>
      </View>
    </GradientBackground>
  );
}