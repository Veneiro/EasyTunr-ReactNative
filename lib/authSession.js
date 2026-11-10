import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiUrl } from "./api";

const TOKEN_KEY = "token";
const TOKEN_EXPIRES_AT_KEY = "tokenExpiresAt";
const LAST_ACTIVITY_AT_KEY = "tokenLastActivityAt";
const DEFAULT_EXPIRES_IN_SECONDS = 600;
const REFRESH_BUFFER_MS = 2 * 60 * 1000;
const IDLE_TIMEOUT_MS = 10 * 60 * 1000;

function toExpiresAt(expiresInSeconds) {
  const lifetime = Number(expiresInSeconds) || DEFAULT_EXPIRES_IN_SECONDS;
  return Date.now() + lifetime * 1000;
}

export async function saveAuthSession(token, expiresInSeconds = DEFAULT_EXPIRES_IN_SECONDS) {
  const expiresAt = toExpiresAt(expiresInSeconds);
  const now = Date.now();
  await AsyncStorage.multiSet([
    [TOKEN_KEY, token],
    [TOKEN_EXPIRES_AT_KEY, String(expiresAt)],
    [LAST_ACTIVITY_AT_KEY, String(now)],
  ]);
  return { token, expiresAt, lastActivityAt: now };
}

export async function clearAuthSession() {
  await AsyncStorage.multiRemove([TOKEN_KEY, TOKEN_EXPIRES_AT_KEY, LAST_ACTIVITY_AT_KEY]);
}

export async function getAuthSession() {
  const entries = await AsyncStorage.multiGet([TOKEN_KEY, TOKEN_EXPIRES_AT_KEY, LAST_ACTIVITY_AT_KEY]);
  const session = Object.fromEntries(entries);
  return {
    token: session[TOKEN_KEY] || null,
    expiresAt: session[TOKEN_EXPIRES_AT_KEY] ? Number(session[TOKEN_EXPIRES_AT_KEY]) : null,
    lastActivityAt: session[LAST_ACTIVITY_AT_KEY] ? Number(session[LAST_ACTIVITY_AT_KEY]) : null,
  };
}

export async function getStoredToken() {
  const { token } = await getAuthSession();
  return token;
}

export async function markAuthActivity() {
  const now = Date.now();
  await AsyncStorage.setItem(LAST_ACTIVITY_AT_KEY, String(now));
  return now;
}

export async function getTokenAgeMs() {
  const { lastActivityAt } = await getAuthSession();
  if (!lastActivityAt) {
    return null;
  }
  return Date.now() - lastActivityAt;
}

export async function shouldRefreshSession() {
  const { token, expiresAt, lastActivityAt } = await getAuthSession();
  if (!token) {
    return false;
  }
  if (!expiresAt) {
    return true;
  }

  const now = Date.now();
  const remainingMs = expiresAt - now;
  if (remainingMs <= 0) {
    return false;
  }

  if (lastActivityAt && now - lastActivityAt > IDLE_TIMEOUT_MS) {
    return false;
  }

  return remainingMs <= REFRESH_BUFFER_MS;
}

export async function refreshAuthSessionIfNeeded(force = false) {
  const { token, expiresAt, lastActivityAt } = await getAuthSession();
  if (!token) {
    return null;
  }

  const now = Date.now();
  const isIdleTooLong = lastActivityAt && now - lastActivityAt > IDLE_TIMEOUT_MS;
  if (isIdleTooLong && !force) {
    await clearAuthSession();
    return null;
  }

  if (!force && expiresAt && expiresAt - now > REFRESH_BUFFER_MS) {
    await markAuthActivity();
    return token;
  }

  const response = await fetch(apiUrl("/auth/refresh"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (response.ok) {
    const data = await response.json();
    await saveAuthSession(data.token, data.token_expires_in_seconds || DEFAULT_EXPIRES_IN_SECONDS);
    return data.token;
  }

  if (response.status === 401 || response.status === 422) {
    await clearAuthSession();
    return null;
  }

  return token;
}

export async function getValidAccessToken() {
  return refreshAuthSessionIfNeeded(false);
}

export function getIdleTimeoutMs() {
  return IDLE_TIMEOUT_MS;
}
