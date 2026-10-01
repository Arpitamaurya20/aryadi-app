import { Linking, Platform } from 'react-native';
import { apiRequest, getAuthToken } from './client';
import { apiUrl, getApiBaseUrl } from './config';

type ApiFlag = boolean | string | number | undefined;

function isApiError(error: ApiFlag) {
  return error === true || error === 1 || error === '1' || error === 'true';
}

function text(value: unknown) {
  return value == null ? '' : String(value).trim();
}

export type PpmImageAction = 'pre_img' | 'post_img' | 'Service_Report';

export type PpmTicketImage = {
  id: string;
  action: string;
  url: string;
};

type ImageRowApi = {
  ID?: string | number;
  Action?: string;
  Image?: string;
  ImageURL?: string;
};

/**
 * POST get_capture_image_by_ticketid.php { TicketID, Type: 'ppm_tickets' }
 * Returns every image captured for the PPM ticket (pre, post, service report).
 */
export async function fetchPpmTicketImages(ticketId: string | number): Promise<PpmTicketImage[]> {
  const payload = await apiRequest<{ data?: ImageRowApi[]; error?: ApiFlag; message?: string }>(
    'get_capture_image_by_ticketid.php',
    {
      method: 'POST',
      auth: true,
      body: { TicketID: String(ticketId), Type: 'ppm_tickets' },
    },
  );
  if (isApiError(payload.error)) {
    throw new Error(payload.message || 'Could not load ticket images.');
  }
  return (Array.isArray(payload.data) ? payload.data : [])
    .filter((row) => row.ID && row.ImageURL)
    .map((row) => ({ id: text(row.ID), action: text(row.Action), url: text(row.ImageURL) }));
}

/**
 * POST get_capture_image.php { data: { TicketID, imageData, Action, CreatedBy, Type: 'ppm_tickets' } }
 * imageData is raw base64 without the data: prefix.
 */
export async function uploadPpmTicketImage(input: {
  ticketId: string | number;
  action: PpmImageAction;
  base64: string;
  createdBy: string;
}): Promise<void> {
  const payload = await apiRequest<{ error?: ApiFlag; message?: string }>('get_capture_image.php', {
    method: 'POST',
    auth: true,
    body: {
      data: {
        TicketID: String(input.ticketId),
        imageData: input.base64.replace(/^data:[^;]+;base64,/, ''),
        Action: input.action,
        CreatedBy: input.createdBy,
        Type: 'ppm_tickets',
      },
    },
  });
  if (isApiError(payload.error)) {
    throw new Error(payload.message || 'Could not upload the image.');
  }
}

/** POST delete_p_p_m_ticket_image.php { TicketID, ImageID } */
export async function deletePpmTicketImage(ticketId: string | number, imageId: string | number): Promise<void> {
  const payload = await apiRequest<{ error?: ApiFlag; message?: string }>('delete_p_p_m_ticket_image.php', {
    method: 'POST',
    auth: true,
    body: { TicketID: String(ticketId), ImageID: String(imageId) },
  });
  if (isApiError(payload.error)) {
    throw new Error(payload.message || 'Could not delete the image.');
  }
}

export type PpmGeneralDetails = {
  ProblemReportedByClient: string;
  Observation: string;
  ActionTaken: string;
  Remarks: string;
  ClientRepresentative: string;
  ClientRepresentativeContact: string;
  ClientRepresentativeEmails: string;
  ClientRepresentativeDesignation: string;
};

export const emptyGeneralDetails: PpmGeneralDetails = {
  ProblemReportedByClient: '',
  Observation: '',
  ActionTaken: '',
  Remarks: '',
  ClientRepresentative: '',
  ClientRepresentativeContact: '',
  ClientRepresentativeEmails: '',
  ClientRepresentativeDesignation: '',
};

/** APIs return either a bare filename or a full URL for ClientSignature; keep just the filename. */
function signatureFileName(value: unknown) {
  const raw = text(value);
  return raw ? decodeURIComponent(raw.split('?')[0].split('/').pop() ?? '') : '';
}

/** Public URL of a signature stored in admin/media/signature/ */
export function ppmSignatureUrl(fileName: string) {
  if (/^https?:\/\//i.test(fileName)) return fileName;
  return `${getApiBaseUrl().replace(/\/api$/, '')}/admin/media/signature/${encodeURIComponent(fileName)}`;
}

function pickGeneralDetails(source: Record<string, unknown> | null | undefined): PpmGeneralDetails {
  const out = { ...emptyGeneralDetails };
  if (!source) return out;
  (Object.keys(out) as (keyof PpmGeneralDetails)[]).forEach((key) => {
    out[key] = text(source[key]);
  });
  return out;
}

export type PpmChecklistItem = {
  id: number;
  name: string;
  inputType: string;
  unit: string;
  mandatory: boolean;
  helpText: string;
  options: string[];
  value: string;
  status: string;
  remarks: string;
};

export type PpmTicketAsset = {
  branchAssetId: number;
  equipmentName: string;
  make: string;
  model: string;
  serialNo: string;
  capacity: string;
  location: string;
  categoryName: string;
};

export type PpmTicketAssetFlow = {
  ticketId: number;
  ticketNumber: string;
  useDynamic: boolean;
  categoryName: string;
  checklistName: string;
  asset: PpmTicketAsset | null;
};

type AssetFlowApi = {
  error?: ApiFlag;
  message?: string;
  ticket_id?: number | string;
  ticket_number?: string;
  use_dynamic_ppm?: number | string;
  category_name?: string;
  dynamic_checklist?: { checklist_name?: string } | null;
  asset?: {
    branch_asset_id?: number | string;
    equipment_name?: string;
    make?: string;
    model?: string;
    serial_no?: string;
    capacity?: string;
    equipment_location?: string;
    category_name?: string;
  } | null;
};

/**
 * POST dynamic-ppm/get_ppm_ticket_asset_flow.php { TicketID }
 * TicketID is the numeric ppm_tickets.ID (e.g. "52913").
 * Decides dynamic vs legacy report flow and returns the ticket's asset.
 */
export async function fetchPpmTicketAssetFlow(ticketRef: string | number): Promise<PpmTicketAssetFlow> {
  const payload = await apiRequest<AssetFlowApi>('dynamic-ppm/get_ppm_ticket_asset_flow.php', {
    method: 'POST',
    auth: true,
    body: { TicketID: String(ticketRef) },
  });
  if (isApiError(payload.error)) {
    throw new Error(payload.message || 'Could not load the ticket asset flow.');
  }
  const asset = payload.asset;
  return {
    ticketId: Number(payload.ticket_id ?? 0),
    ticketNumber: text(payload.ticket_number),
    useDynamic: Number(payload.use_dynamic_ppm) === 1,
    categoryName: text(payload.category_name),
    checklistName: text(payload.dynamic_checklist?.checklist_name),
    asset: asset
      ? {
          branchAssetId: Number(asset.branch_asset_id ?? 0),
          equipmentName: text(asset.equipment_name),
          make: text(asset.make),
          model: text(asset.model),
          serialNo: text(asset.serial_no),
          capacity: text(asset.capacity),
          location: text(asset.equipment_location),
          categoryName: text(asset.category_name),
        }
      : null,
  };
}

export type PpmDynamicMappingMode = 'asset' | 'company';

export type PpmServiceReportForm = {
  /** Result of get_ppm_ticket_asset_flow.php, loaded before the report data */
  assetFlow: PpmTicketAssetFlow;
  useDynamic: boolean;
  /** Which checklist mapping the dynamic form came from; null for the legacy report */
  mappingMode: PpmDynamicMappingMode | null;
  checklistName: string;
  items: PpmChecklistItem[];
  assetCondition: string;
  general: PpmGeneralDetails;
  /** ppm_ticket_general_service_report.ID, -1 when not saved yet */
  generalReportId: number;
  /** ppm_dynamic_service_report.ID, -1 when not saved yet */
  dynamicReportId: number;
  isSubmitted: boolean;
  /** Signature filename already stored on the report, '' when none */
  clientSignature: string;
};

type ChecklistFormApi = {
  error?: ApiFlag;
  message?: string;
  use_dynamic_ppm?: number | string;
  checklist?: { checklist_name?: string } | null;
  service_report_id?: number | string;
  general_service_report_id?: number | string;
  common_fields?: { AssetCondition?: string };
  general_details?: Record<string, unknown> | unknown[];
  items?: {
    checklist_item_id: number | string;
    item_name?: string;
    input_type?: string;
    unit_name?: string;
    is_mandatory?: number | string;
    help_text?: string;
    options?: unknown;
    response?: { value?: string; status?: string; remarks?: string };
  }[];
};

type GeneralReportApi = Record<string, unknown> & { ID?: string | number; error?: ApiFlag; message?: string };

const checklistFormApi: Record<PpmDynamicMappingMode, string> = {
  asset: 'dynamic-ppm/get_dynamic_ppm_asset_checklist_form.php',
  company: 'dynamic-ppm/get_dynamic_ppm_checklist_form.php',
};

async function fetchChecklistForm(mode: PpmDynamicMappingMode, ticketId: string | number) {
  const flow = await apiRequest<ChecklistFormApi>(checklistFormApi[mode], {
    method: 'POST',
    auth: true,
    body: { TicketID: String(ticketId) },
  });
  if (isApiError(flow.error)) {
    throw new Error(flow.message || 'Could not load the service report.');
  }
  return flow;
}

/**
 * Loads the service report form for a PPM ticket (TicketID is the numeric ppm_tickets.ID).
 * 1. dynamic-ppm/get_ppm_ticket_asset_flow.php decides whether the ticket's asset has a checklist.
 * 2. Asset mapped: dynamic-ppm/get_dynamic_ppm_asset_checklist_form.php
 *    Otherwise: dynamic-ppm/get_dynamic_ppm_checklist_form.php (company + category mapping)
 * 3. Neither mapped: get_general_service_report_details.php { TicketID, Type: 'ppm_tickets' }
 */
export async function fetchPpmServiceReportForm(ticketId: string | number): Promise<PpmServiceReportForm> {
  const assetFlow = await fetchPpmTicketAssetFlow(ticketId);

  const mappingMode: PpmDynamicMappingMode = assetFlow.useDynamic ? 'asset' : 'company';
  const flow = await fetchChecklistForm(mappingMode, ticketId);

  if (Number(flow.use_dynamic_ppm) === 1) {
    const dynamicReportId = Number(flow.service_report_id ?? -1);
    const general = Array.isArray(flow.general_details) ? null : flow.general_details;
    return {
      assetFlow,
      useDynamic: true,
      mappingMode,
      checklistName: text(flow.checklist?.checklist_name) || assetFlow.checklistName,
      items: (flow.items ?? []).map((item) => ({
        id: Number(item.checklist_item_id),
        name: text(item.item_name),
        inputType: text(item.input_type).toLowerCase(),
        unit: text(item.unit_name),
        mandatory: Number(item.is_mandatory) === 1,
        helpText: text(item.help_text),
        options: Array.isArray(item.options) ? item.options.map((o) => text(o)).filter(Boolean) : [],
        value: text(item.response?.value),
        status: text(item.response?.status),
        remarks: text(item.response?.remarks),
      })),
      assetCondition: text(flow.common_fields?.AssetCondition),
      general: pickGeneralDetails(general as Record<string, unknown> | null),
      generalReportId: Number(flow.general_service_report_id ?? -1),
      dynamicReportId,
      isSubmitted: dynamicReportId > 0,
      clientSignature: signatureFileName((general as Record<string, unknown> | null)?.ClientSignature),
    };
  }

  const report = await apiRequest<GeneralReportApi>('get_general_service_report_details.php', {
    method: 'POST',
    auth: true,
    body: { TicketID: String(ticketId), Type: 'ppm_tickets' },
  });
  const generalReportId = report.ID ? Number(report.ID) : -1;
  return {
    assetFlow,
    useDynamic: false,
    mappingMode: null,
    checklistName: '',
    items: [],
    assetCondition: '',
    general: pickGeneralDetails(report),
    generalReportId,
    dynamicReportId: -1,
    isSubmitted: generalReportId > 0,
    clientSignature: generalReportId > 0 ? signatureFileName(report.ClientSignature) : '',
  };
}

/**
 * POST capture_customer_signature.php { imageData, TicketID, GeneralServiceReportID, Type: 'ppm_tickets' }
 * With GeneralServiceReportID -1 the signature is parked in temp_client_signature and attached
 * to the report when it is submitted; otherwise it is written straight onto that report.
 */
export async function savePpmClientSignature(input: {
  ticketId: string | number;
  generalReportId: number;
  base64: string;
}): Promise<string> {
  const payload = await apiRequest<{ error?: ApiFlag; message?: string; ClientSignature?: string }>(
    'capture_customer_signature.php',
    {
      method: 'POST',
      auth: true,
      body: {
        imageData: input.base64.replace(/^data:[^;]+;base64,/, ''),
        TicketID: String(input.ticketId),
        GeneralServiceReportID: input.generalReportId > 0 ? input.generalReportId : -1,
        Type: 'ppm_tickets',
      },
    },
  );
  if (isApiError(payload.error)) {
    throw new Error(payload.message || 'Could not save the signature.');
  }
  return signatureFileName(payload.ClientSignature);
}

const submitDynamicApi: Record<PpmDynamicMappingMode, string> = {
  asset: 'dynamic-ppm/submit_dynamic_ppm_asset_service_report.php',
  company: 'dynamic-ppm/submit_dynamic_ppm_service_report.php',
};

/**
 * Asset-mapped checklists: POST dynamic-ppm/submit_dynamic_ppm_asset_service_report.php
 * Company-mapped checklists: POST dynamic-ppm/submit_dynamic_ppm_service_report.php
 */
export async function submitDynamicPpmReport(input: {
  ticketId: string | number;
  mappingMode: PpmDynamicMappingMode;
  createdBy: string;
  assetCondition: string;
  general: PpmGeneralDetails;
  items: PpmChecklistItem[];
}): Promise<string> {
  const payload = await apiRequest<{ error?: ApiFlag; message?: string }>(
    submitDynamicApi[input.mappingMode],
    {
      method: 'POST',
      auth: true,
      body: {
        TicketID: String(input.ticketId),
        CreatedBy: input.createdBy,
        AssetCondition: input.assetCondition,
        GeneralDetails: input.general,
        ChecklistItems: input.items.map((item) => ({
          ChecklistItemID: item.id,
          ResponseValue: item.value,
          ResponseStatus: item.status,
          Remarks: item.remarks,
        })),
      },
    },
  );
  if (isApiError(payload.error)) {
    throw new Error(payload.message || 'Could not save the service report.');
  }
  return payload.message || 'Service report saved.';
}

/** POST close_ppm_ticket.php { TicketID } */
export async function submitPpmTicketClosure(ticketId: string | number): Promise<string> {
  const payload = await apiRequest<{ error?: ApiFlag; message?: string }>('close_ppm_ticket.php', {
    method: 'POST',
    auth: true,
    body: { TicketID: String(ticketId) },
  });
  if (isApiError(payload.error)) {
    throw new Error(payload.message || 'Could not submit the ticket.');
  }
  return payload.message || 'Ticket closed!';
}

const reportPdfApi = 'dynamic-ppm/download_dynamic_ppm_service_report_pdf.php';

/**
 * Generates and downloads the service report PDF via
 * dynamic-ppm/download_dynamic_ppm_service_report_pdf.php { TicketID, stream }.
 * Web saves the streamed file (the endpoint needs the Bearer token, so a plain link can't be used);
 * native asks for the generated file name (stream 0) and opens the public PDF.
 */
export async function downloadPpmServiceReportPdf(ticketId: string | number, ticketCode: string): Promise<void> {
  if (Platform.OS === 'web') {
    const token = getAuthToken();
    let response: Response;
    try {
      response = await fetch(apiUrl(reportPdfApi), {
        method: 'POST',
        headers: {
          Accept: 'application/pdf, application/json',
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ TicketID: String(ticketId), stream: 1 }),
      });
    } catch {
      throw new Error('Unable to reach server. Check API URL / network.');
    }
    if (!(response.headers.get('Content-Type') ?? '').includes('application/pdf')) {
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(payload?.message || `Could not download the service report (${response.status}).`);
    }
    const objectUrl = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = `service-report-${ticketCode || ticketId}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    return;
  }

  const payload = await apiRequest<{ error?: ApiFlag; message?: string; pdfname?: string; pdf_url?: string }>(
    reportPdfApi,
    { method: 'POST', auth: true, body: { TicketID: String(ticketId), stream: 0 } },
  );
  if (isApiError(payload.error)) {
    throw new Error(payload.message || 'Could not generate the service report.');
  }
  const pdfName = text(payload.pdfname);
  const url = pdfName
    ? `${getApiBaseUrl().replace(/\/api$/, '')}/admin/corporate-tickets/reports/${encodeURIComponent(pdfName)}?t=${Date.now()}`
    : text(payload.pdf_url);
  if (!url) {
    throw new Error('The server did not return the service report file.');
  }
  await Linking.openURL(url);
}
