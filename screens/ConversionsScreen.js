import React from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from "react-native";

const ConversionsScreen = () => {
  const conversions = []; // Asegúrate de gestionar el estado de conversiones de alguna manera

  const downloadMidiFile = (midiFile) => {
    // Lógica para descargar el archivo MIDI
    console.log("Descargar archivo MIDI:", midiFile);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Conversiones MIDI</Text>
      <FlatList
        data={conversions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => downloadMidiFile(item.midiFile)}>
            <Text style={styles.item}>{item.midiFile}</Text>
          </TouchableOpacity>
        )}
      />
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
  item: {
    fontSize: 16,
    marginVertical: 10,
    color: "blue",
  },
});

export default ConversionsScreen;
