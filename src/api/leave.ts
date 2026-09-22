import { apiRequest } from './client';

export type LeaveTypeCode = 'CL' | 'SL' | 'COMPOFF' | 'UNPAID' | string;

export type LeaveTypeOption = {
  code: LeaveTypeCode;
  name: string;
  label: string;
};

export type LeaveBalanceBucket = {
  available: number;
  entitledThisMonth: number;
  carriedIn: number;
  used: number;
  pending: number;
};

export type LeaveApplyScreen = {
  leaveTypes: LeaveTypeOption[];
  durations: string[];
  halfDaySessions: Array<{ code: string; label: string }>;
  halfDayEnabled: boolean;
  maxDaysPerApplication: number;
  applyHint: string;
  financialYearLabel: string | null;
  cl: LeaveBalanceBucket;
  sl: LeaveBalanceBucket;
  compOffAvailable: number;
  compOffEnabled: boolean;
};

type LeaveApplyScreenApi = {
  error?: boolean | number | string;
  message?: string;
  balance?: {
    cl?: {
      available?: number;
      entitled_this_month?: number;
      carried_in?: number;
      used?: number;
      pending?: number;
    };
    sl?: {
      available?: number;
      entitled_this_month?: number;
      carried_in?: number;
      used?: number;
      pending?: number;
    };
    comp_off?: {
      available?: number;
      enabled?: boolean;
    };
    financial_year_label?: string;
  };
  leave_types?: Array<{
    code?: string;
    name?: string;
    label?: string;
  }>;
  durations?: string[];
  half_day_sessions?: Array<{
    code?: string;
    label?: string;
  }>;
  policy?: {
    half_day_enabled?: boolean;
  };
  apply_rules?: {
    max_days_per_application?: number;
    half_day_enabled?: boolean;
  };
  apply_hint?: string;
};

function isApiError(error: LeaveApplyScreenApi['error']) {
  return error === true || error === 1 || error === '1' || error === 'true';
}

function asNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

type BalanceRaw = {
  available?: number;
  entitled_this_month?: number;
  carried_in?: number;
  used?: number;
  pending?: number;
};

function mapBucket(raw?: BalanceRaw | null): LeaveBalanceBucket {
  return {
    available: asNumber(raw?.available),
    entitledThisMonth: asNumber(raw?.entitled_this_month),
    carriedIn: asNumber(raw?.carried_in),
    used: asNumber(raw?.used),
    pending: asNumber(raw?.pending),
  };
}

/**
 * Leave apply screen bootstrap data.
 * POST employee-leave/get_leave_apply_screen.php { EmployeeID }
 */
export async function fetchLeaveApplyScreen(employeeId: number): Promise<LeaveApplyScreen> {
  if (!employeeId || employeeId <= 0) {
    throw new Error('Missing employee id.');
  }

  const payload = await apiRequest<LeaveApplyScreenApi>('employee-leave/get_leave_apply_screen.php', {
    method: 'POST',
    body: { EmployeeID: String(employeeId) },
  });

  if (isApiError(payload.error)) {
    throw new Error(payload.message || 'Unable to load leave apply screen.');
  }

  const leaveTypes = (payload.leave_types ?? [])
    .map((item) => ({
      code: String(item.code || '').trim(),
      name: String(item.name || item.label || item.code || '').trim(),
      label: String(item.label || item.name || item.code || '').trim(),
    }))
    .filter((item) => item.code);

  const halfDayEnabled = Boolean(
    payload.apply_rules?.half_day_enabled ?? payload.policy?.half_day_enabled ?? true,
  );

  return {
    leaveTypes:
      leaveTypes.length > 0
        ? leaveTypes
        : [
            { code: 'CL', name: 'Casual Leave', label: 'CL — Casual Leave' },
            { code: 'SL', name: 'Sick Leave', label: 'SL — Sick Leave' },
            { code: 'COMPOFF', name: 'Compensatory Off', label: 'Comp-off' },
          ],
    durations: payload.durations?.length ? payload.durations : ['Full Day', 'Half Day'],
    halfDaySessions: (payload.half_day_sessions ?? [])
      .map((item) => ({
        code: String(item.code || '').trim(),
        label: String(item.label || item.code || '').trim(),
      }))
      .filter((item) => item.code),
    halfDayEnabled,
    maxDaysPerApplication: asNumber(payload.apply_rules?.max_days_per_application, 2),
    applyHint:
      payload.apply_hint?.trim() ||
      'Financial year Apr–Mar · working days only · check policy for max days per request',
    financialYearLabel: payload.balance?.financial_year_label ?? null,
    cl: mapBucket(payload.balance?.cl),
    sl: mapBucket(payload.balance?.sl),
    compOffAvailable: asNumber(payload.balance?.comp_off?.available),
    compOffEnabled: payload.balance?.comp_off?.enabled !== false,
  };
}

export type ValidateLeaveInput = {
  employeeId: number;
  typeOfLeave: string;
  fromDate: string;
  toDate: string;
  duration: string;
  halfDaySession?: string;
  reasonOfLeave: string;
  compOffId?: number;
};

export type ValidateLeaveResult = {
  message: string;
  daysToDeduct: number;
  isAdvance: boolean;
  balanceAvailable: number | null;
  balanceAfter: number | null;
  daysCalculated: number | null;
  maxConsecutiveDays: number | null;
};

type ValidateLeaveApi = {
  error?: boolean | number | string;
  message?: string;
  days_to_deduct?: number;
  is_advance?: boolean;
  balance_available?: number | null;
  balance_after?: number | null;
  days_calculated?: number | null;
  max_consecutive_days?: number | null;
};

/**
 * Validate a leave application before submit.
 * POST employee-leave/validate_leave.php
 * {
 *   EmployeeID, TypeOfLeave, FromDate, ToDate, Duration, ReasonOfLeave
 *   [, HalfDaySession]
 * }
 */
export async function validateLeave(input: ValidateLeaveInput): Promise<ValidateLeaveResult> {
  if (!input.employeeId || input.employeeId <= 0) {
    throw new Error('Missing employee id.');
  }
  if (!input.typeOfLeave.trim()) {
    throw new Error('Leave type is required.');
  }
  if (!input.fromDate || !input.toDate) {
    throw new Error('From and to dates are required.');
  }
  if (!input.reasonOfLeave.trim()) {
    throw new Error('Leave reason is required.');
  }

  const body: Record<string, string | number> = {
    EmployeeID: input.employeeId,
    TypeOfLeave: input.typeOfLeave.trim().toUpperCase(),
    FromDate: input.fromDate,
    ToDate: input.toDate,
    Duration: input.duration,
    ReasonOfLeave: input.reasonOfLeave.trim(),
  };

  if (input.halfDaySession) {
    body.HalfDaySession = input.halfDaySession;
  }
  if (input.compOffId && input.compOffId > 0) {
    body.CompOffId = input.compOffId;
  }

  const payload = await apiRequest<ValidateLeaveApi>('employee-leave/validate_leave.php', {
    method: 'POST',
    body,
  });

  if (isApiError(payload.error)) {
    throw new Error(payload.message || 'Leave validation failed.');
  }

  return {
    message: payload.message || 'Leave can be applied.',
    daysToDeduct: asNumber(payload.days_to_deduct),
    isAdvance: Boolean(payload.is_advance),
    balanceAvailable:
      payload.balance_available == null ? null : asNumber(payload.balance_available),
    balanceAfter: payload.balance_after == null ? null : asNumber(payload.balance_after),
    daysCalculated:
      payload.days_calculated == null ? null : asNumber(payload.days_calculated),
    maxConsecutiveDays:
      payload.max_consecutive_days == null ? null : asNumber(payload.max_consecutive_days),
  };
}

export type LeaveHistoryItem = {
  id: number;
  typeOfLeave: string;
  reason: string;
  fromDate: string;
  toDate: string;
  duration: string;
  leaveDays: number;
  halfDaySession: string | null;
  status: string;
  rejectionReason: string | null;
  canCancel: boolean;
  createdDate: string | null;
};

export type LeaveHistoryResult = {
  leaves: LeaveHistoryItem[];
  balance: {
    clAvailable: number;
    slAvailable: number;
    compOffAvailable: number;
  } | null;
};

type LeaveHistoryRowApi = {
  ID?: number;
  leave_id?: number;
  TypeOfLeave?: string;
  type_of_leave?: string;
  ReasonOfLeave?: string;
  reason?: string;
  FromDate?: string;
  from_date?: string;
  ToDate?: string;
  to_date?: string;
  Duration?: string;
  duration?: string;
  LeaveDays?: number | null;
  leave_days?: number | null;
  HalfDaySession?: string | null;
  half_day_session?: string | null;
  Status?: string;
  status?: string;
  RejectionReason?: string | null;
  rejection_reason?: string | null;
  can_cancel?: boolean;
  CreatedDate?: string | null;
};

type LeaveHistoryApi = {
  error?: boolean | number | string;
  message?: string;
  data?: LeaveHistoryRowApi[];
  leaves?: LeaveHistoryRowApi[];
  balance?: {
    cl?: { available?: number };
    sl?: { available?: number };
    comp_off?: { available?: number };
  };
};

function mapLeaveHistoryRow(row: LeaveHistoryRowApi): LeaveHistoryItem {
  return {
    id: Number(row.leave_id ?? row.ID ?? 0),
    typeOfLeave: String(row.TypeOfLeave ?? row.type_of_leave ?? '').trim(),
    reason: String(row.ReasonOfLeave ?? row.reason ?? '').trim(),
    fromDate: String(row.FromDate ?? row.from_date ?? '').trim(),
    toDate: String(row.ToDate ?? row.to_date ?? '').trim(),
    duration: String(row.Duration ?? row.duration ?? 'Full Day').trim() || 'Full Day',
    leaveDays: asNumber(row.LeaveDays ?? row.leave_days),
    halfDaySession: row.HalfDaySession ?? row.half_day_session ?? null,
    status: String(row.Status ?? row.status ?? 'Pending').trim() || 'Pending',
    rejectionReason: row.RejectionReason ?? row.rejection_reason ?? null,
    canCancel: Boolean(row.can_cancel),
    createdDate: row.CreatedDate ?? null,
  };
}

/**
 * Employee leave history.
 * POST employee-leave/get_leave_history.php
 * { EmployeeID, limit, include_balance }
 */
export async function fetchLeaveHistory(
  employeeId: number,
  options: { limit?: number; includeBalance?: boolean } = {},
): Promise<LeaveHistoryResult> {
  if (!employeeId || employeeId <= 0) {
    throw new Error('Missing employee id.');
  }

  const limit = options.limit ?? 50;
  const includeBalance = options.includeBalance !== false;

  const payload = await apiRequest<LeaveHistoryApi>('employee-leave/get_leave_history.php', {
    method: 'POST',
    body: {
      EmployeeID: employeeId,
      limit,
      include_balance: includeBalance,
    },
  });

  if (isApiError(payload.error)) {
    throw new Error(payload.message || 'Unable to load leave history.');
  }

  const rows = payload.leaves ?? payload.data ?? [];
  const balance = payload.balance
    ? {
        clAvailable: asNumber(payload.balance.cl?.available),
        slAvailable: asNumber(payload.balance.sl?.available),
        compOffAvailable: asNumber(payload.balance.comp_off?.available),
      }
    : null;

  return {
    leaves: rows.map(mapLeaveHistoryRow),
    balance,
  };
}

export type CompOffItem = {
  id: number;
  workDate: string;
  creditDays: number;
  reason: string;
  status: string;
  expiresAt: string | null;
  usedLeaveId: number;
};

export type CompOffResult = {
  items: CompOffItem[];
  available: number;
  pendingCount: number;
  enabled: boolean;
};

type CompOffRowApi = {
  id?: number;
  employee_id?: number;
  work_date?: string;
  credit_days?: number | string;
  reason?: string;
  status?: string;
  expires_at?: string | null;
  used_leave_id?: number | string | null;
  created_by?: string | null;
  approved_at?: string | null;
};

type CompOffApi = {
  error?: boolean | number | string;
  message?: string;
  data?: CompOffRowApi[];
  comp_off_list?: CompOffRowApi[];
  balance?: {
    comp_off?: {
      available?: number;
      enabled?: boolean;
    };
  };
};

function mapCompOffRow(row: CompOffRowApi): CompOffItem {
  return {
    id: Number(row.id ?? 0),
    workDate: String(row.work_date ?? '').trim(),
    creditDays: asNumber(row.credit_days),
    reason: String(row.reason ?? '').trim(),
    status: String(row.status ?? 'Pending').trim() || 'Pending',
    expiresAt: row.expires_at ?? null,
    usedLeaveId: asNumber(row.used_leave_id),
  };
}

/**
 * Comp-off credits list + balance.
 * POST employee-leave/get_comp_off.php { EmployeeID }
 */
export async function fetchCompOff(employeeId: number): Promise<CompOffResult> {
  if (!employeeId || employeeId <= 0) {
    throw new Error('Missing employee id.');
  }

  const payload = await apiRequest<CompOffApi>('employee-leave/get_comp_off.php', {
    method: 'POST',
    body: { EmployeeID: employeeId },
  });

  if (isApiError(payload.error)) {
    throw new Error(payload.message || 'Unable to load comp-off list.');
  }

  const items = (payload.comp_off_list ?? payload.data ?? []).map(mapCompOffRow);
  const pendingCount = items.filter((item) => item.status.toLowerCase() === 'pending').length;

  return {
    items,
    available: asNumber(payload.balance?.comp_off?.available),
    pendingCount,
    enabled: payload.balance?.comp_off?.enabled !== false,
  };
}
