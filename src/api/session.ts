import { Platform } from 'react-native';
import type { AuthUser } from './auth';
import { clearAuthToken, setAuthToken } from './client';
import { readJson, removeKey, writeJson } from '../storage/localStore';

const SESSION_KEY = 'aryadi.auth.session';
const USERNAME_KEY = 'aryadi.auth.username';

type StoredSession = {
  token: string;
  user: AuthUser;
};

function browserStorage() {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

/** True while the JWT `exp` claim is still in the future. */
export function tokenIsUsable(token: string) {
  const part = token.split('.')[1];
  if (!part) return false;
  try {
    const padded = part.replace(/-/g, '+').replace(/_/g, '/');
    const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
    const payload = JSON.parse(atob(padded + pad)) as { exp?: number };
    if (typeof payload.exp !== 'number') return true;
    return payload.exp * 1000 > Date.now() + 60_000;
  } catch {
    return false;
  }
}

function sessionFromRaw(raw: string | null): AuthUser | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed?.token || !parsed.user || !tokenIsUsable(parsed.token)) {
      return null;
    }
    setAuthToken(parsed.token);
    return { ...parsed.user, token: parsed.token };
  } catch {
    return null;
  }
}

export async function rememberUsername(username: string) {
  const name = username.trim();
  if (!name) return;
  if (Platform.OS === 'web') {
    browserStorage()?.setItem(USERNAME_KEY, name);
    return;
  }
  await writeJson(USERNAME_KEY, name);
}

export async function loadRememberedUsername() {
  if (Platform.OS === 'web') {
    return browserStorage()?.getItem(USERNAME_KEY) ?? '';
  }
  const value = await readJson<string>(USERNAME_KEY);
  return typeof value === 'string' ? value : '';
}

export async function saveSession(user: AuthUser) {
  if (!user.token || !tokenIsUsable(user.token)) return;
  const stored: StoredSession = { token: user.token, user };
  if (Platform.OS === 'web') {
    browserStorage()?.setItem(SESSION_KEY, JSON.stringify(stored));
  } else {
    await writeJson(SESSION_KEY, stored);
  }
  if (user.loginName) await rememberUsername(user.loginName);
}

/** Restores the signed-in user and puts the saved token back on API calls. */
export async function loadSession(): Promise<AuthUser | null> {
  if (Platform.OS === 'web') {
    const user = sessionFromRaw(browserStorage()?.getItem(SESSION_KEY) ?? null);
    if (!user) browserStorage()?.removeItem(SESSION_KEY);
    return user;
  }
  const parsed = await readJson<StoredSession>(SESSION_KEY);
  if (!parsed?.token || !parsed.user || !tokenIsUsable(parsed.token)) {
    if (parsed) await removeKey(SESSION_KEY);
    return null;
  }
  setAuthToken(parsed.token);
  return { ...parsed.user, token: parsed.token };
}

export async function clearSession() {
  clearAuthToken();
  if (Platform.OS === 'web') {
    browserStorage()?.removeItem(SESSION_KEY);
    return;
  }
  await removeKey(SESSION_KEY);
}
