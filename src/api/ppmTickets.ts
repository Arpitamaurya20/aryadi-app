import { apiRequest } from './client';

export type PpmTicketRaw = {
  ID?: string | number;
  TicketID?: string;
  CorporateID?: string | number;
  BranchID?: string | number;
  BranchAssetID?: string | number;
  PPMDate?: string;
  CreatedDate?: string;
  CreatedTime?: string;
  CloseDate?: string;
  CloseTime?: string;
  CreatedBy?: string;
  DueDate?: string;
  AssignedTo?: string | number;
  Status?: string;
  IsActive?: string | number;
  BillingStatus?: string | null;
  CategoryName?: string | null;
  Category?: string | null;
  AssetName?: string | null;
  BranchName?: string | null;
};

export type PpmApiResponse = {
  data?: PpmTicketRaw[] | null;
  error?: boolean | string | number;
  message?: string;
};

export type PpmTicketItem = {
  id: string;
  ticketCode: string;
  category: string;
  status: 'Assigned' | 'Closed' | 'Unbilled' | 'Billed' | string;
  rawStatus: string;
  billingStatus: string;
  ppmDate: string;
  branch: string;
  equipment: string;
  priority: 'High' | 'Medium' | 'Low';
  createdDate?: string;
  createdTime?: string;
  closeDate?: string;
  dueDate?: string;
  assignedTo?: string;
  branchAssetId?: string;
  isCompleted: boolean;
  
  // extra fields for UI
  company: string;
  location: string;
  serialNo: string;
  makeModel: string;
};

function normalizeStatus(rawStatus?: string, billingStatus?: string | null): string {
  const s = String(rawStatus || '').trim().toLowerCase();
  const b = String(billingStatus || '').trim().toLowerCase();

  if (s === 'closed' || s === 'completed') return 'Closed';
  if (b === 'billed') return 'Billed';
  if (b === 'unbilled') return 'Unbilled';
  if (s === 'assigned') return 'Assigned';
  if (s) return s.charAt(0).toUpperCase() + s.slice(1);
  return 'Assigned';
}

export function mapRawPpmTicket(raw: PpmTicketRaw, isCompletedFallback = false): PpmTicketItem {
  const rawStatus = String(raw.Status || (isCompletedFallback ? 'Closed' : 'Assigned')).trim();
  const billingStatus = String(raw.BillingStatus || '').trim();
  const displayStatus = isCompletedFallback ? 'Closed' : normalizeStatus(rawStatus, billingStatus);

  const ticketCode = String(raw.TicketID || (raw.ID ? `CS-PPM-${String(raw.ID).padStart(6, '0')}` : '')).trim();
  const category = String(raw.CategoryName || 'PPM').trim();
  const ppmDate = String(raw.PPMDate || '').trim();
  const branch = String(raw.BranchName || '').trim();
  const equipment = String(raw.AssetName || '').trim();

  return {
    id: String(raw.ID || ticketCode),
    ticketCode,
    category,
    status: displayStatus,
    rawStatus,
    billingStatus,
    ppmDate,
    branch,
    equipment,
    priority: 'High',
    createdDate: raw.CreatedDate,
    createdTime: raw.CreatedTime,
    closeDate: raw.CloseDate,
    dueDate: raw.DueDate,
    assignedTo: String(raw.AssignedTo || ''),
    branchAssetId: String(raw.BranchAssetID ?? '').trim(),
    isCompleted: isCompletedFallback || rawStatus.toLowerCase() === 'closed' || rawStatus.toLowerCase() === 'completed',
    company: '',
    location: branch,
    serialNo: '',
    makeModel: '',
  };
}

/**
 * Fetch Assigned/Active PPM tickets using:
 * POST get_assigned_ppm_tickets_v2.php
 * Payload: { "EmployeeID": "...", "Status": "Assigned" }
 */
export async function fetchAssignedPpmTickets(employeeId: string | number): Promise<PpmTicketItem[]> {
  const payload = await apiRequest<PpmApiResponse>('get_assigned_ppm_tickets_v2.php', {
    method: 'POST',
    auth: true,
    body: {
      EmployeeID: String(employeeId),
      Status: 'Assigned',
    },
  });

  if (isApiError(payload?.error)) {
    throw new Error(payload?.message || 'Could not load assigned PPM tickets.');
  }
  return Array.isArray(payload?.data) ? payload.data.map((row) => mapRawPpmTicket(row, false)) : [];
}

/**
 * Fetch Completed/Closed PPM tickets using:
 * POST get_assigned_completed_ppm_tickets.php
 * Payload: { "EmployeeID": "...", "Status": "Closed" }
 */
export async function fetchClosedPpmTickets(employeeId: string | number): Promise<PpmTicketItem[]> {
  const payload = await apiRequest<PpmApiResponse>('get_assigned_completed_ppm_tickets.php', {
    method: 'POST',
    auth: true,
    body: {
      EmployeeID: String(employeeId),
      Status: 'Closed',
    },
  });

  if (isApiError(payload?.error)) {
    throw new Error(payload?.message || 'Could not load closed PPM tickets.');
  }
  return Array.isArray(payload?.data) ? payload.data.map((row) => mapRawPpmTicket(row, true)) : [];
}

/**
 * Fetch both Assigned and Closed tickets in parallel and combine them.
 */
export async function fetchAllPpmTickets(employeeId: string | number): Promise<{
  assigned: PpmTicketItem[];
  closed: PpmTicketItem[];
  all: PpmTicketItem[];
}> {
  if (!String(employeeId ?? '').trim()) {
    throw new Error('Employee ID missing. Please sign in again.');
  }

  const [assigned, closed] = await Promise.all([
    fetchAssignedPpmTickets(employeeId),
    fetchClosedPpmTickets(employeeId),
  ]);

  const ticketMap = new Map<string, PpmTicketItem>();
  for (const item of assigned) {
    ticketMap.set(item.id, item);
  }
  for (const item of closed) {
    ticketMap.set(item.id, item);
  }

  const all = Array.from(ticketMap.values());
  return {
    assigned,
    closed,
    all,
  };
}

/**
 * Update PPM Ticket status using:
 * POST change_ppm_ticket_status.php
 */
export async function updatePpmTicketStatus(input: {
  ticketId: string | number;
  ticketStatus: string;
  assignedTo: string | number;
  updatedBy: string;
  dueDate?: string;
}): Promise<any> {
  try {
    return await apiRequest('change_ppm_ticket_status.php', {
      method: 'POST',
      auth: true,
      body: {
        TicketID: input.ticketId,
        TicketStatus: input.ticketStatus,
        AssignedTo: input.assignedTo,
        UpdatedBy: input.updatedBy,
        ...(input.dueDate ? { DueDate: input.dueDate } : {}),
      },
    });
  } catch (e) {
    console.warn('change_ppm_ticket_status error:', e);
    return null;
  }
}

type PpmDetailRaw = PpmTicketRaw & {
  Type?: string | null;
  CompanyName?: string | null;
  BranchSite?: string | null;
  BranchCode?: string | null;
  BranchAddress1?: string | null;
  EquipmentName?: string | null;
  Make?: string | null;
  Model?: string | null;
  EquipmentLocation?: string | null;
  SNo?: string | null;
  EmployeeName?: string | null;
};

type PpmDetailApi = {
  data?: PpmDetailRaw | null;
  error?: boolean | string | number;
  message?: string;
};

export type PpmTicketDetail = {
  id: string;
  ticketCode: string;
  type: string;
  branch: string;
  branchCode: string;
  employee: string;
  status: string;
  equipment: string;
  company: string;
  dueDate: string;
  ppmDate: string;
  location: string;
  serialNo: string;
  category: string;
  bookingDate: string;
  bookingTime: string;
  make: string;
  model: string;
  branchAddress: string;
  branchAssetId: string;
  closeDate: string;
  closeTime: string;
  isClosed: boolean;
};

export type PpmAssetHistoryItem = {
  id: string;
  ticketCode: string;
  status: string;
  ppmDate: string;
  closeDate: string;
};

function isApiError(error: PpmDetailApi['error']) {
  return error === true || error === 1 || error === '1' || error === 'true';
}

function text(value: unknown) {
  return value == null ? '' : String(value).trim();
}

/**
 * POST get_ppm_ticket_detail.php { TicketID: <ppm_tickets.ID> }
 * Works for both assigned and closed tickets.
 */
export async function fetchPpmTicketDetail(ticketId: string | number): Promise<PpmTicketDetail> {
  const payload = await apiRequest<PpmDetailApi>('get_ppm_ticket_detail.php', {
    method: 'POST',
    auth: true,
    body: { TicketID: String(ticketId) },
  });

  if (isApiError(payload?.error)) {
    throw new Error(payload?.message || 'Could not load ticket details.');
  }
  const row = payload?.data;
  if (!row || !row.ID) {
    throw new Error('Ticket details not found. The ticket may be missing its company, branch or asset.');
  }

  const rawStatus = text(row.Status);
  const statusKey = rawStatus.toLowerCase();

  return {
    id: text(row.ID),
    ticketCode: text(row.TicketID),
    type: text(row.Type),
    branch: text(row.BranchSite),
    branchCode: text(row.BranchCode),
    employee: text(row.EmployeeName),
    status: rawStatus,
    equipment: text(row.EquipmentName),
    company: text(row.CompanyName),
    dueDate: text(row.DueDate),
    ppmDate: text(row.PPMDate),
    location: text(row.EquipmentLocation),
    serialNo: text(row.SNo),
    category: text(row.CategoryName),
    bookingDate: text(row.CreatedDate),
    bookingTime: text(row.CreatedTime),
    make: text(row.Make),
    model: text(row.Model),
    branchAddress: text(row.BranchAddress1),
    branchAssetId: text(row.BranchAssetID),
    closeDate: text(row.CloseDate),
    closeTime: text(row.CloseTime),
    isClosed: statusKey === 'closed' || statusKey === 'completed',
  };
}

/**
 * POST get_ppm_details.php { BranchAssetID }
 * Returns every PPM ticket raised for the asset.
 */
export async function fetchPpmAssetHistory(branchAssetId: string | number): Promise<PpmAssetHistoryItem[]> {
  const payload = await apiRequest<PpmTicketRaw[] | PpmApiResponse>('get_ppm_details.php', {
    method: 'POST',
    auth: true,
    body: { BranchAssetID: String(branchAssetId) },
  });

  if (!Array.isArray(payload) && isApiError(payload?.error)) {
    throw new Error(payload?.message || 'Could not load asset history.');
  }
  const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];

  return rows
    .map((row) => ({
      id: text(row.ID),
      ticketCode: text(row.TicketID),
      status: text(row.Status),
      ppmDate: text(row.PPMDate),
      closeDate: text(row.CloseDate),
    }))
    .sort((a, b) => Number(b.id) - Number(a.id));
}

/**
 * Close PPM Ticket using:
 * POST close_ppm_ticket.php
 */
export async function closePpmTicket(ticketId: string | number): Promise<any> {
  try {
    return await apiRequest('close_ppm_ticket.php', {
      method: 'POST',
      auth: true,
      body: {
        TicketID: ticketId,
      },
    });
  } catch (e) {
    console.warn('close_ppm_ticket error:', e);
    return null;
  }
}
