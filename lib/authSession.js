import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiUrl } from "./api";

const TOKEN_KEY = "token";
const EXPIRES_AT_KEY = "tokenExpiresAt";
const LAST_ACTIVITY_KEY = "lastActivityAt";

// Refresh when the token has less than this left.
const REFRESH_THRESHOLD_MS = 2 * 60 * 1000;
// Only refresh for users who interacted recently (App.js logs out after 10 min idle).
const IDLE_LIMIT_MS = 10 * 60 * 1000;
// Avoid writing to storage on every touch/mouse move.
const ACTIVITY_WRITE_INTERVAL_MS = 15 * 1000;

let lastActivityWrite = 0;
let refreshPromise = null;

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export async function getAuthSession() {
  const [[, token], [, expiresAt], [, lastActivityAt]] = await AsyncStorage.multiGet([
    TOKEN_KEY,
    EXPIRES_AT_KEY,
    LAST_ACTIVITY_KEY,
  ]);
  return {
    token: token || null,
    expiresAt: toNumber(expiresAt),
    lastActivityAt: toNumber(lastActivityAt),
  };
}

export async function saveAuthSession(token, expiresInSeconds = 600) {
  const now = Date.now();
  lastActivityWrite = now;
  await AsyncStorage.multiSet([
    [TOKEN_KEY, token],
    [EXPIRES_AT_KEY, String(now + Number(expiresInSeconds) * 1000)],
    [LAST_ACTIVITY_KEY, String(now)],
  ]);
}

export async function clearAuthSession() {
  lastActivityWrite = 0;
  await AsyncStorage.multiRemove([TOKEN_KEY, EXPIRES_AT_KEY, LAST_ACTIVITY_KEY]);
}

export async function markAuthActivity() {
  const now = Date.now();
  if (now - lastActivityWrite < ACTIVITY_WRITE_INTERVAL_MS) {
    return;
  }
  lastActivityWrite = now;
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (token) {
    await AsyncStorage.setItem(LAST_ACTIVITY_KEY, String(now));
  }
}

function isExpired(session, now = Date.now()) {
  return Boolean(session.expiresAt && session.expiresAt <= now);
}

export async function shouldRefreshSession() {
  const session = await getAuthSession();
  if (!session.token || isExpired(session)) {
    return false;
  }
  const now = Date.now();
  if (session.lastActivityAt && now - session.lastActivityAt > IDLE_LIMIT_MS) {
    return false;
  }
  // Legacy sessions without an expiry are refreshed to obtain one.
  return !session.expiresAt || session.expiresAt - now <= REFRESH_THRESHOLD_MS;
}

async function requestRefresh(currentToken) {
  try {
    const response = await fetch(apiUrl("/auth/refresh"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${currentToken}`,
        "Content-Type": "application/json",
      },
    });

    if (response.status === 401 || response.status === 404) {
      await clearAuthSession();
      return null;
    }
    if (!response.ok) {
      return currentToken;
    }

    const data = await response.json();
    if (!data.token) {
      return currentToken;
    }
    await saveAuthSession(data.token, data.token_expires_in_seconds || 600);
    return data.token;
  } catch (error) {
    // Network failure: keep using the current token until it actually expires.
    console.warn("No se pudo refrescar la sesión:", error);
    return currentToken;
  }
}

/**
 * Refreshes the access token when it is close to expiring (or always when
 * `force` is true). Returns the token to use, or null if there is no session.
 */
export async function refreshAuthSessionIfNeeded(force = false) {
  const session = await getAuthSession();
  if (!session.token) {
    return null;
  }
  if (isExpired(session)) {
    await clearAuthSession();
    return null;
  }
  if (!force && !(await shouldRefreshSession())) {
    return session.token;
  }

  if (!refreshPromise) {
    refreshPromise = requestRefresh(session.token).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/** Returns a non-expired access token (refreshing it if needed), or null. */
export async function getValidAccessToken() {
  const token = await refreshAuthSessionIfNeeded(false);
  if (token) {
    await markAuthActivity();
  }
  return token;
}
