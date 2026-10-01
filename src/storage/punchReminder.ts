import type { AuthUser } from '../api/auth';
import { readJson, removeKey, writeJson } from './localStore';

function employeeKey(user: AuthUser) {
  return String(user.employeeId || user.id || user.loginName);
}

const timeKey = (user: AuthUser) => `punch_reminder_${employeeKey(user)}`;
const rungKey = (user: AuthUser) => `punch_reminder_rung_${employeeKey(user)}`;
const prefsKey = (user: AuthUser) => `home_prefs_${employeeKey(user)}`;

/** "HH:MM" in 24-hour time, or null when no reminder is set. */
export async function readPunchReminderTime(user: AuthUser): Promise<string | null> {
  const saved = await readJson<string>(timeKey(user));
  return typeof saved === 'string' && /^\d{2}:\d{2}$/.test(saved) ? saved : null;
}

export async function savePunchReminderTime(user: AuthUser, time: string | null) {
  if (time) await writeJson(timeKey(user), time);
  else await removeKey(timeKey(user));
}

/** Attendance reminders switch in Settings; on unless the user turned it off. */
export async function readAttendanceRemindersEnabled(user: AuthUser) {
  const prefs = await readJson<{ attendance?: boolean }>(prefsKey(user));
  return prefs?.attendance !== false;
}

/** Marker "YYYY-MM-DD@HH:MM" of the last reminder that rang, so changing the time re-arms it. */
export async function readLastRung(user: AuthUser) {
  const saved = await readJson<string>(rungKey(user));
  return typeof saved === 'string' ? saved : '';
}

export async function saveLastRung(user: AuthUser, marker: string) {
  await writeJson(rungKey(user), marker);
}

export function formatReminderTime(time: string) {
  const [h, m] = time.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`;
}
