import type { ComponentProps } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MaterialCommunityIcons } from '@expo/vector-icons';
import type { AttendanceStatus } from '../api/attendance';
import type { AuthUser } from '../api/auth';
import { fetchAssignedPpmTickets } from '../api/ppmTickets';
import { fetchOpenServiceTickets } from '../api/serviceTickets';
import { readJson, writeJson } from '../storage/localStore';
import { readMySiteVisits } from '../storage/mySiteVisits';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export type TaskKind = 'ticket' | 'ppm' | 'visit';
export type TaskUrgency = 'overdue' | 'today' | 'soon' | 'later' | 'none';

export type MyTask = {
  key: string;
  kind: TaskKind;
  code: string;
  typeLabel: string;
  title: string;
  subtitle: string;
  status: string;
  /** YYYY-MM-DD, empty when the task has no date */
  dueDate: string;
  urgency: TaskUrgency;
  /** Whole days past due; negative when the date is still ahead */
  daysLate: number;
  escalated: boolean;
};

export type NoticeCategory = 'attendance' | 'due' | 'escalation' | 'visit';
export type NoticeTone = 'danger' | 'warning' | 'info';
export type NoticeAction = 'tickets' | 'visits' | 'workZone';

export type Notice = {
  id: string;
  category: NoticeCategory;
  tone: NoticeTone;
  icon: IconName;
  title: string;
  body: string;
  action: NoticeAction;
};

export type HomePrefs = Record<NoticeCategory, boolean>;

const DefaultPrefs: HomePrefs = { attendance: true, due: true, escalation: true, visit: true };
const SoonDays = 3;
const NoticeLimit = 60;

function localDay(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Accepts YYYY-MM-DD or DD-MM-YYYY (with / or -) and returns YYYY-MM-DD, or '' when unusable. */
function normalizeDay(value: string | undefined | null) {
  const text = String(value ?? '').trim();
  const iso = /^(\d{4})[-/](\d{2})[-/](\d{2})/.exec(text);
  if (iso) return iso[1] === '0000' ? '' : `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = /^(\d{2})[-/](\d{2})[-/](\d{4})/.exec(text);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  return '';
}

function daysBetween(fromDay: string, toDay: string) {
  const from = Date.UTC(+fromDay.slice(0, 4), +fromDay.slice(5, 7) - 1, +fromDay.slice(8, 10));
  const to = Date.UTC(+toDay.slice(0, 4), +toDay.slice(5, 7) - 1, +toDay.slice(8, 10));
  return Math.round((to - from) / 86400000);
}

function urgencyFor(dueDate: string, today: string): { urgency: TaskUrgency; daysLate: number } {
  if (!dueDate) return { urgency: 'none', daysLate: 0 };
  const daysLate = daysBetween(dueDate, today);
  if (daysLate > 0) return { urgency: 'overdue', daysLate };
  if (daysLate === 0) return { urgency: 'today', daysLate };
  if (-daysLate <= SoonDays) return { urgency: 'soon', daysLate };
  return { urgency: 'later', daysLate };
}

const UrgencyRank: Record<TaskUrgency, number> = { overdue: 0, today: 2, soon: 3, later: 4, none: 5 };

/** Overdue first, then escalated, then by how soon the task is due. */
function taskRank(task: MyTask) {
  if (task.urgency !== 'overdue' && task.escalated) return 1;
  return UrgencyRank[task.urgency];
}

function sortTasks(a: MyTask, b: MyTask) {
  const rank = taskRank(a) - taskRank(b);
  if (rank !== 0) return rank;
  if (a.urgency === 'overdue') return b.daysLate - a.daysLate;
  return a.dueDate.localeCompare(b.dueDate);
}

export function formatDay(day: string) {
  if (!day) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${Number(day.slice(8, 10))} ${months[Number(day.slice(5, 7)) - 1] ?? ''} ${day.slice(0, 4)}`;
}

export function dueLabel(task: MyTask) {
  switch (task.urgency) {
    case 'overdue':
      return task.daysLate === 1 ? 'Overdue by 1 day' : `Overdue by ${task.daysLate} days`;
    case 'today':
      return 'Due today';
    case 'soon':
      return task.daysLate === -1 ? 'Due tomorrow' : `Due in ${-task.daysLate} days`;
    case 'later':
      return `Due ${formatDay(task.dueDate)}`;
    default:
      return task.kind === 'visit' ? 'In progress' : 'No due date';
  }
}

export function useHomeData(user: AuthUser, attendance: AttendanceStatus | null) {
  const employeeKey = String(user.employeeId || user.id || user.loginName);
  const prefsKey = `home_prefs_${employeeKey}`;
  const readKey = `notices_read_${employeeKey}`;
  const [tasks, setTasks] = useState<MyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [prefs, setPrefs] = useState<HomePrefs>(DefaultPrefs);
  const [readIds, setReadIds] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    void Promise.all([readJson<Partial<HomePrefs>>(prefsKey), readJson<string[]>(readKey)]).then(([savedPrefs, savedRead]) => {
      if (!active) return;
      if (savedPrefs && typeof savedPrefs === 'object') setPrefs({ ...DefaultPrefs, ...savedPrefs });
      if (Array.isArray(savedRead)) setReadIds(savedRead.filter((id) => typeof id === 'string'));
    });
    return () => {
      active = false;
    };
  }, [prefsKey, readKey]);

  const load = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      setError('');
      const today = localDay(new Date());
      const [tickets, ppm, visits] = await Promise.allSettled([
        fetchOpenServiceTickets(user.employeeId),
        fetchAssignedPpmTickets(user.employeeId),
        readMySiteVisits(user),
      ]);

      const next: MyTask[] = [];
      if (tickets.status === 'fulfilled') {
        for (const ticket of tickets.value) {
          const dueDate = normalizeDay(ticket.dueDate || (ticket.source === 'homecare' ? ticket.date : ''));
          next.push({
            key: `ticket:${ticket.key}`,
            kind: 'ticket',
            code: ticket.ticketCode || `#${ticket.id}`,
            typeLabel: ticket.type || (ticket.source === 'homecare' ? 'Home Care' : 'Ticket'),
            title: ticket.subService || ticket.service || ticket.message || 'Service ticket',
            subtitle: [ticket.site, ticket.city].filter(Boolean).join(' · '),
            status: ticket.status || 'Open',
            dueDate,
            escalated: ticket.group === 'escalated',
            ...urgencyFor(dueDate, today),
          });
        }
      }
      if (ppm.status === 'fulfilled') {
        for (const item of ppm.value) {
          if (item.isCompleted) continue;
          const dueDate = normalizeDay(item.dueDate || item.ppmDate);
          next.push({
            key: `ppm:${item.id}`,
            kind: 'ppm',
            code: item.ticketCode || `#${item.id}`,
            typeLabel: 'PPM',
            title: item.equipment || item.category || 'PPM ticket',
            subtitle: item.branch,
            status: item.status || 'Assigned',
            dueDate,
            escalated: false,
            ...urgencyFor(dueDate, today),
          });
        }
      }
      if (visits.status === 'fulfilled') {
        for (const visit of visits.value) {
          if (visit.status.toLowerCase().includes('complete')) continue;
          next.push({
            key: `visit:${visit.id}`,
            kind: 'visit',
            code: `SV-${visit.id}`,
            typeLabel: 'Site Visit',
            title: visit.title || 'Site visit',
            subtitle: [visit.company, visit.branch].filter(Boolean).join(' · '),
            status: visit.status || 'Started',
            dueDate: '',
            urgency: 'none',
            daysLate: 0,
            escalated: false,
          });
        }
      }

      next.sort(sortTasks);
      setTasks(next);

      const failures = [tickets, ppm].filter((result): result is PromiseRejectedResult => result.status === 'rejected');
      const messages = failures.map((failure) => (failure.reason instanceof Error ? failure.reason.message : 'Could not load some tasks.'));
      if (failures.length === 2) {
        setError(messages[0] || 'Could not load your tasks.');
        setWarning('');
      } else {
        setWarning(messages.join(' '));
        setUpdatedAt(new Date());
      }
      setLoading(false);
      setRefreshing(false);
    },
    [user],
  );

  useEffect(() => {
    void load('initial');
  }, [load]);

  const notices = useMemo(() => {
    const today = localDay(new Date());
    const list: Notice[] = [];

    if (prefs.attendance && attendance) {
      if (!attendance.inTimeStatus) {
        list.push({
          id: `attendance:in:${today}`,
          category: 'attendance',
          tone: 'warning',
          icon: 'clock-alert-outline',
          title: 'Punch in pending',
          body: "You haven't marked your attendance today. Open Work Zone to punch in.",
          action: 'workZone',
        });
      } else if (!attendance.outTimeStatus && new Date().getHours() >= 18) {
        list.push({
          id: `attendance:out:${today}`,
          category: 'attendance',
          tone: 'info',
          icon: 'logout-variant',
          title: 'Remember to punch out',
          body: `You punched in at ${attendance.inTime ?? '--:--'}. Punch out before you leave.`,
          action: 'workZone',
        });
      }
    }

    for (const task of tasks) {
      const action: NoticeAction = task.kind === 'visit' ? 'visits' : 'tickets';
      const where = task.subtitle ? ` at ${task.subtitle}` : '';
      if (prefs.escalation && task.escalated) {
        list.push({
          id: `escalated:${task.key}`,
          category: 'escalation',
          tone: 'danger',
          icon: 'alert-decagram-outline',
          title: `${task.code} was escalated`,
          body: `${task.title}${where} needs priority attention.`,
          action,
        });
      }
      if (prefs.due && task.urgency === 'overdue') {
        list.push({
          id: `overdue:${task.key}:${today}`,
          category: 'due',
          tone: 'danger',
          icon: 'calendar-alert',
          title: `${task.code} is overdue`,
          body: `${task.title}${where} was due on ${formatDay(task.dueDate)}.`,
          action,
        });
      } else if (prefs.due && task.urgency === 'today') {
        list.push({
          id: `today:${task.key}:${today}`,
          category: 'due',
          tone: 'warning',
          icon: 'calendar-today',
          title: `${task.code} is due today`,
          body: `${task.title}${where}.`,
          action,
        });
      }
      if (prefs.visit && task.kind === 'visit') {
        const observed = task.status.toLowerCase().includes('observation');
        list.push({
          id: `visit:${task.key}:${task.status}`,
          category: 'visit',
          tone: 'info',
          icon: 'map-marker-path',
          title: observed ? `Submit summary for ${task.title}` : `Add observation for ${task.title}`,
          body: observed
            ? 'Observation recorded. Fill the visitor summary to complete this visit.'
            : 'Site visit started. Record your observation to continue.',
          action: 'visits',
        });
      }
    }

    return list.slice(0, NoticeLimit);
  }, [attendance, prefs, tasks]);

  const readSet = useMemo(() => new Set(readIds), [readIds]);
  const unreadCount = notices.filter((notice) => !readSet.has(notice.id)).length;

  const saveRead = useCallback(
    (next: string[]) => {
      const current = new Set(notices.map((notice) => notice.id));
      const pruned = Array.from(new Set(next)).filter((id) => current.has(id));
      setReadIds(pruned);
      void writeJson(readKey, pruned);
    },
    [notices, readKey],
  );

  const markRead = useCallback((id: string) => saveRead([...readIds, id]), [readIds, saveRead]);
  const markAllRead = useCallback(() => saveRead(notices.map((notice) => notice.id)), [notices, saveRead]);

  const setPref = useCallback(
    (category: NoticeCategory, value: boolean) => {
      setPrefs((current) => {
        const next = { ...current, [category]: value };
        void writeJson(prefsKey, next);
        return next;
      });
    },
    [prefsKey],
  );
  return {
    tasks,
    loading,
    refreshing,
    error,
    warning,
    updatedAt,
    refresh: () => load('refresh'),
    notices,
    readSet,
    unreadCount,
    markRead,
    markAllRead,
    prefs,
    setPref,
  };
}

export type HomeData = ReturnType<typeof useHomeData>;
