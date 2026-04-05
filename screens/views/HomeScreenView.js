import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import styles from "../styles/HomeScreenStyle";
import GradientBackground from "../components/GradientBackground";
import AnimatedEntrance from "../components/AnimatedEntrance";

export default function HomeScreenView({ navigation }) {
  return (
    <GradientBackground>
      <View style={styles.container}>
        <AnimatedEntrance delay={40}>
          <View style={styles.panel}>
          <Text style={styles.title}>🎶 EasyTunr</Text>
          <Text style={styles.subtitle}>Convierte audio y partituras a MusicXML</Text>
          <AnimatedEntrance delay={120}>
            <TouchableOpacity style={styles.button} onPress={() => navigation.navigate("Audio")}>
              <Text style={styles.buttonText}>🎤 Grabar o Subir Audio</Text>
            </TouchableOpacity>
          </AnimatedEntrance>
          <AnimatedEntrance delay={180}>
            <TouchableOpacity style={styles.button} onPress={() => navigation.navigate("Photo")}>
              <Text style={styles.buttonText}>📷 Escanear Partitura</Text>
            </TouchableOpacity>
          </AnimatedEntrance>
          <AnimatedEntrance delay={240}>
            <TouchableOpacity style={styles.button} onPress={() => navigation.navigate("Conversions")}>
              <Text style={styles.buttonText}>📚 Ver Conversiones</Text>
            </TouchableOpacity>
          </AnimatedEntrance>
          </View>
        </AnimatedEntrance>
      </View>
    </GradientBackground>
  );
}