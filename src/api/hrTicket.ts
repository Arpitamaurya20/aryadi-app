import { apiRequest } from './client';

export type HrTicketItem = {
  id: number;
  ticketCode: string;
  category: string;
  categoryLabel: string;
  subject: string;
  description: string;
  status: string;
  statusLabel: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
};

type HrTicketRowApi = {
  id?: number | string;
  ticket_id?: string;
  ticket_code?: string;
  category?: string;
  category_label?: string;
  subject?: string;
  description?: string;
  status?: string;
  status_label?: string;
  priority?: string;
  created_at?: string;
  updated_at?: string;
};

type HrTicketsApi = {
  error?: boolean | number | string;
  message?: string;
  total_records?: number;
  view_role?: string;
  data?: HrTicketRowApi[] | null;
};

function isApiError(error: HrTicketsApi['error']) {
  return error === true || error === 1 || error === '1' || error === 'true';
}

function mapRow(row: HrTicketRowApi): HrTicketItem {
  return {
    id: Number(row.id ?? 0),
    ticketCode: String(row.ticket_code || row.ticket_id || '').trim(),
    category: String(row.category || 'general').trim(),
    categoryLabel: String(row.category_label || row.category || 'General').trim(),
    subject: String(row.subject || '').trim() || 'Untitled',
    description: String(row.description || '').trim(),
    status: String(row.status || 'open').trim(),
    statusLabel: String(row.status_label || row.status || 'Open').trim(),
    priority: String(row.priority || 'normal').trim(),
    createdAt: String(row.created_at || '').trim(),
    updatedAt: String(row.updated_at || '').trim(),
  };
}

/**
 * List HR helpdesk tickets for an employee.
 * POST hr-ticket/get_hr_tickets.php
 * { EmployeeID, view_role: "Employee" }
 */
export async function fetchHrTickets(
  employeeId: number,
  viewRole: 'Employee' | 'HR' | 'employee' | 'hr' = 'Employee',
): Promise<HrTicketItem[]> {
  if (!employeeId || employeeId <= 0) {
    throw new Error('Missing employee id.');
  }

  const payload = await apiRequest<HrTicketsApi>('hr-ticket/get_hr_tickets.php', {
    method: 'POST',
    body: {
      EmployeeID: String(employeeId),
      view_role: viewRole,
    },
  });

  if (isApiError(payload.error)) {
    throw new Error(payload.message || 'Unable to load HR tickets.');
  }

  const rows = Array.isArray(payload.data) ? payload.data : [];
  return rows.map(mapRow);
}

export type HrTicketCategory = 'general' | 'payment_related' | 'benefits';

export type CreateHrTicketInput = {
  employeeId: number;
  category: HrTicketCategory | string;
  subject: string;
  description: string;
  paymentReference?: string;
  priority?: 'low' | 'normal' | 'high';
};

type CreateHrTicketApi = {
  error?: boolean | number | string;
  message?: string;
  ticket_id?: string;
  HrTicketID?: number | string;
  data?: HrTicketRowApi | null;
};

/**
 * Raise an HR helpdesk ticket.
 * POST hr-ticket/create_hr_ticket.php
 * { EmployeeID, Category, Subject, Description, PaymentReference? }
 */
export async function createHrTicket(input: CreateHrTicketInput): Promise<{
  id: number;
  ticketCode: string;
  message: string;
  ticket: HrTicketItem | null;
}> {
  if (!input.employeeId || input.employeeId <= 0) {
    throw new Error('Missing employee id.');
  }

  const subject = input.subject.trim();
  const description = input.description.trim();
  const category = String(input.category || 'general').trim().toLowerCase();
  const paymentReference = (input.paymentReference || '').trim();

  if (!subject) {
    throw new Error('Subject is required.');
  }
  if (!description) {
    throw new Error('Description is required.');
  }
  if (category === 'payment_related' && !paymentReference) {
    throw new Error('Payment reference or month/period is required for payment-related tickets.');
  }

  const body: Record<string, string> = {
    EmployeeID: String(input.employeeId),
    Category: category,
    Subject: subject,
    Description: description,
  };
  if (paymentReference) {
    body.PaymentReference = paymentReference;
  }
  if (input.priority) {
    body.Priority = input.priority;
  }

  const payload = await apiRequest<CreateHrTicketApi>('hr-ticket/create_hr_ticket.php', {
    method: 'POST',
    body,
  });

  if (isApiError(payload.error)) {
    throw new Error(payload.message || 'Unable to create HR ticket.');
  }

  return {
    id: Number(payload.HrTicketID ?? payload.data?.id ?? 0),
    ticketCode: String(payload.ticket_id || payload.data?.ticket_code || '').trim(),
    message: payload.message || 'HR ticket raised successfully.',
    ticket: payload.data ? mapRow(payload.data) : null,
  };
}
