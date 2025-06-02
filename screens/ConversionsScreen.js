import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ConversionsScreen = () => {
  const [conversions, setConversions] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [loadingImage, setLoadingImage] = useState(false);
  const [token, setToken] = useState(null);
  const isImageLoaded = useRef(false);

  useEffect(() => {
    const fetchConversions = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('token');
        console.log('Token for fetchConversions:', storedToken); // Depuración
        setToken(storedToken);
        if (!storedToken) {
          Alert.alert('Error', 'No se encontró el token de autenticación.');
          return;
        }
        const response = await fetch('http://localhost:5000/sheets', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${storedToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          console.log('Conversions data:', data); // Depuración
          setConversions(data.sheets || []);
        } else {
          Alert.alert('Error', 'No se pudieron cargar las conversiones.');
        }
      } catch (error) {
        console.error('Error al obtener las conversiones:', error);
        Alert.alert('Error', 'Hubo un problema al conectar con el servidor.');
      }
    };

    fetchConversions();
  }, []);

  const handleImagePress = useCallback((imageUrl) => {
    console.log('Opening image:', imageUrl); // Depuración
    setSelectedImage(imageUrl);
    setLoadingImage(true);
    isImageLoaded.current = false;
  }, []);

  const closeModal = useCallback(() => {
    console.log('Closing modal'); // Depuración
    setSelectedImage(null);
    setLoadingImage(false);
    isImageLoaded.current = false;
  }, []);

  const imageSource = useMemo(() => {
    if (!selectedImage || !token) return null;
    return {
      uri: selectedImage,
      headers: { Authorization: `Bearer ${token}` },
    };
  }, [selectedImage, token]);

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <TouchableOpacity
        onPress={() =>
          handleImagePress(`http://localhost:5000/uploads/sheets/${item.filename}`)
        }
      >
        <Image
          source={{
            uri: `http://localhost:5000/uploads/sheets/${item.filename}`,
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }}
          style={styles.image}
          onError={(error) => {
            console.error(
              `Error al cargar la imagen en FlatList: ${item.filename}`,
              error.nativeEvent.error
            );
          }}
          onLoad={() => console.log(`Imagen cargada en FlatList: ${item.filename}`)}
        />
      </TouchableOpacity>
      <Text style={styles.cardTitle}>{item.filename}</Text>
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.button}
          onPress={() =>
            downloadFile(item.filename.replace('.jpg', '.omr'), 'OMR')
          }
        >
          <Text style={styles.buttonText}>Descargar OMR</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.button}
          onPress={() =>
            downloadFile(item.filename.replace('.jpg', '.mxl'), 'MXL')
          }
        >
          <Text style={styles.buttonText}>Descargar MXL</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const downloadFile = async (filename, type) => {
    try {
      const storedToken = await AsyncStorage.getItem('token');
      const response = await fetch(
        `http://localhost:5000/uploads/conversions/${filename}`,
        {
          headers: {
            Authorization: `Bearer ${storedToken}`,
          },
        }
      );
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        Alert.alert('Error', `No se pudo descargar el archivo ${type}.`);
      }
    } catch (error) {
      console.error(`Error al descargar el archivo ${type}:`, error);
      Alert.alert('Error', `Hubo un problema al descargar el archivo ${type}.`);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Partituras Convertidas</Text>
      <FlatList
        data={conversions}
        keyExtractor={(item, index) => item.filename + index}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={styles.row}
        initialNumToRender={4}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No hay partituras convertidas.</Text>
        }
      />
      <Modal visible={!!selectedImage} transparent={true} animationType="fade">
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.modalBackground}
            onPress={closeModal}
            activeOpacity={1}
          >
            {imageSource && (
              <Image
                source={imageSource}
                style={styles.modalImage}
                onLoadStart={() => {
                  console.log('Image loading started'); // Depuración
                  if (!isImageLoaded.current) {
                    setLoadingImage(true);
                  }
                }}
                onLoadEnd={() => {
                  console.log('Image loaded successfully'); // Depuración
                  isImageLoaded.current = true;
                  setLoadingImage(false);
                }}
                onError={(error) => {
                  console.error('Error loading modal image:', error.nativeEvent.error);
                  Alert.alert('Error', 'No se pudo cargar la imagen ampliada.');
                  isImageLoaded.current = false;
                  setLoadingImage(false);
                  closeModal();
                }}
              />
            )}
            {loadingImage && !isImageLoaded.current && (
              <ActivityIndicator
                size="large"
                color="#fff"
                style={styles.activityIndicator}
              />
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
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  row: {
    justifyContent: 'space-between',
  },
  card: {
    flex: 1,
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 10,
    margin: 5,
    alignItems: 'center',
    shadowColor: '#000',
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
    opacity: 1,
    position: 'relative',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  button: {
    backgroundColor: '#6200ee',
    padding: 10,
    borderRadius: 5,
    marginHorizontal: 5,
    flex: 1,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#888',
    marginTop: 20,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width: '90%',
    height: '90%',
    resizeMode: 'contain',
    opacity: 1,
    position: 'relative',
  },
  activityIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -20 }, { translateY: -20 }],
  },
});

export default ConversionsScreen;