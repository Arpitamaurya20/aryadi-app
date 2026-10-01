import { useCallback, useEffect, useState } from 'react';
import { fetchAttendanceStatus } from '../api/attendance';
import type { AuthUser } from '../api/auth';
import { playAryadiChime, stopAryadiChime } from '../audio/alertTones';
import {
  readAttendanceRemindersEnabled,
  readLastRung,
  readPunchReminderTime,
  saveLastRung,
} from '../storage/punchReminder';

const CheckEveryMs = 15000;
/** If the app is opened a little after the reminder time, still remind once. */
const CatchUpMinutes = 60;
const RepeatRings = 3;
const RepeatGapMs = 2400;

function localDay(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Rings the Aryadi Chime at the punch-in reminder time set in Settings, unless already punched in. */
export function usePunchReminder(user: AuthUser | null) {
  const [ringingTime, setRingingTime] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    let busy = false;

    const check = async () => {
      if (busy) return;
      busy = true;
      try {
        const [enabled, time, lastRung] = await Promise.all([
          readAttendanceRemindersEnabled(user),
          readPunchReminderTime(user),
          readLastRung(user),
        ]);
        if (!enabled || !time) return;

        const now = new Date();
        const marker = `${localDay(now)}@${time}`;
        if (lastRung === marker) return;

        const [hour, minute] = time.split(':').map(Number);
        const minutesNow = now.getHours() * 60 + now.getMinutes();
        const target = hour * 60 + minute;
        if (minutesNow < target || minutesNow > target + CatchUpMinutes) return;

        if (user.employeeId > 0) {
          try {
            const status = await fetchAttendanceStatus(user.employeeId);
            if (status.inTimeStatus) {
              await saveLastRung(user, marker);
              return;
            }
          } catch {
            // Unknown status: remind anyway.
          }
        }

        if (!active) return;
        await saveLastRung(user, marker);
        setRingingTime(time);
      } finally {
        busy = false;
      }
    };

    void check();
    const timer = setInterval(() => void check(), CheckEveryMs);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [user]);

  useEffect(() => {
    if (!ringingTime) return;
    let rings = 1;
    playAryadiChime();
    const timer = setInterval(() => {
      rings += 1;
      playAryadiChime();
      if (rings >= RepeatRings) clearInterval(timer);
    }, RepeatGapMs);
    return () => {
      clearInterval(timer);
      stopAryadiChime();
    };
  }, [ringingTime]);

  const dismiss = useCallback(() => setRingingTime(null), []);

  return { ringingTime, dismiss };
}
