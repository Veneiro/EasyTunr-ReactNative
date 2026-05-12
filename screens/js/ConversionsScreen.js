import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Alert } from "react-native";
import ConversionsScreenView from "../views/ConversionsScreenView";
import { apiUrl } from "../../lib/api";
import { clearAuthSession, getValidAccessToken } from "../../lib/authSession";

const getSheetKey = (item, index = 0) =>
  item?.sheet_key || item?.musicxml || item?.omr || item?.audio || item?.filename || `sheet-${index}`;

const ConversionsScreen = () => {
  const [conversions, setConversions] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [loadingImage, setLoadingImage] = useState(false);

  useEffect(() => {
    const fetchConversions = async () => {
      try {
        const token = await getValidAccessToken();
        if (!token) {
          Alert.alert("Error", "Tu sesión expiró. Inicia sesión de nuevo.");
          return;
        }
        const response = await fetch(apiUrl("/sheets"), {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          const normalized = (data.sheets || []).map((sheet, index) => ({
            ...sheet,
            sheet_key: getSheetKey(sheet, index),
          }));
          setConversions(normalized);
        } else if (response.status === 401) {
          await clearAuthSession();
          Alert.alert("Sesión expirada", "Vuelve a iniciar sesión.");
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
      if (typeof document === "undefined") {
        Alert.alert(
          "No disponible",
          "La descarga directa esta habilitada en web. En movil podemos agregar compartir/guardar si quieres."
        );
        return;
      }

      const token = await getValidAccessToken();
      if (!token) {
        Alert.alert("Error", "Tu sesión expiró. Inicia sesión de nuevo.");
        return;
      }
      const endpoint =
        type === "AUDIO"
          ? apiUrl(`/uploads/sheets/${filename}`)
          : apiUrl(`/uploads/conversions/${filename}`);

      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
        }
      });
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
      } else if (response.status === 401) {
        await clearAuthSession();
        Alert.alert("Sesión expirada", "Vuelve a iniciar sesión.");
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

  const handleDeleteSheet = useCallback((item) => {
    const handleConfirmDelete = async () => {
      setConversions((prev) => prev.filter((s) => s.sheet_key !== item.sheet_key));
      try {
        const token = await getValidAccessToken();
        
        if (!token || !token.trim()) {
          throw new Error("No hay sesión activa. Por favor, inicia sesión de nuevo.");
        }

        const url = apiUrl(`/sheets/${encodeURIComponent(item.sheet_key)}`);
        console.log("DELETE request:", { url, sheet_key: item.sheet_key, token_exists: !!token });
        
        const response = await fetch(url, {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        console.log("DELETE response:", { status: response.status, ok: response.ok });

        if (!response.ok) {
          let errorMsg = "No se pudo eliminar la partitura.";
          try {
            const data = await response.json();
            errorMsg = data.error || data.message || errorMsg;
          } catch (e) {
            errorMsg = `Error ${response.status}: ${response.statusText}`;
          }
          if (response.status === 401) {
            await clearAuthSession();
          }
          throw new Error(errorMsg);
        }

        console.log("Partitura eliminada correctamente:", item.sheet_key);
      } catch (error) {
        console.error("Error al eliminar partitura:", error);
        // Revertir eliminación visual si falla
        setConversions((prev) => [...prev, item]);
        
        const errorMsg = error.message || "Error desconocido al conectar con el servidor.";
        
        if (typeof window !== "undefined" && window.confirm) {
          // En web, usar confirm
          alert(`Error: ${errorMsg}`);
        } else {
          Alert.alert("Error", `No se pudo eliminar: ${errorMsg}`);
        }
      }
    };

    const sheetName = item.name || item.filename || "esta partitura";
    if (typeof window !== "undefined" && window.confirm) {
      // En web
      if (window.confirm(`¿Seguro que quieres eliminar "${sheetName}"?`)) {
        handleConfirmDelete();
      }
    } else {
      // En React Native
      Alert.alert(
        "Eliminar partitura",
        `¿Seguro que quieres eliminar ${sheetName}?`,
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Eliminar",
            style: "destructive",
            onPress: handleConfirmDelete,
          },
        ]
      );
    }
  }, []);

  const handleReorder = useCallback(async (nextList) => {
    setConversions(nextList);
    try {
      const token = await getValidAccessToken();
      if (!token) {
        throw new Error("No hay sesión activa.");
      }
      const response = await fetch(apiUrl("/sheets/reorder"), {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sheet_keys: nextList.map((item) => item.sheet_key),
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          await clearAuthSession();
        }
        throw new Error("No se pudo guardar el nuevo orden.");
      }
    } catch (error) {
      console.error("Error al guardar nuevo orden:", error);
      Alert.alert("Aviso", "Se aplico el orden en pantalla, pero no se pudo sincronizar en servidor.");
    }
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
      onDeleteSheet={handleDeleteSheet}
      onReorder={handleReorder}
    />
  );
};

export default ConversionsScreen;