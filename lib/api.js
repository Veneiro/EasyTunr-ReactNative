import { Platform } from "react-native";
import Constants from "expo-constants";

function normalizeBaseUrl(url) {
  return url.replace(/\/$/, "");
}

// IP del ordenador que sirve Metro (p. ej. "192.168.1.20:8081" -> "192.168.1.20").
// Un móvil real conectado a la misma Wi-Fi llega al backend por esa IP.
function resolveDevServerHost() {
  const hostUri = Constants.expoConfig?.hostUri || Constants.expoGoConfig?.debuggerHost || "";
  const host = hostUri.split(":")[0];
  if (!host || host === "localhost" || host === "127.0.0.1") {
    return null;
  }
  return host;
}

function resolveDefaultBaseUrl() {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const protocol = window.location.protocol || "http:";
    const host = window.location.hostname || "localhost";
    return `${protocol}//${host}:5000`;
  }

  const devServerHost = resolveDevServerHost();
  if (devServerHost) {
    return `http://${devServerHost}:5000`;
  }

  // Android emulator cannot reach localhost directly.
  if (Platform.OS === "android") {
    return "http://10.0.2.2:5000";
  }

  // iOS simulator + desktop local development.
  return "http://127.0.0.1:5000";
}

export const API_BASE_URL = normalizeBaseUrl(
  (process.env.EXPO_PUBLIC_API_URL || "").trim() || resolveDefaultBaseUrl()
);

export function apiUrl(path) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}
