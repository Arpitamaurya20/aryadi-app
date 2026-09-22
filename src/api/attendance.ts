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

/** Strip `data:image/...;base64,` prefix if present. */
export function toRawBase64(dataUrlOrBase64: string) {
  const comma = dataUrlOrBase64.indexOf(',');
  if (dataUrlOrBase64.startsWith('data:') && comma >= 0) {
    return dataUrlOrBase64.slice(comma + 1);
  }
  return dataUrlOrBase64;
}
