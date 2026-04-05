import { Platform } from "react-native";

function normalizeBaseUrl(url) {
  return url.replace(/\/$/, "");
}

function resolveDefaultBaseUrl() {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const protocol = window.location.protocol || "http:";
    const host = window.location.hostname || "localhost";
    return `${protocol}//${host}:5000`;
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
