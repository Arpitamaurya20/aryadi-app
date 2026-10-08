import { apiRequest } from './client';
import { getApiBaseUrl } from './config';

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

/** POST send_feebackback_link.php { phonenumber, TicketID }; the client gets a rating link on WhatsApp */
export async function sendFeedbackLink(ticketId: string, phone: string) {
  const digits = phone.replace(/\D/g, '').slice(-10);
  if (digits.length !== 10) throw new Error('Enter a valid 10-digit phone number.');
  const payload = await apiRequest<StatusResponse>('send_feebackback_link.php', {
    method: 'POST',
    auth: true,
    body: { phonenumber: `+91${digits}`, TicketID: ticketId },
  });
  if (isApiError(payload?.error)) throw new Error(payload?.message || 'Could not send the feedback link.');
  return payload?.message || 'Feedback link sent.';
}

/** POST generate_otp_for_closure.php { BranchID, TicketID }; the branch receives the closure OTP on WhatsApp */
export async function sendCloseTicketOtp(ticketId: string, branchId: string) {
  if (!branchId) throw new Error('This ticket has no branch linked, so the OTP cannot be sent.');
  const payload = await apiRequest<StatusResponse>('generate_otp_for_closure.php', {
    method: 'POST',
    auth: true,
    body: { BranchID: branchId, TicketID: ticketId },
  });
  if (isApiError(payload?.error)) throw new Error(payload?.message || 'Could not send the closure OTP.');
  return payload?.message || 'Closure OTP sent to the branch on WhatsApp.';
}

/** POST verify_ticket_close_otp.php { TicketID, TicketCloseOTP }; closes the ticket and emails the report PDF */
export async function verifyCloseTicketOtp(ticketId: string, otp: string) {
  const payload = await apiRequest<StatusResponse>('verify_ticket_close_otp.php', {
    method: 'POST',
    auth: true,
    body: { TicketID: ticketId, TicketCloseOTP: otp.trim() },
  });
  if (isApiError(payload?.error)) throw new Error(payload?.message || 'The OTP is incorrect or expired.');
  return payload?.message || 'Ticket closed!';
}

export type WorkImageAction = 'pre_img' | 'post_img' | 'Service_Report';

export type TicketWorkImage = {
  id: string;
  action: WorkImageAction;
  url: string;
  date: string;
  time: string;
};

function adminUrl() {
  return getApiBaseUrl().replace(/\/api$/, '');
}

function ticketMediaUrl(fileName: string) {
  if (/^https?:\/\//i.test(fileName)) return fileName;
  return `${adminUrl()}/admin/media/ticket_media/${encodeURIComponent(fileName)}`;
}

/** POST get_capture_image_by_ticketid.php { TicketID, Action } — one call per action */
export async function fetchTicketWorkImages(ticketId: string): Promise<TicketWorkImage[]> {
  const actions: WorkImageAction[] = ['pre_img', 'post_img', 'Service_Report'];
  const lists = await Promise.all(
    actions.map(async (action) => {
      const rows = await fetchList<Record<string, unknown>>(
        'get_capture_image_by_ticketid.php',
        { TicketID: ticketId, Action: action },
        'Could not load work photos.',
      );
      return rows
        .filter((row) => text(row.Image) && text(row.IsActive) !== '0')
        .map((row) => ({
          id: text(row.ID),
          action,
          url: ticketMediaUrl(text(row.Image)),
          date: text(row.CreatedDate).slice(0, 10),
          time: text(row.CreatedTime),
        }));
    }),
  );
  return lists.flat().sort((a, b) => Number(a.id) - Number(b.id));
}

/**
 * POST get_capture_image.php { data: { TicketID, imageData, Action, CreatedBy } }
 * imageData is raw base64 without the data: prefix.
 */
export async function uploadTicketWorkImage(input: {
  ticketId: string;
  action: WorkImageAction;
  base64: string;
  createdBy: string;
}) {
  const payload = await apiRequest<StatusResponse>('get_capture_image.php', {
    method: 'POST',
    auth: true,
    body: {
      data: {
        TicketID: input.ticketId,
        imageData: input.base64.replace(/^data:[^;]+;base64,/, ''),
        Action: input.action,
        CreatedBy: input.createdBy,
      },
    },
  });
  if (isApiError(payload?.error)) throw new Error(payload?.message || 'Could not upload the photo.');
}

/** POST delete_r_n_m_ticket_image.php { TicketID, ImageID } */
export async function deleteTicketWorkImage(ticketId: string, imageId: string) {
  const payload = await apiRequest<StatusResponse & { emessage?: string }>('delete_r_n_m_ticket_image.php', {
    method: 'POST',
    auth: true,
    body: { TicketID: ticketId, ImageID: imageId },
  });
  if (isApiError(payload?.error)) throw new Error(payload?.emessage || payload?.message || 'Could not delete the photo.');
}

export type ServiceReportFields = {
  problemReportedByClient: string;
  observation: string;
  actionTaken: string;
  remarks: string;
  clientRepresentative: string;
  clientRepresentativeContact: string;
  clientRepresentativeEmails: string;
  clientRepresentativeDesignation: string;
};

export type GeneralServiceReport = ServiceReportFields & {
  /** corporate_ticket_general_service_report.ID, -1 when not submitted yet */
  id: number;
  /** Stored signature filename, '' when none */
  clientSignature: string;
  createdDate: string;
  createdTime: string;
  createdBy: string;
};

function signatureFileName(value: unknown) {
  const raw = text(value);
  return raw ? decodeURIComponent(raw.split('?')[0].split('/').pop() ?? '') : '';
}

export function clientSignatureUrl(fileName: string) {
  return `${adminUrl()}/admin/media/signature/${encodeURIComponent(fileName)}`;
}

export function serviceReportPdfUrl(reportId: number) {
  return `${adminUrl()}/admin/corporate-tickets/action/generate_service_report_pdf.php?ServiceReportID=${reportId}`;
}

/**
 * POST get_general_service_report_details.php { TicketID }
 * Returns the saved report, or defaults (client message, site incharge, branch mobile) when none exists.
 */
export async function fetchGeneralServiceReport(ticketId: string): Promise<GeneralServiceReport> {
  const raw = await apiRequest<Record<string, unknown> & StatusResponse>('get_general_service_report_details.php', {
    method: 'POST',
    auth: true,
    body: { TicketID: ticketId },
  });
  if (isApiError(raw?.error)) throw new Error(raw?.message || 'Could not load the service report.');
  const id = Number(raw?.ID ?? -1);
  return {
    id: id > 0 ? id : -1,
    problemReportedByClient: text(raw?.ProblemReportedByClient),
    observation: text(raw?.Observation),
    actionTaken: text(raw?.ActionTaken),
    remarks: text(raw?.Remarks),
    clientRepresentative: text(raw?.ClientRepresentative),
    clientRepresentativeContact: text(raw?.ClientRepresentativeContact),
    clientRepresentativeEmails: text(raw?.ClientRepresentativeEmails),
    clientRepresentativeDesignation: text(raw?.ClientRepresentativeDesignation),
    clientSignature: signatureFileName(raw?.ClientSignature),
    createdDate: text(raw?.CreatedDate).slice(0, 10),
    createdTime: text(raw?.CreatedTime),
    createdBy: text(raw?.CreatedBy),
  };
}

/**
 * POST capture_customer_signature.php { imageData, TicketID, GeneralServiceReportID }
 * With GeneralServiceReportID -1 the signature waits in temp_client_signature until the report is first saved.
 */
export async function saveClientSignature(input: { ticketId: string; reportId: number; base64: string }) {
  const payload = await apiRequest<StatusResponse & { ClientSignature?: string }>('capture_customer_signature.php', {
    method: 'POST',
    auth: true,
    body: {
      imageData: input.base64.replace(/^data:[^;]+;base64,/, ''),
      TicketID: input.ticketId,
      GeneralServiceReportID: input.reportId > 0 ? input.reportId : -1,
    },
  });
  if (isApiError(payload?.error)) throw new Error(payload?.message || 'Could not save the signature.');
  return signatureFileName(payload?.ClientSignature);
}

/** POST post_general_service_report.php — inserts when reportId is -1, otherwise updates */
export async function saveGeneralServiceReport(input: {
  ticketId: string;
  reportId: number;
  createdBy: string;
  fields: ServiceReportFields;
}): Promise<number> {
  const { fields } = input;
  const payload = await apiRequest<StatusResponse & { ServiceReportID?: string | number }>(
    'post_general_service_report.php',
    {
      method: 'POST',
      auth: true,
      body: {
        ProblemReportedByClient: fields.problemReportedByClient.trim(),
        Observation: fields.observation.trim(),
        ActionTaken: fields.actionTaken.trim(),
        Remarks: fields.remarks.trim(),
        ClientRepresentative: fields.clientRepresentative.trim(),
        ClientRepresentativeContact: fields.clientRepresentativeContact.trim(),
        ClientRepresentativeEmails: fields.clientRepresentativeEmails.trim(),
        ClientRepresentativeDesignation: fields.clientRepresentativeDesignation.trim(),
        ServiceReportID: input.reportId > 0 ? input.reportId : -1,
        ServiceReportTicketID: input.ticketId,
        CreatedBy: input.createdBy,
      },
    },
  );
  if (isApiError(payload?.error)) throw new Error(payload?.message || 'Could not save the service report.');
  const id = Number(payload?.ServiceReportID ?? input.reportId);
  return id > 0 ? id : input.reportId;
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
