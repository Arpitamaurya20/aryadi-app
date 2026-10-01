import type { AuthUser } from './auth';
import { clearAuthToken, setAuthToken } from './client';

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

export function rememberUsername(username: string) {
  const name = username.trim();
  if (!name) return;
  browserStorage()?.setItem(USERNAME_KEY, name);
}

export function loadRememberedUsername() {
  return browserStorage()?.getItem(USERNAME_KEY) ?? '';
}

export function saveSession(user: AuthUser) {
  if (!user.token || !tokenIsUsable(user.token)) return;
  browserStorage()?.setItem(SESSION_KEY, JSON.stringify({ token: user.token, user } satisfies StoredSession));
  if (user.loginName) rememberUsername(user.loginName);
}

/** Restores the signed-in user and puts the saved token back on API calls. */
export function loadSession(): AuthUser | null {
  const raw = browserStorage()?.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed?.token || !parsed.user || !tokenIsUsable(parsed.token)) {
      browserStorage()?.removeItem(SESSION_KEY);
      return null;
    }
    setAuthToken(parsed.token);
    return { ...parsed.user, token: parsed.token };
  } catch {
    browserStorage()?.removeItem(SESSION_KEY);
    return null;
  }
}

export function clearSession() {
  clearAuthToken();
  browserStorage()?.removeItem(SESSION_KEY);
}
