import React, { useState, useEffect, useCallback, useMemo } from "react";
import AsyncStorage from '@react-native-async-storage/async-storage';
import ConversionsScreenView from "../views/ConversionsScreenView";

const ConversionsScreen = () => {
  const [conversions, setConversions] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [loadingImage, setLoadingImage] = useState(false);

  useEffect(() => {
    const fetchConversions = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        const response = await fetch("http://192.168.1.13:5000/sheets", {
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

  const handleImagePress = useCallback(
    (imageUrl) => {
      setSelectedImage(imageUrl);
      setLoadingImage(true);
    },
    []
  );

  const closeModal = () => {
    setSelectedImage(null);
    setLoadingImage(false);
  };

  const downloadFile = async (filename, type) => {
    try {
      const token = await AsyncStorage.getItem("token");
      const response = await fetch(
        `http://192.168.1.13:5000/uploads/conversions/${filename}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;

        const item = conversions.find(
          (c) => c.omr === filename || c.musicxml === filename
        );
        let downloadName = "archivo";
        if (item && item.name) {
          const base = item.name.replace(/\.[^/.]+$/, "");
          if (type === "OMR") downloadName = base + ".omr";
          else if (type === "MXL") downloadName = base + ".mxl";
          else downloadName = item.name;
        } else {
          downloadName = filename;
        }
        a.download = downloadName;

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        Alert.alert("Error", `No se pudo descargar el archivo ${type}.`);
      }
    } catch (error) {
      console.error(`Error al descargar el archivo ${type}:`, error);
      Alert.alert("Error", `Hubo un problema al descargar el archivo ${type}.`);
    }
  };

  const handleLoadStart = useCallback(() => {
    setLoadingImage(true);
  }, []);

  const handleLoadEnd = useCallback(() => {
    setLoadingImage(false);
  }, []);

  const handleError = useCallback(
    (error) => {
      console.error("Error al cargar la imagen:", error.nativeEvent.error);
      Alert.alert("Error", "No se pudo cargar la imagen.");
      setLoadingImage(false);
      setSelectedImage(null);
    },
    []
  );

  const imageSource = useMemo(() => {
    return selectedImage ? { uri: selectedImage } : undefined;
  }, [selectedImage]);

  return (
    <ConversionsScreenView
      conversions={conversions}
      selectedImage={selectedImage}
      loadingImage={loadingImage}
      handleImagePress={handleImagePress}
      closeModal={closeModal}
      downloadFile={downloadFile}
      handleLoadStart={handleLoadStart}
      handleLoadEnd={handleLoadEnd}
      handleError={handleError}
      imageSource={imageSource}
    />
  );
};

export default ConversionsScreen;