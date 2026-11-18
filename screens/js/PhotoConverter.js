import React, { useState, useRef, useEffect } from "react";
import { Platform, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import PhotoConverterView from "../views/PhotoConverterView";
import { apiUrl } from "../../lib/api";
import { clearAuthSession, getValidAccessToken } from "../../lib/authSession";

const POLL_INTERVAL_MS = 3000;

// Alert.alert no hace nada en react-native-web.
const notify = (title, message = "") => {
  if (Platform.OS === "web") {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function PhotoConverter({ navigation }) {
  // `image` es la URI a previsualizar (o el nombre del archivo si es un PDF).
  const [image, setImage] = useState(null);
  const [fileUri, setFileUri] = useState(null);
  const [isPdf, setIsPdf] = useState(false);
  const [name, setName] = useState("");
  const [webFile, setWebFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPhase, setUploadPhase] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!uploading) {
      return undefined;
    }
    setElapsedSeconds(0);
    const startedAt = Date.now();
    const timer = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [uploading]);

  const selectFile = ({ uri, preview, pdf, file = null }) => {
    setFileUri(uri);
    setImage(preview);
    setIsPdf(pdf);
    setWebFile(file);
  };

  const handleSessionExpired = async () => {
    await clearAuthSession();
    navigation.reset({ index: 0, routes: [{ name: "Login" }] });
  };

  const buildFormData = () => {
    const formData = new FormData();
    if (Platform.OS === "web") {
      formData.append("photo", webFile, webFile.name);
    } else {
      const filename = (isPdf ? image : fileUri.split("/").pop()) || `partitura-${Date.now()}.jpg`;
      const type = isPdf ? "application/pdf" : filename.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
      formData.append("photo", { uri: fileUri, name: filename, type });
    }
    const displayName = name.trim() || (isPdf ? image : webFile?.name) || "";
    if (displayName) {
      formData.append("name", displayName);
    }
    return formData;
  };

  const waitForConversion = async (taskId) => {
    while (mountedRef.current) {
      await wait(POLL_INTERVAL_MS);
      const token = await getValidAccessToken();
      if (!token) {
        throw new Error("Tu sesión expiró. Inicia sesión de nuevo.");
      }
      const response = await fetch(apiUrl(`/conversion_status/${taskId}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 401) {
        await handleSessionExpired();
        return null;
      }
      if (response.status === 404) {
        throw new Error("El servidor perdió la tarea de conversión (¿se reinició?). Vuelve a intentarlo.");
      }
      const task = await response.json();
      if (task.status === "completed") {
        return task;
      }
      if (task.status === "failed") {
        throw new Error(task.message || "La conversión falló.");
      }
      if (mountedRef.current && task.message) {
        setUploadPhase(task.message);
      }
    }
    return null;
  };

  const uploadImage = async () => {
    if (!image || (Platform.OS === "web" ? !webFile : !fileUri)) {
      notify("Selecciona una imagen o PDF primero.");
      return;
    }

    setUploading(true);
    setUploadPhase("Subiendo archivo...");
    try {
      const token = await getValidAccessToken();
      if (!token) {
        await handleSessionExpired();
        return;
      }

      const response = await fetch(apiUrl("/upload/photo"), {
        method: "POST",
        body: buildFormData(),
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 401) {
        await handleSessionExpired();
        return;
      }
      const result = await response.json();
      if (!response.ok || !result.task_id) {
        throw new Error(result.message || "No se pudo subir el archivo.");
      }

      setUploadPhase("Reconociendo la partitura con el modelo...");
      const task = await waitForConversion(result.task_id);
      if (task && mountedRef.current) {
        notify("¡Partitura transcrita!", "Ya puedes descargar el MusicXML desde Conversiones.");
        selectFile({ uri: null, preview: null, pdf: false });
        navigation.navigate("Conversions");
      }
    } catch (error) {
      notify("Error en la conversión", error.message || "Hubo un problema al conectar con el servidor.");
    } finally {
      if (mountedRef.current) {
        setUploading(false);
        setUploadPhase("");
      }
    }
  };

  const pickImage = async () => {
    if (Platform.OS === "web") {
      fileInputRef.current && fileInputRef.current.click();
      return;
    }
    const { status, canAskAgain } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      notify(
        "Permiso denegado",
        canAskAgain
          ? "Necesitamos permisos para acceder a la galería."
          : "Debes activar el permiso de galería manualmente en los ajustes del sistema para poder seleccionar imágenes."
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      // Recorte libre: las partituras suelen ser verticales.
      allowsEditing: true,
      quality: 1,
    });
    if (!result.canceled && result.assets?.length > 0) {
      const { uri } = result.assets[0];
      selectFile({ uri, preview: uri, pdf: false });
    }
  };

  const takePhoto = async () => {
    if (Platform.OS === "web") {
      cameraInputRef.current && cameraInputRef.current.click();
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      notify("Necesitamos permisos de cámara.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 1,
    });
    if (!result.canceled && result.assets?.length > 0) {
      const { uri } = result.assets[0];
      selectFile({ uri, preview: uri, pdf: false });
    }
  };

  const pickPdf = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets?.length > 0) {
      const asset = result.assets[0];
      selectFile({ uri: asset.uri, preview: asset.name || "partitura.pdf", pdf: true });
    }
  };

  const onFileChange = (event) => {
    const file = event.target.files[0];
    if (!file) {
      return;
    }
    const pdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    selectFile({ uri: null, preview: pdf ? file.name : URL.createObjectURL(file), pdf, file });
    // Permite volver a elegir el mismo archivo.
    event.target.value = "";
  };

  return (
    <PhotoConverterView
      image={image}
      name={name}
      setName={setName}
      isPdf={isPdf}
      uploading={uploading}
      uploadPhase={uploadPhase}
      elapsedSeconds={elapsedSeconds}
      pickImage={pickImage}
      pickPdf={pickPdf}
      takePhoto={takePhoto}
      uploadImage={uploadImage}
      fileInputRef={fileInputRef}
      cameraInputRef={cameraInputRef}
      onFileChange={onFileChange}
      webFile={webFile}
    />
  );
}
