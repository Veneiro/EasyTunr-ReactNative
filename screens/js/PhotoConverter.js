import React, { useState, useRef, useEffect } from "react";
import { Platform, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import PhotoConverterView from "../views/PhotoConverterView";
import { apiUrl } from "../../lib/api";
import { clearAuthSession, getValidAccessToken } from "../../lib/authSession";

export default function PhotoConverter({ navigation }) {
  const [image, setImage] = useState(null);
  const [name, setName] = useState("");
  const [webFile, setWebFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (Platform.OS !== "web") {
      (async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Necesitamos permisos para acceder a la galería.");
        }
      })();
    }
  }, []);

  const uploadImage = async () => {
    if (!image) {
      Alert.alert("Selecciona una imagen primero.");
      return;
    }
    setUploading(true);
    let filename;
    let formData = new FormData();

    if (Platform.OS === "web") {
      if (!webFile) {
        Alert.alert("No image selected!");
        setUploading(false);
        return;
      }
      filename = webFile.name;
      formData.append("photo", webFile, filename);
    } else {
      filename = image.split("/").pop();
      const file = await fetch(image);
      const blob = await file.blob();
      formData.append("photo", blob, filename);
    }
    formData.append("name", name.trim() !== "" ? name : filename);

    try {
      const token = await getValidAccessToken();
      let response = await fetch(apiUrl("/upload/photo"), {
        method: "POST",
        body: formData,
        headers: {
          Authorization: "Bearer " + (token || ""),
        },
      });

      if (response.status === 401) {
        await clearAuthSession();
        navigation.reset({ index: 0, routes: [{ name: "Login" }] });
        setUploading(false);
        return;
      }

      let result = await response.json();
      if (response.ok) {
        Alert.alert("¡Imagen subida con éxito!");
        navigation.navigate("Conversions");
      } else {
        Alert.alert("Error al subir la imagen");
      }
    } catch (error) {
      Alert.alert("Error al subir la imagen.");
    }
    setUploading(false);
  };

  const pickImage = async () => {
    if (Platform.OS === "web") {
      fileInputRef.current && fileInputRef.current.click();
    } else {
      const { status, canAskAgain } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        if (!canAskAgain) {
          Alert.alert(
            "Permiso denegado",
            "Debes activar el permiso de galería manualmente en los ajustes del sistema para poder seleccionar imágenes."
          );
        } else {
          Alert.alert("Necesitamos permisos para acceder a la galería.");
        }
        return;
      }
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaType.Image,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        setImage(uri);
      }
    }
  };

  const takePhoto = async () => {
    if (Platform.OS === "web") {
      window.alert("No soportado en web");
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Necesitamos permisos de cámara.");
      return;
    }
    let result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      setImage(uri);
    }
  };

  const onFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const uri = URL.createObjectURL(file);
      setImage(uri);
      setWebFile(file);
    }
  };

  return (
    <PhotoConverterView
      image={image}
      name={name}
      setName={setName}
      uploading={uploading}
      pickImage={pickImage}
      takePhoto={takePhoto}
      uploadImage={uploadImage}
      fileInputRef={fileInputRef}
      onFileChange={onFileChange}
      webFile={webFile}
    />
  );
}