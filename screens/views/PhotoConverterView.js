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
  uploading,
  pickImage,
  takePhoto,
  uploadImage,
  fileInputRef,
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
              <Text style={{ color: theme.colors.text, marginTop: 10 }}>Subiendo imagen...</Text>
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
                  <Text style={styles.buttonText}>📁 Seleccionar Archivo</Text>
                </TouchableOpacity>
                {Platform.OS !== "web" && (
                  <TouchableOpacity style={styles.button} onPress={takePhoto}>
                    <Text style={styles.buttonText}>📷 Tomar Foto</Text>
                  </TouchableOpacity>
                )}
              </View>
              {Platform.OS === "web" && (
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  style={{ display: "none" }}
                  onChange={onFileChange}
                />
              )}
              {image && <Image source={{ uri: image }} style={styles.image} />}
              {image && (
                <TouchableOpacity
                  style={[styles.button, { marginTop: 20, width: "100%", maxWidth: 360 }]}
                  onPress={uploadImage}
                >
                  <Text style={styles.buttonText}>Subir Imagen</Text>
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