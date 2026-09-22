import { apiRequest } from './client';

export type ConvenienceItem = {
  id: number;
  from: string;
  to: string;
  amount: number;
  date: string;
  remarks: string;
  status: string;
};

type ConvenienceRowApi = {
  ID?: number | string;
  EmployeeID?: number | string;
  ConvenienceFrom?: string | null;
  ConvenienceTo?: string | null;
  ConvenienceAmount?: number | string | null;
  ConvenienceDate?: string | null;
  Reference?: string | null;
  Status?: number | string | null;
};

type ConvenienceListApi = {
  error?: boolean | number | string;
  message?: string;
  data?: ConvenienceRowApi[] | Record<string, never> | null;
};

function isApiError(error: ConvenienceListApi['error']) {
  return error === true || error === 1 || error === '1' || error === 'true';
}

function asNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function mapStatus(status: number | string | null | undefined) {
  const key = String(status ?? '').trim();
  const map: Record<string, string> = {
    '1': 'Pending Supervisor',
    '2': 'Pending HR',
    '3': 'Pending Finance',
    '4': 'Pending CFO',
    '5': 'Pending Payment',
    '6': 'Payment Done',
    '-1': 'Rejected by Supervisor',
    '-2': 'Rejected by HR',
    '-3': 'Rejected by Finance',
    '-4': 'Rejected by CFO',
  };
  return map[key] || (key ? `Status ${key}` : 'Pending');
}

function mapRow(row: ConvenienceRowApi): ConvenienceItem {
  return {
    id: asNumber(row.ID),
    from: String(row.ConvenienceFrom ?? '').trim() || '—',
    to: String(row.ConvenienceTo ?? '').trim() || '—',
    amount: asNumber(row.ConvenienceAmount),
    date: String(row.ConvenienceDate ?? '').trim() || '—',
    remarks: String(row.Reference ?? '').trim() || '—',
    status: mapStatus(row.Status),
  };
}

/**
 * Employee convenience / conveyance list.
 * POST get_employee_covenience.php { EmployeeID }
 */
export async function fetchEmployeeConvenience(employeeId: number): Promise<ConvenienceItem[]> {
  if (!employeeId || employeeId <= 0) {
    throw new Error('Missing employee id.');
  }

  const payload = await apiRequest<ConvenienceListApi>('get_employee_covenience.php', {
    method: 'POST',
    body: { EmployeeID: String(employeeId) },
  });

  if (isApiError(payload.error)) {
    throw new Error(payload.message || 'Unable to load convenience list.');
  }

  const rows = Array.isArray(payload.data) ? payload.data : [];
  return rows.map(mapRow);
}

export type AddConvenienceInput = {
  employeeId: number;
  from: string;
  to: string;
  amount: number;
  date: string;
  reference: string;
  createdBy: string;
};

type AddConvenienceApi = {
  error?: boolean | number | string;
  message?: string;
  last_insert_id?: number | string;
};

/**
 * Add employee convenience / conveyance charge.
 * POST add_employee_convenience.php
 * {
 *   EmployeeID, ConvenienceFrom, ConvenienceTo, ConvenienceAmount,
 *   ConvenienceDate, Reference, CreatedBy
 * }
 */
export async function addEmployeeConvenience(input: AddConvenienceInput): Promise<{ id: number; message: string }> {
  if (!input.employeeId || input.employeeId <= 0) {
    throw new Error('Missing employee id.');
  }
  if (!input.from.trim() || !input.to.trim()) {
    throw new Error('From and to places are required.');
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error('Enter a valid amount.');
  }
  if (!input.date.trim()) {
    throw new Error('Convenience date is required.');
  }
  if (!input.createdBy.trim()) {
    throw new Error('CreatedBy is required.');
  }

  const payload = await apiRequest<AddConvenienceApi>('add_employee_convenience.php', {
    method: 'POST',
    body: {
      EmployeeID: String(input.employeeId),
      ConvenienceFrom: input.from.trim(),
      ConvenienceTo: input.to.trim(),
      ConvenienceAmount: input.amount,
      ConvenienceDate: input.date.trim(),
      Reference: input.reference.trim(),
      CreatedBy: input.createdBy.trim(),
    },
  });

  if (isApiError(payload.error)) {
    throw new Error(payload.message || 'Unable to add convenience charge.');
  }

  return {
    id: asNumber(payload.last_insert_id),
    message: payload.message || 'Employee Convenience Added',
  };
}
