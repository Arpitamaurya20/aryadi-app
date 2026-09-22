import { Platform } from 'react-native';

/**
 * ═══════════════════════════════════════════════════════════
 *  CHANGE API ENVIRONMENT HERE ONLY
 *  Switch `API_ENV` between 'local' | 'live'.
 *  Every API call (login, profile, leave, …) uses this.
 * ═══════════════════════════════════════════════════════════
 */
export type ApiEnv = 'local' | 'live';

export const API_ENV: ApiEnv = 'local';

/** Production base URL (no trailing slash). Update path only if live API moves. */
const LIVE_API_BASE = 'https://techxpertindia.in/api';

/**
 * Local PHP base path (no host, no trailing slash).
 * Full login URL example:
 *   http://localhost/Projects/aryadibussines/api/login.php
 */
const LOCAL_API_PATH = '/Projects/aryadibussines/api';

/**
 * Your PC LAN IP for a physical phone/tablet on the same Wi‑Fi.
 * Find it with `ipconfig` (IPv4). Android emulator uses 10.0.2.2 automatically.
 */
const LOCAL_DEVICE_HOST = '192.168.29.111';

function localBaseUrl() {
  if (Platform.OS === 'web') {
    return `http://localhost${LOCAL_API_PATH}`;
  }
  if (Platform.OS === 'android') {
    // Android emulator → host machine loopback
    return `http://10.0.2.2${LOCAL_API_PATH}`;
  }
  // iOS simulator can use localhost; physical iOS device needs LAN IP
  return `http://${LOCAL_DEVICE_HOST}${LOCAL_API_PATH}`;
}

/** Single base URL used by all API modules. */
export function getApiBaseUrl() {
  if (API_ENV === 'live') {
    return LIVE_API_BASE.replace(/\/$/, '');
  }
  return localBaseUrl().replace(/\/$/, '');
}

/** Build a full endpoint URL from a path like `login.php` or `/login.php`. */
export function apiUrl(path: string) {
  const clean = path.replace(/^\//, '');
  return `${getApiBaseUrl()}/${clean}`;
}
