import { apiRequest } from './client';

export type EmployeeConcern = {
  id: number;
  name: string;
  mobile: string;
  issue: string;
  attachment: string | null;
  isAnonymous: boolean;
  status: string;
  createdAt: string;
};

type ConcernRowApi = {
  Id?: number | string;
  Name?: string;
  Mobile?: string;
  Issue?: string;
  Attachment?: string | null;
  IsAnonymous?: number | string;
  Status?: string;
  CreatedAt?: string;
};

type ConcernsApi = {
  error?: boolean | number | string;
  message?: string;
  data?: ConcernRowApi[] | null;
};

type ConcernDetailsApi = {
  error?: boolean | number | string;
  message?: string;
  data?: ConcernRowApi | null;
};

function isApiError(error: ConcernsApi['error']) {
  return error === true || error === 1 || error === '1' || error === 'true';
}

function mapConcern(row: ConcernRowApi): EmployeeConcern {
  const attachment = String(row.Attachment ?? '').trim();
  return {
    id: Number(row.Id ?? 0),
    name: String(row.Name ?? '').trim() || 'Employee',
    mobile: String(row.Mobile ?? '').trim(),
    issue: String(row.Issue ?? '').trim(),
    attachment: attachment || null,
    isAnonymous: Number(row.IsAnonymous ?? 0) === 1,
    status: String(row.Status ?? '').trim() || 'New',
    createdAt: String(row.CreatedAt ?? '').trim(),
  };
}

/**
 * POST get-employee-concerns-by-employeeid.php
 * { EmployeeID }
 */
export async function fetchEmployeeConcerns(employeeId: number): Promise<EmployeeConcern[]> {
  if (!employeeId || employeeId <= 0) {
    throw new Error('Missing employee id.');
  }

  const payload = await apiRequest<ConcernsApi>('get-employee-concerns-by-employeeid.php', {
    method: 'POST',
    body: { EmployeeID: String(employeeId) },
  });

  if (isApiError(payload.error)) {
    throw new Error(payload.message || 'Unable to load concerns.');
  }

  const rows = Array.isArray(payload.data) ? payload.data : [];
  return rows.map(mapConcern);
}

/** Concerns for this account are stored and listed with CreatedBy 154. */
export const CONCERN_EMPLOYEE_ID = '154';

type SubmitConcernApi = {
  error?: boolean | number | string;
  message?: string;
  insert_id?: number | string;
  attachment_url?: string | null;
};

export type SubmitConcernInput = {
  name: string;
  mobile: string;
  issue: string;
  attachment?: string;
};

/**
 * POST post_employee_concern.php
 * { Name, Mobile, Issue, Attachment, CreatedBy }
 */
export async function submitEmployeeConcern(input: SubmitConcernInput): Promise<number> {
  const payload = await apiRequest<SubmitConcernApi>('post_employee_concern.php', {
    method: 'POST',
    body: {
      Name: input.name.trim(),
      Mobile: input.mobile.trim(),
      Issue: input.issue.trim(),
      Attachment: input.attachment ?? '',
      CreatedBy: CONCERN_EMPLOYEE_ID,
    },
  });

  if (isApiError(payload.error)) {
    throw new Error(payload.message || 'Unable to submit the concern.');
  }

  return Number(payload.insert_id ?? 0);
}

/**
 * POST get-employee-concerns-details.php
 * { Id }
 */
export async function fetchEmployeeConcernDetails(id: number): Promise<EmployeeConcern> {
  if (!id || id <= 0) {
    throw new Error('Missing concern id.');
  }

  const payload = await apiRequest<ConcernDetailsApi>('get-employee-concerns-details.php', {
    method: 'POST',
    body: { Id: String(id) },
  });

  if (isApiError(payload.error) || !payload.data) {
    throw new Error(payload.message || 'Unable to load concern details.');
  }

  return mapConcern(payload.data);
}
