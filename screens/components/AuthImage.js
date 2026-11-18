import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, View } from "react-native";
import { fetchAuthImageDataUri } from "../../lib/authImage";

// <Image> para archivos protegidos por JWT (ver lib/authImage.js).
export default function AuthImage({ path, style, ...imageProps }) {
  const [uri, setUri] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setUri(null);
    fetchAuthImageDataUri(path)
      .then((dataUri) => {
        if (!cancelled) setUri(dataUri);
      })
      .catch((error) => console.warn("No se pudo cargar la imagen:", path, error.message));
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (!uri) {
    return (
      <View style={[style, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator />
      </View>
    );
  }

  return <Image {...imageProps} source={{ uri }} style={style} />;
}
