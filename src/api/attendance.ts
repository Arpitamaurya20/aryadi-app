import * as Location from 'expo-location';
import { apiRequest } from './client';

export type AttendanceStatus = {
  inTimeStatus: boolean;
  outTimeStatus: boolean;
  inTime: string | null;
  outTime: string | null;
  checkedIn: boolean;
  alreadyCheckedOut: boolean;
  canCheckout: boolean;
  hasCheckinImage: boolean;
  hasCheckoutImage: boolean;
  hoursWorked: number;
  minutesWorked: number;
  remainingMinutes: number;
  minHoursRequired: number;
  message: string | null;
  employeeName: string | null;
  designation: string | null;
};

export type PunchLocation = {
  latitude: string;
  longitude: string;
  accuracy: number | null;
  address: string;
};

type AttendanceRecord = {
  InTime?: string | null;
  OutTime?: string | null;
  RecordDate?: string | null;
  CheckinImage?: string | null;
  CheckoutImage?: string | null;
};

type AttendanceStatusApi = {
  error?: boolean | number | string;
  message?: string;
  InTimeStatus?: number | boolean;
  OutTimeStatus?: number | boolean;
  EmployeeName?: string;
  EmployeeDesignation?: string;
  data?: {
    attendace_records?: AttendanceRecord | '' | null;
    checkout_eligibility?: {
      canCheckout?: boolean;
      checkedIn?: boolean;
      alreadyCheckedOut?: boolean;
      checkInTime?: string | null;
      hoursWorked?: number;
      minutesWorked?: number;
      remainingMinutes?: number;
      minHoursRequired?: number;
      message?: string;
    };
  };
};

type PunchApiResponse = {
  error?: boolean | number | string;
  message?: string;
};

function isApiError(error: AttendanceStatusApi['error']) {
  return error === true || error === 1 || error === '1' || error === 'true';
}

function asFlag(value: number | boolean | undefined) {
  return value === true || value === 1;
}

/** Convert `14:30:05` or `2026-09-21 14:30:05` → `2:30 PM` */
export function formatPunchTime(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const match = /(\d{1,2}):(\d{2})(?::\d{2})?/.exec(trimmed);
  if (!match) return trimmed;

  let hours = Number(match[1]);
  const minutes = match[2];
  const suffix = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${hours}:${minutes} ${suffix}`;
}

/** Parse `YYYY-MM-DD` / `DD-MM-YYYY` / `DD/MM/YYYY` as local calendar date. */
export function parseJoiningDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === '0000-00-00') return null;

  let year: number;
  let month: number;
  let day: number;

  const iso = /^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})/.exec(trimmed);
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/.exec(trimmed);

  if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]) - 1;
    day = Number(iso[3]);
  } else if (dmy) {
    day = Number(dmy[1]);
    month = Number(dmy[2]) - 1;
    year = Number(dmy[3]);
  } else {
    return null;
  }

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  return new Date(year, month, day);
}

/** Normalize any supported joining date string to `YYYY-MM-DD`. */
export function normalizeJoiningDate(value: string | null | undefined): string | null {
  const date = parseJoiningDate(value);
  if (!date) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatJoiningDate(value: string | null | undefined) {
  const date = parseJoiningDate(value);
  if (!date) return null;
  const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${date.getDate()} ${monthsShort[date.getMonth()]}, ${date.getFullYear()}`;
}

/**
 * True when `asOf` (default today) is before the employee's joining date.
 * Used to block punch-in and leave apply before joining.
 */
export function isBeforeJoiningDate(joiningDate: string | null | undefined, asOf: Date = new Date()) {
  const join = parseJoiningDate(joiningDate);
  if (!join) return false;
  const day = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate());
  return day.getTime() < join.getTime();
}

/**
 * Today's punch-in / punch-out status.
 * POST get_employee_attendance_status.php { EmployeeID }
 */
export async function fetchAttendanceStatus(employeeId: number): Promise<AttendanceStatus> {
  if (!employeeId || employeeId <= 0) {
    throw new Error('Missing employee id.');
  }

  const payload = await apiRequest<AttendanceStatusApi>('get_employee_attendance_status.php', {
    method: 'POST',
    body: { EmployeeID: String(employeeId) },
  });

  if (isApiError(payload.error)) {
    throw new Error(payload.message || 'Unable to load attendance status.');
  }

  const record = payload.data?.attendace_records;
  const attendance = record && typeof record === 'object' ? record : null;
  const eligibility = payload.data?.checkout_eligibility;

  const inTimeRaw = attendance?.InTime || eligibility?.checkInTime || null;
  const outTimeRaw = attendance?.OutTime || null;

  const minutesWorked = Number(eligibility?.minutesWorked ?? 0);
  const remainingMinutes = Number(eligibility?.remainingMinutes ?? 0);
  const minHoursRequired = Number(eligibility?.minHoursRequired ?? 2);
  const canCheckout = Boolean(eligibility?.canCheckout);

  return {
    inTimeStatus: asFlag(payload.InTimeStatus) || Boolean(inTimeRaw),
    outTimeStatus: asFlag(payload.OutTimeStatus) || Boolean(outTimeRaw),
    inTime: formatPunchTime(inTimeRaw),
    outTime: formatPunchTime(outTimeRaw),
    checkedIn: Boolean(eligibility?.checkedIn) || asFlag(payload.InTimeStatus) || Boolean(inTimeRaw),
    alreadyCheckedOut: Boolean(eligibility?.alreadyCheckedOut) || asFlag(payload.OutTimeStatus),
    canCheckout,
    hasCheckinImage: Boolean(attendance?.CheckinImage && String(attendance.CheckinImage).trim()),
    hasCheckoutImage: Boolean(attendance?.CheckoutImage && String(attendance.CheckoutImage).trim()),
    hoursWorked: Number(eligibility?.hoursWorked ?? 0),
    minutesWorked,
    remainingMinutes,
    minHoursRequired,
    message: eligibility?.message || payload.message || null,
    employeeName: payload.EmployeeName || null,
    designation: payload.EmployeeDesignation || null,
  };
}

/** Office punch coordinates (Sector 62 / BHA Millenium) used for punch_in API. */
export const PUNCH_LATITUDE = '28.612521224982984';
export const PUNCH_LONGITUDE = '77.3669209576468';
export const PUNCH_ADDRESS = 'BHA Millenium Road, Sector 62, Noida, 201301';

/** Request location permission via expo-location, then return punch coordinates. */
export async function getPunchLocation(): Promise<PunchLocation> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Location permission is required for attendance.');
  }

  // Ensure device GPS is available (expo-location)
  let accuracy: number | null = null;
  try {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    accuracy = position.coords.accuracy ?? null;
  } catch {
    // Still punch with configured office coordinates
  }

  return {
    latitude: PUNCH_LATITUDE,
    longitude: PUNCH_LONGITUDE,
    accuracy,
    address: PUNCH_ADDRESS,
  };
}

export type PunchPayload = {
  employeeId: number;
  latitude?: string;
  longitude?: string;
  location?: string;
  address?: string;
  accuracy?: number | null;
  /** raw base64 without data-url prefix (required for punch_in) */
  imageData: string;
  /** Employee date of joining `YYYY-MM-DD` — punch-in blocked before this day */
  joiningDate?: string | null;
};

/**
 * Punch in via employeenewapi/punch_in.php
 * Payload shape:
 * {
 *   EmployeeID, Latitude, Longitude, Location, Address, InLocation, imageData
 * }
 */
export async function punchIn(input: PunchPayload) {
  if (isBeforeJoiningDate(input.joiningDate)) {
    const label = formatJoiningDate(input.joiningDate) || 'your joining date';
    throw new Error(`Punch-in is not allowed before joining date (${label}).`);
  }
  if (!input.imageData?.trim()) {
    throw new Error('Selfie image is required for punch in.');
  }

  const latitude = input.latitude || PUNCH_LATITUDE;
  const longitude = input.longitude || PUNCH_LONGITUDE;
  const address = input.address || input.location || PUNCH_ADDRESS;

  const body = {
    EmployeeID: String(input.employeeId),
    Latitude: latitude,
    Longitude: longitude,
    Location: address,
    Address: address,
    InLocation: address,
    imageData: input.imageData,
  };

  const payload = await apiRequest<PunchApiResponse>('employeenewapi/punch_in.php', {
    method: 'POST',
    auth: true,
    body,
  });

  if (isApiError(payload.error)) {
    throw new Error(payload.message || 'Unable to punch in.');
  }

  return payload.message || 'Attendance punched in';
}

/**
 * Punch out via employeenewapi/punch_out.php
 * Payload:
 * {
 *   EmployeeID, Latitude, Longitude, Location, Address, OutLocation, imageData
 * }
 * Blocked by API until 2 hours after punch-in.
 */
export async function punchOut(input: PunchPayload) {
  if (!input.imageData?.trim()) {
    throw new Error('Selfie image is required for punch out.');
  }

  const latitude = input.latitude || PUNCH_LATITUDE;
  const longitude = input.longitude || PUNCH_LONGITUDE;
  const address = input.address || input.location || PUNCH_ADDRESS;

  const body = {
    EmployeeID: String(input.employeeId),
    Latitude: latitude,
    Longitude: longitude,
    Location: address,
    Address: address,
    OutLocation: address,
    imageData: input.imageData,
  };

  const payload = await apiRequest<PunchApiResponse>('employeenewapi/punch_out.php', {
    method: 'POST',
    auth: true,
    body,
  });

  if (isApiError(payload.error)) {
    throw new Error(payload.message || 'Unable to punch out.');
  }

  return payload.message || 'Attendance punched out';
}

export type AttendanceRequestType = 'Regularization' | 'WFH';

export type RegularizationEntryInput = {
  recordDate: string;
  inTime: string;
  outTime: string;
  reason?: string;
};

export type RequestAttendanceRegularizationInput = {
  employeeId: number;
  entries: RegularizationEntryInput[];
  /** Shared reason when submitting a batch; falls back to per-entry reasons. */
  reason?: string;
  type?: AttendanceRequestType;
};

type RegularizationApi = {
  error?: boolean | number | string;
  message?: string;
  attendance_ids?: Array<number | string>;
  saved_count?: number;
  failed_count?: number;
  errors?: string[];
};

/** Normalize `9:00` / `09:00` / `09:00:00` → `HH:MM:SS` for the API. */
export function normalizeRegularizationTime(value: string): string | null {
  const trimmed = value.trim();
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? 0);
  if (hour > 23 || minute > 59 || second > 59) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
}

/**
 * Submit attendance regularization or WFH.
 * POST employeenewapi/request_attendance_regularization.php
 *
 * Single:
 * { EmployeeID, type: "Regularization"|"WFH", reason, record_date, in_time, out_time }
 *
 * Batch:
 * { EmployeeID, type, reason, entries: [{ record_date, in_time, out_time }] }
 */
export async function requestAttendanceRegularization(
  input: RequestAttendanceRegularizationInput,
): Promise<{ message: string; savedCount: number; attendanceIds: number[] }> {
  if (!input.employeeId || input.employeeId <= 0) {
    throw new Error('Missing employee id.');
  }
  if (!input.entries.length) {
    throw new Error('At least one attendance entry is required.');
  }

  const requestType: AttendanceRequestType = input.type === 'WFH' ? 'WFH' : 'Regularization';
  const label = requestType === 'WFH' ? 'WFH' : 'attendance regularization';

  const normalizedEntries = input.entries.map((entry, index) => {
    const recordDate = entry.recordDate.trim();
    const inTime = normalizeRegularizationTime(entry.inTime);
    const outTime = normalizeRegularizationTime(entry.outTime);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(recordDate)) {
      throw new Error(`Entry #${index + 1}: invalid date.`);
    }
    if (!inTime) {
      throw new Error(`Entry #${index + 1}: enter in time as HH:MM.`);
    }
    if (!outTime) {
      throw new Error(`Entry #${index + 1}: enter out time as HH:MM.`);
    }
    return {
      record_date: recordDate,
      in_time: inTime,
      out_time: outTime,
      reason: (entry.reason || '').trim(),
    };
  });

  const reason =
    (input.reason || '').trim() ||
    normalizedEntries
      .map((entry) => entry.reason)
      .filter(Boolean)
      .join(' | ') ||
    '';

  if (!reason) {
    throw new Error('Please enter a reason.');
  }

  const body: Record<string, unknown> = {
    EmployeeID: input.employeeId,
    type: requestType,
    reason,
  };

  if (normalizedEntries.length === 1) {
    body.record_date = normalizedEntries[0].record_date;
    body.in_time = normalizedEntries[0].in_time;
    body.out_time = normalizedEntries[0].out_time;
  } else {
    body.entries = normalizedEntries.map(({ record_date, in_time, out_time }) => ({
      record_date,
      in_time,
      out_time,
    }));
  }

  const payload = await apiRequest<RegularizationApi>(
    'employeenewapi/request_attendance_regularization.php',
    {
      method: 'POST',
      auth: true,
      body,
    },
  );

  if (isApiError(payload.error)) {
    const detail =
      Array.isArray(payload.errors) && payload.errors.length > 0
        ? ` ${payload.errors.join(' ')}`
        : '';
    throw new Error((payload.message || `Unable to submit ${label}.`) + detail);
  }

  return {
    message:
      payload.message ||
      (requestType === 'WFH'
        ? 'WFH request submitted successfully.'
        : 'Attendance regularization submitted successfully.'),
    savedCount: Number(payload.saved_count ?? payload.attendance_ids?.length ?? normalizedEntries.length),
    attendanceIds: Array.isArray(payload.attendance_ids)
      ? payload.attendance_ids.map((id) => Number(id)).filter((id) => id > 0)
      : [],
  };
}

export type AttendanceHistoryStatus = 'approved' | 'pending' | 'rejected';

export type AttendanceHistoryRecord = {
  day: number;
  status: AttendanceHistoryStatus;
  dayStatus: 'present' | 'pending' | 'rejected';
  inTime: string;
  outTime: string | null;
  duration: string | null;
};

type AttendanceHistoryApi = {
  error?: boolean | number | string;
  message?: string;
  data?: Array<{
    RecordDate?: string | null;
    InTime?: string | null;
    OutTime?: string | null;
    ApprovalStatus?: string | null;
    duration?: string | null;
  }>;
};

/** POST employee/get_attendance_records.php for one employee and month. */
export async function fetchAttendanceRecords(employeeId: number, year: number, month: number) {
  const payload = await apiRequest<AttendanceHistoryApi>('employee/get_attendance_records.php', {
    method: 'POST',
    auth: true,
    body: {
      s_year: year,
      s_month: month,
      EmployeeID: String(employeeId),
    },
  });

  if (isApiError(payload.error)) {
    throw new Error(payload.message || 'Unable to load attendance records.');
  }

  const byDay = new Map<number, AttendanceHistoryRecord>();
  for (const row of payload.data ?? []) {
    const day = recordDay(row.RecordDate, year, month);
    if (!day || byDay.has(day)) continue;
    const approval = mapAttendanceApproval(row.ApprovalStatus);
    const outTime = cleanTime(row.OutTime);
    const duration = cleanDuration(row.duration);
    byDay.set(day, {
      day,
      status: approval.status,
      dayStatus: approval.dayStatus,
      inTime: cleanTime(row.InTime) ?? '--:--',
      outTime,
      duration,
    });
  }

  return [...byDay.values()].sort((a, b) => b.day - a.day);
}

function recordDay(value: string | null | undefined, year: number, month: number) {
  const match = String(value ?? '').trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) return null;
  const recordYear = Number(match[1]);
  const recordMonth = Number(match[2]);
  const day = Number(match[3]);
  if (recordYear !== year || recordMonth !== month || day < 1 || day > 31) return null;
  return day;
}

function mapAttendanceApproval(value: string | null | undefined): {
  status: AttendanceHistoryStatus;
  dayStatus: AttendanceHistoryRecord['dayStatus'];
} {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'approved') return { status: 'approved', dayStatus: 'present' };
  if (normalized === 'rejected') return { status: 'rejected', dayStatus: 'rejected' };
  return { status: 'pending', dayStatus: 'pending' };
}

function cleanTime(value: string | null | undefined) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed || trimmed === '00:00:00' || trimmed.toUpperCase() === 'N.A.') return null;
  return trimmed;
}

function cleanDuration(value: string | null | undefined) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed || trimmed.toUpperCase() === 'N.A.') return null;
  return trimmed;
}

/** Strip `data:image/...;base64,` prefix if present. */
export function toRawBase64(dataUrlOrBase64: string) {
  const comma = dataUrlOrBase64.indexOf(',');
  if (dataUrlOrBase64.startsWith('data:') && comma >= 0) {
    return dataUrlOrBase64.slice(comma + 1);
  }
  return dataUrlOrBase64;
}
