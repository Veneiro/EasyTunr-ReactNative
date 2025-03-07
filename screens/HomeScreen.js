import React from "react";
import { View, Text, Button, StyleSheet } from "react-native";

const HomeScreen = ({ navigation }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Conversor de Audio a MIDI</Text>
      <Button title="Grabar o Subir Audio" onPress={() => navigation.navigate("Audio")} />
      <Button title="Escanear Partitura" onPress={() => navigation.navigate("Photo")} />
      <Button title="Ver Conversiones" onPress={() => navigation.navigate("Conversions")} />
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

export default HomeScreen;
