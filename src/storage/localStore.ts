import { Platform } from 'react-native';

type KeyValueStore = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

let nativeStore: KeyValueStore | null | undefined;

/**
 * Web uses localStorage. Native uses AsyncStorage, loaded lazily because an APK built
 * before the package was added has no native module and the import would throw.
 */
function store(): KeyValueStore | null {
  if (Platform.OS === 'web') {
    try {
      if (typeof localStorage === 'undefined') return null;
      return {
        getItem: async (key) => localStorage.getItem(key),
        setItem: async (key, value) => localStorage.setItem(key, value),
        removeItem: async (key) => localStorage.removeItem(key),
      };
    } catch {
      return null;
    }
  }
  if (nativeStore === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('@react-native-async-storage/async-storage');
      nativeStore = (mod.default ?? mod) as KeyValueStore;
    } catch {
      nativeStore = null;
    }
  }
  return nativeStore;
}

export async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await store()?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await store()?.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable: the form keeps working, only the draft is lost.
  }
}

export async function removeKey(key: string): Promise<void> {
  try {
    await store()?.removeItem(key);
  } catch {
    // Ignore: a stale draft is harmless.
  }
}
