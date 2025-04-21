import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  Modal,
  ActivityIndicator,
} from "react-native";

const ConversionsScreen = () => {
  const [conversions, setConversions] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null); // Estado para la imagen seleccionada
  const [loadingImage, setLoadingImage] = useState(false); // Estado para mostrar un indicador de carga

  useEffect(() => {
    const fetchConversions = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await fetch("http://localhost:5000/sheets", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setConversions(data.sheets);
        } else {
          Alert.alert("Error", "No se pudieron cargar las conversiones.");
        }
      } catch (error) {
        console.error("Error al obtener las conversiones:", error);
        Alert.alert("Error", "Hubo un problema al conectar con el servidor.");
      }
    };

    fetchConversions();
  }, []);

  const handleImagePress = useCallback((imageUrl) => {
    console.log("Selected image URL:", imageUrl); // Depuración
    setSelectedImage(imageUrl);
    setLoadingImage(true); // Mostrar el spinner mientras se carga la imagen
  }, []);

  const closeModal = () => {
    setSelectedImage(null);
    setLoadingImage(false); // Asegurarse de que el spinner desaparezca al cerrar el modal
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <TouchableOpacity
        onPress={() =>
          handleImagePress(
            `http://localhost:5000/uploads/sheets/${item.filename}`
          )
        }
      >
        <Image
          source={{
            uri: `http://localhost:5000/uploads/sheets/${item.filename}`,
          }}
          style={styles.image}
          onError={(error) =>
            console.error("Error al cargar la imagen:", error.nativeEvent.error)
          }
        />
      </TouchableOpacity>
      <Text style={styles.cardTitle}>{item.filename}</Text>
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.button}
          onPress={() =>
            downloadFile(item.filename.replace(".jpg", ".omr"), "OMR")
          }
        >
          <Text style={styles.buttonText}>Descargar OMR</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.button}
          onPress={() =>
            downloadFile(item.filename.replace(".jpg", ".mxl"), "MXL")
          }
        >
          <Text style={styles.buttonText}>Descargar MXL</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const downloadFile = async (filename, type) => {
    try {
      const response = await fetch(
        `http://localhost:5000/uploads/conversions/${filename}`
      );
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        Alert.alert("Error", `No se pudo descargar el archivo ${type}.`);
      }
    } catch (error) {
      console.error(`Error al descargar el archivo ${type}:`, error);
      Alert.alert("Error", `Hubo un problema al descargar el archivo ${type}.`);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Partituras Convertidas</Text>
      <FlatList
        data={conversions}
        keyExtractor={(item, index) => index.toString()}
        renderItem={renderItem}
        numColumns={2} // Mostrar tarjetas en dos columnas
        columnWrapperStyle={styles.row} // Estilo para las filas
        ListEmptyComponent={
          <Text style={styles.emptyText}>No hay partituras convertidas.</Text>
        }
      />

      {/* Modal para mostrar la imagen ampliada */}
      <Modal visible={!!selectedImage} transparent={true} animationType="fade">
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.modalBackground}
            onPress={closeModal}
            activeOpacity={1}
          >
            {selectedImage && (
              <>
                <Image
                  source={{ uri: selectedImage }}
                  style={styles.modalImage}
                  onLoadStart={() => {
                    console.log("Imagen comenzando a cargar");
                    setLoadingImage(true);
                  }}
                  onLoadEnd={() => {
                    console.log("Imagen cargada completamente");
                    setLoadingImage(false);
                  }}
                  onError={(error) => {
                    console.error(
                      "Error al cargar la imagen en el modal:",
                      error.nativeEvent.error
                    );
                    Alert.alert(
                      "Error",
                      "No se pudo cargar la imagen ampliada."
                    );
                    setLoadingImage(false);
                    setSelectedImage(null);
                  }}
                />
                {loadingImage && (
                  <ActivityIndicator
                    size="large"
                    color="#fff"
                    style={styles.activityIndicator}
                  />
                )}
              </>
            )}
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  row: {
    justifyContent: "space-between",
  },
  card: {
    flex: 1,
    backgroundColor: "#f9f9f9",
    borderRadius: 10,
    padding: 10,
    margin: 5,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  image: {
    width: 100,
    height: 100,
    borderRadius: 5,
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  button: {
    backgroundColor: "#6200ee",
    padding: 10,
    borderRadius: 5,
    marginHorizontal: 5,
    flex: 1,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 12,
    textAlign: "center",
  },
  emptyText: {
    textAlign: "center",
    fontSize: 16,
    color: "#888",
    marginTop: 20,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBackground: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalImage: {
    width: "90%",
    height: "90%",
    resizeMode: "contain",
  },
  activityIndicator: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: [{ translateX: -20 }, { translateY: -20 }],
  },
});

export default ConversionsScreen;
