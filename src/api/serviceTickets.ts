import { apiRequest } from './client';

type ListResponse<T> = {
  data?: T[] | null;
  error?: boolean | string | number;
  message?: string;
};

type CorporateTicketRaw = {
  ID?: string | number;
  TicketID?: string;
  Type?: string;
  Service?: string;
  Subservice?: string;
  SubService_Others?: string;
  Message?: string;
  Description?: string;
  Remarks?: string;
  Priority?: string;
  CreatedDate?: string;
  CreatedTime?: string;
  DueDate?: string;
  CloseDate?: string;
  CloseTime?: string;
  Status?: string;
  QuotationStatus?: string;
  ClientTicketID?: string;
  CallType?: string;
  BranchSite?: string | null;
};

type HomeCareTicketRaw = {
  ID?: string | number;
  BookingID?: string;
  Name?: string;
  Phone?: string | number;
  Email?: string;
  Service_name?: string;
  SubService?: string;
  Customer_address?: string;
  City_name?: string;
  State_name?: string;
  Location_landmark?: string;
  PostalCode?: string;
  Subject?: string;
  BookingDate?: string;
  BookingTime?: string;
  Status?: string;
  PaymentStatus?: string;
};

export type ServiceTicketSource = 'corporate' | 'homecare';
export type ServiceTicketGroup = 'open' | 'escalated' | 'closed';

export type ServiceTicket = {
  /** Unique across both sources */
  key: string;
  source: ServiceTicketSource;
  id: string;
  ticketCode: string;
  /** R&M, AMC, Supply, Projects or Home Care */
  type: string;
  status: string;
  group: ServiceTicketGroup;
  service: string;
  subService: string;
  /** Branch site for corporate tickets, customer name for home care */
  site: string;
  city: string;
  message: string;
  description: string;
  remarks: string;
  priority: string;
  /** Raised date for corporate tickets, booking date for home care (YYYY-MM-DD) */
  date: string;
  time: string;
  dueDate: string;
  closeDate: string;
  closeTime: string;
  quotationStatus: string;
  clientTicketId: string;
  callType: string;
  phone: string;
  email: string;
  address: string;
  paymentStatus: string;
};

/** Closed corporate tickets can run into thousands, so only the latest ones are loaded */
export const ClosedTicketLimit = 300;

function text(value: unknown) {
  return value == null ? '' : String(value).trim();
}

function isApiError(error: ListResponse<unknown>['error']) {
  return error === true || error === 1 || error === '1' || error === 'true';
}

function cleanOptional(value: unknown) {
  const result = text(value);
  return result === '-1' || result.toUpperCase() === 'NA' ? '' : result;
}

export function ticketGroup(status: string): ServiceTicketGroup {
  const key = status.toLowerCase();
  if (key === 'escalated') return 'escalated';
  if (key === 'closed' || key === 'completed' || key.startsWith('cancel')) return 'closed';
  return 'open';
}

function corporateType(value: string) {
  const type = value.trim();
  if (/^projects?$/i.test(type)) return 'Projects';
  if (/^booking$/i.test(type)) return 'Booking';
  return type || 'R&M';
}

function mapCorporate(raw: CorporateTicketRaw): ServiceTicket {
  const id = text(raw.ID);
  const status = text(raw.Status) || 'Raised';
  const subService = [text(raw.Subservice), text(raw.SubService_Others)].filter(Boolean).join(' · ');
  return {
    key: `corporate-${id}`,
    source: 'corporate',
    id,
    ticketCode: text(raw.TicketID) || id,
    type: corporateType(text(raw.Type)),
    status,
    group: ticketGroup(status),
    service: text(raw.Service),
    subService,
    site: text(raw.BranchSite),
    city: '',
    message: text(raw.Message),
    description: text(raw.Description),
    remarks: text(raw.Remarks),
    priority: cleanOptional(raw.Priority),
    date: text(raw.CreatedDate).slice(0, 10),
    time: text(raw.CreatedTime),
    dueDate: text(raw.DueDate).slice(0, 10),
    closeDate: text(raw.CloseDate).slice(0, 10),
    closeTime: text(raw.CloseTime),
    quotationStatus: cleanOptional(raw.QuotationStatus),
    clientTicketId: text(raw.ClientTicketID),
    callType: text(raw.CallType),
    phone: '',
    email: '',
    address: '',
    paymentStatus: '',
  };
}

function mapHomeCare(raw: HomeCareTicketRaw): ServiceTicket {
  const id = text(raw.ID);
  const status = text(raw.Status) || 'Pending';
  const address = [text(raw.Customer_address), text(raw.Location_landmark), text(raw.City_name), text(raw.State_name)]
    .filter(Boolean)
    .join(', ');
  const postal = cleanOptional(raw.PostalCode);
  return {
    key: `homecare-${id}`,
    source: 'homecare',
    id,
    ticketCode: text(raw.BookingID) || id,
    type: 'Home Care',
    status,
    group: ticketGroup(status),
    service: text(raw.Service_name),
    subService: text(raw.SubService),
    site: text(raw.Name),
    city: text(raw.City_name),
    message: text(raw.Subject),
    description: '',
    remarks: '',
    priority: '',
    date: text(raw.BookingDate).slice(0, 10),
    time: text(raw.BookingTime),
    dueDate: '',
    closeDate: '',
    closeTime: '',
    quotationStatus: '',
    clientTicketId: '',
    callType: '',
    phone: text(raw.Phone),
    email: text(raw.Email),
    address: postal ? `${address} - ${postal}` : address,
    paymentStatus: text(raw.PaymentStatus),
  };
}

export type CorporateTicketDetail = {
  companyName: string;
  branchSite: string;
  branchCode: string;
  branchAddress: string;
  employeeName: string;
  equipmentName: string;
  sparePartStatus: string;
  quoteApproved: boolean;
  hasQuotation: boolean;
  /** Fresher copies of list fields */
  status: string;
  priority: string;
  dueDate: string;
  subService: string;
  clientTicketId: string;
  branchId: string;
};

type CorporateTicketDetailRaw = CorporateTicketRaw & {
  BranchID?: string | number;
  CompanyName?: string;
  BranchCode?: string;
  BranchAddress1?: string;
  BranchState?: string;
  EmployeeName?: string;
  EquipmentName?: string;
  QuoteApproved?: string | number;
  TicketQuotationID?: string | number;
};

/** POST get_corporate_ticket_detail.php { TicketID, Type: 'CT' } */
export async function fetchCorporateTicketDetail(ticketId: string): Promise<CorporateTicketDetail> {
  const payload = await apiRequest<{
    data?: CorporateTicketDetailRaw | null;
    SparePartStatus?: string;
    error?: ListResponse<unknown>['error'];
    message?: string;
  }>('get_corporate_ticket_detail.php', { method: 'POST', auth: true, body: { TicketID: ticketId, Type: 'CT' } });
  if (isApiError(payload?.error)) throw new Error(payload?.message || 'Could not load ticket details.');
  const raw = payload?.data;
  if (!raw || typeof raw !== 'object') throw new Error('Ticket details not found.');
  const address = [text(raw.BranchAddress1), text(raw.BranchState)].filter(Boolean).join(', ');
  return {
    companyName: text(raw.CompanyName),
    branchSite: text(raw.BranchSite),
    branchCode: text(raw.BranchCode),
    branchAddress: address,
    employeeName: text(raw.EmployeeName),
    equipmentName: text(raw.EquipmentName),
    sparePartStatus: text(payload?.SparePartStatus),
    quoteApproved: text(raw.QuoteApproved) === '1',
    hasQuotation: Number(raw.TicketQuotationID ?? -1) > 0,
    status: text(raw.Status),
    priority: cleanOptional(raw.Priority),
    dueDate: text(raw.DueDate).slice(0, 10),
    subService: [text(raw.Subservice), text(raw.SubService_Others)].filter(Boolean).join(' · '),
    clientTicketId: text(raw.ClientTicketID),
    branchId: cleanOptional(raw.BranchID),
  };
}

type StatusResponse = { error?: ListResponse<unknown>['error']; message?: string };

/** POST generate_otp_to_branch.php { BranchID, TicketID }; the branch receives the OTP on WhatsApp */
export async function sendStartWorkOtp(ticketId: string, branchId: string) {
  if (!branchId) throw new Error('This ticket has no branch linked, so the OTP cannot be sent.');
  const payload = await apiRequest<StatusResponse>('generate_otp_to_branch.php', {
    method: 'POST',
    auth: true,
    body: { BranchID: branchId, TicketID: ticketId },
  });
  if (isApiError(payload?.error)) throw new Error(payload?.message || 'Could not send the OTP.');
  return payload?.message || 'OTP sent to the branch on WhatsApp.';
}

/** POST verify_ticket_otp_v2.php { TicketID, TicketOTP }; moves the ticket to Work In Progress */
export async function verifyStartWorkOtp(ticketId: string, otp: string) {
  const payload = await apiRequest<StatusResponse>('verify_ticket_otp_v2.php', {
    method: 'POST',
    auth: true,
    body: { TicketID: ticketId, TicketOTP: otp.trim() },
  });
  if (isApiError(payload?.error)) throw new Error(payload?.message || 'The OTP is incorrect or expired.');
}

export type TicketComment = {
  id: string;
  message: string;
  createdBy: string;
  date: string;
  time: string;
};

/** POST get_ticket_conversation.php. The rows come back as numbered keys next to error/message. */
export async function fetchTicketComments(ticketId: string): Promise<TicketComment[]> {
  const payload = await apiRequest<Record<string, unknown> | unknown[]>('get_ticket_conversation.php', {
    method: 'POST',
    auth: true,
    body: { TicketID: ticketId },
  });
  const rows = Array.isArray(payload) ? payload : Object.values(payload ?? {});
  return rows
    .filter((row): row is Record<string, unknown> => row !== null && typeof row === 'object' && 'Message' in row)
    .map((row) => ({
      id: text(row.ID),
      message: text(row.Message),
      createdBy: text(row.CreatedBy),
      date: text(row.CreatedDate).slice(0, 10),
      time: text(row.CreatedTime),
    }))
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
}

/** POST add_ticket_conversation.php { TicketID, message, CreatedBy } */
export async function addTicketComment(ticketId: string, message: string, createdBy: string) {
  const payload = await apiRequest<{ error?: ListResponse<unknown>['error']; emessage?: string }>(
    'add_ticket_conversation.php',
    { method: 'POST', auth: true, body: { TicketID: ticketId, message: message.trim(), CreatedBy: createdBy } },
  );
  if (isApiError(payload?.error)) throw new Error(payload?.emessage || 'Could not send the comment.');
}

export type TicketPayment = {
  id: string;
  paymentType: string;
  store: string;
  amount: number;
  phone: string;
  scheduleDate: string;
  status: string;
  stateApproved: boolean;
  financeApproved: boolean;
  cfoApproved: boolean;
  createdDate: string;
  billCount: number;
};

/** POST get-ticket-payments-details-by-ticketid.php { TicketID } */
export async function fetchTicketPayments(ticketId: string): Promise<TicketPayment[]> {
  const rows = await fetchList<Record<string, unknown>>(
    'get-ticket-payments-details-by-ticketid.php',
    { TicketID: ticketId },
    'Could not load ticket payments.',
  );
  return rows.map((row) => {
    let billCount = 0;
    try {
      const bills = JSON.parse(text(row.BillImage) || '[]');
      billCount = Array.isArray(bills) ? bills.length : 0;
    } catch {
      billCount = text(row.BillImage) ? 1 : 0;
    }
    return {
      id: text(row.ID),
      paymentType: text(row.PaymentType) || 'Payment',
      store: text(row.Store),
      amount: Number(row.Amount) || 0,
      phone: text(row.PhoneNumber),
      scheduleDate: text(row.ScheduleDate).slice(0, 10),
      status: text(row.Status) || 'Pending',
      stateApproved: text(row.IsStateApprove) === 'Yes',
      financeApproved: text(row.IsFinanceApprove) === 'Yes',
      cfoApproved: text(row.IsCfoApprove) === 'Yes',
      createdDate: text(row.CreatedDate).slice(0, 10),
      billCount,
    };
  });
}

async function fetchList<T>(path: string, body: Record<string, unknown>, fallback: string): Promise<T[]> {
  const payload = await apiRequest<ListResponse<T>>(path, { method: 'POST', auth: true, body });
  if (isApiError(payload?.error)) throw new Error(payload?.message || fallback);
  return Array.isArray(payload?.data) ? payload.data : [];
}

export type ServiceTicketsResult = {
  tickets: ServiceTicket[];
  /** True when the closed corporate list hit ClosedTicketLimit */
  closedTruncated: boolean;
  /** Set when some lists loaded but others failed */
  warning: string;
};

/**
 * Loads the employee's corporate (get_assigned_corporate_tickets_v2.php) and
 * home care (get_assigned_*home_services_tickets.php) tickets, open and closed.
 */
export async function fetchServiceTickets(employeeId: string | number): Promise<ServiceTicketsResult> {
  const EmployeeID = text(employeeId);
  if (!EmployeeID) throw new Error('Employee ID missing. Please sign in again.');

  const [corporateOpen, corporateClosed, homeOpen, homeClosed] = await Promise.allSettled([
    fetchList<CorporateTicketRaw>(
      'get_assigned_corporate_tickets_v2.php',
      { EmployeeID },
      'Could not load corporate tickets.',
    ),
    fetchList<CorporateTicketRaw>(
      'get_assigned_corporate_tickets_v2.php',
      { EmployeeID, Status: 'Closed', start_counter: 0, no_of_records: ClosedTicketLimit },
      'Could not load closed corporate tickets.',
    ),
    fetchList<HomeCareTicketRaw>(
      'get_assigned_home_services_tickets.php',
      { EmployeeID },
      'Could not load home care tickets.',
    ),
    fetchList<HomeCareTicketRaw>(
      'get_assigned_completed_home_services_tickets.php',
      { EmployeeID },
      'Could not load closed home care tickets.',
    ),
  ]);

  const results = [corporateOpen, corporateClosed, homeOpen, homeClosed];
  const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
  if (failures.length === results.length) {
    const reason = failures[0].reason;
    throw reason instanceof Error ? reason : new Error('Could not load tickets.');
  }

  const valueOf = <T,>(result: PromiseSettledResult<T[]>) => (result.status === 'fulfilled' ? result.value : []);
  const byKey = new Map<string, ServiceTicket>();
  for (const row of [...valueOf(corporateOpen), ...valueOf(corporateClosed)]) {
    const ticket = mapCorporate(row);
    byKey.set(ticket.key, ticket);
  }
  for (const row of [...valueOf(homeOpen), ...valueOf(homeClosed)]) {
    const ticket = mapHomeCare(row);
    byKey.set(ticket.key, ticket);
  }

  const tickets = Array.from(byKey.values()).sort((a, b) => {
    const byDate = `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`);
    return byDate !== 0 ? byDate : Number(b.id) - Number(a.id);
  });

  return {
    tickets,
    closedTruncated: valueOf(corporateClosed).length >= ClosedTicketLimit,
    warning: failures.length
      ? failures.map((f) => (f.reason instanceof Error ? f.reason.message : String(f.reason))).join(' ')
      : '',
  };
}

/** Open corporate and home care tickets only; skips the heavy closed lists. */
export async function fetchOpenServiceTickets(employeeId: string | number): Promise<ServiceTicket[]> {
  const EmployeeID = text(employeeId);
  if (!EmployeeID) throw new Error('Employee ID missing. Please sign in again.');

  const [corporateOpen, homeOpen] = await Promise.allSettled([
    fetchList<CorporateTicketRaw>('get_assigned_corporate_tickets_v2.php', { EmployeeID }, 'Could not load corporate tickets.'),
    fetchList<HomeCareTicketRaw>('get_assigned_home_services_tickets.php', { EmployeeID }, 'Could not load home care tickets.'),
  ]);
  if (corporateOpen.status === 'rejected' && homeOpen.status === 'rejected') {
    const reason = corporateOpen.reason;
    throw reason instanceof Error ? reason : new Error('Could not load tickets.');
  }

  const tickets = [
    ...(corporateOpen.status === 'fulfilled' ? corporateOpen.value.map(mapCorporate) : []),
    ...(homeOpen.status === 'fulfilled' ? homeOpen.value.map(mapHomeCare) : []),
  ];
  return tickets.filter((ticket) => ticket.group !== 'closed');
}
