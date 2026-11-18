import { apiUrl } from "./api";
import { getValidAccessToken } from "./authSession";

// Los archivos de /uploads/* exigen JWT, y <Image source={{ uri }}> no envia
// la cabecera Authorization en web. Descargamos la imagen con el token y la
// convertimos a data URI, que funciona igual en web y en nativo.
const cache = new Map();

function blobToDataUri(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function fetchAuthImageDataUri(path) {
  if (cache.has(path)) {
    return cache.get(path);
  }

  const promise = (async () => {
    const token = await getValidAccessToken();
    if (!token) {
      throw new Error("Sesion expirada");
    }
    const response = await fetch(apiUrl(path), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return blobToDataUri(await response.blob());
  })();

  cache.set(path, promise);
  promise.catch(() => cache.delete(path));
  return promise;
}

export function forgetAuthImage(path) {
  cache.delete(path);
}
