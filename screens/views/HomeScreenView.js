import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import styles from "../styles/HomeScreenStyle";

export default function HomeScreenView({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>🎶 EasyTunr</Text>
      <Text style={styles.subtitle}>Convierte audio y partituras a MusicXML</Text>
      <TouchableOpacity style={styles.button} onPress={() => navigation.navigate("Audio")}>
        <Text style={styles.buttonText}>🎤 Grabar o Subir Audio</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.button} onPress={() => navigation.navigate("Photo")}>
        <Text style={styles.buttonText}>📷 Escanear Partitura</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.button} onPress={() => navigation.navigate("Conversions")}>
        <Text style={styles.buttonText}>📚 Ver Conversiones</Text>
      </TouchableOpacity>
    </View>
  );
}