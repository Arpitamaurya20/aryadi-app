import { apiRequest } from './client';
import { getApiBaseUrl } from './config';

export type SiteVisit = {
  id: number;
  title: string;
  status: string;
  reportNumber: string;
  contactPerson: string;
  phone: string;
  company: string;
  branch: string;
  createdDate: string;
  createdTime: string;
};

type SiteVisitRaw = {
  ID?: string | number;
  VisitTitle?: string | null;
  Status?: string | null;
  ReportNumber?: string | null;
  ContactPerson?: string | null;
  ContactPersonPhone?: string | null;
  CorporateName?: string | null;
  CompanyName?: string | null;
  BranchSite?: string | null;
  CreatedDate?: string | null;
  CreatedTime?: string | null;
};

type SiteVisitError = {
  error?: boolean | number | string;
  message?: string;
};

export const SITE_VISITS_PAGE_SIZE = 5;

/** POST site_visits/get_all_site_visits.php for one page of the signed-in user's visits. */
export async function fetchSiteVisits(createdBy: string, startCounter = 0, noOfRecords = SITE_VISITS_PAGE_SIZE) {
  const payload = await apiRequest<SiteVisitRaw[] | SiteVisitError>('site_visits/get_all_site_visits.php', {
    method: 'POST',
    auth: true,
    body: {
      CreatedBy: createdBy,
      start_counter: startCounter,
      no_of_records: noOfRecords,
    },
  });

  if (!Array.isArray(payload)) {
    const failed = payload?.error === true || payload?.error === 1 || payload?.error === '1' || payload?.error === 'true';
    throw new Error(failed ? payload?.message || 'Unable to load site visits.' : 'Unable to load site visits.');
  }

  return payload
    .map((row) => ({
      id: Number(row.ID) || 0,
      title: text(row.VisitTitle) || 'Site visit',
      status: text(row.Status) || 'Started',
      reportNumber: text(row.ReportNumber),
      contactPerson: text(row.ContactPerson),
      phone: text(row.ContactPersonPhone),
      company: companyLabel(row),
      branch: text(row.BranchSite),
      createdDate: text(row.CreatedDate),
      createdTime: text(row.CreatedTime),
    }))
    .filter((visit) => visit.id > 0);
}

export type SiteVisitDraft = {
  createdBy: string;
  branchId: string;
  visitTitle: string;
  contactPerson: string;
  phone: string;
  email: string;
};

type InitiateResponse = {
  error?: boolean | number | string;
  message?: string;
  last_insert_id?: number | string;
};

/** POST site_visits/initiate_site_visits.php and return the new visit id. */
export async function initiateSiteVisit(draft: SiteVisitDraft) {
  const payload = await apiRequest<InitiateResponse>('site_visits/initiate_site_visits.php', {
    method: 'POST',
    auth: true,
    body: {
      ReportNumber: '',
      CreatedBy: draft.createdBy,
      BranchID: draft.branchId,
      VisitTitle: draft.visitTitle,
      ContactPerson: draft.contactPerson,
      ContactPersonPhone: draft.phone,
      ContactPersonEmail: draft.email,
    },
  });

  const failed = payload?.error === true || payload?.error === 1 || payload?.error === '1' || payload?.error === 'true';
  if (failed) {
    throw new Error(payload.message || 'Unable to save the site visit.');
  }

  const id = Number(payload?.last_insert_id) || 0;
  if (id <= 0) {
    throw new Error(payload?.message || 'The site visit was not saved.');
  }

  return id;
}

type PdfResponse = {
  error?: boolean | number | string;
  message?: string;
  pdfname?: string;
};

/** POST site_visits/generate_site_visit_pdf.php and return the report URL. */
export async function downloadSiteVisitPdf(siteVisitId: number) {
  const payload = await apiRequest<PdfResponse>('site_visits/generate_site_visit_pdf.php', {
    method: 'POST',
    auth: true,
    body: { SiteVisitID: String(siteVisitId) },
  });

  const failed = payload?.error === true || payload?.error === 1 || payload?.error === '1' || payload?.error === 'true';
  if (failed || !payload?.pdfname) {
    throw new Error(payload?.message || 'Unable to create the PDF.');
  }

  const root = getApiBaseUrl().replace(/\/api\/?$/, '');
  return `${root}/admin/site_visits/reports/${payload.pdfname}`;
}

export const OBSERVATION_CATEGORIES = [
  'Air Conditioner & Accessories',
  'Bath & Sanitary',
  'Batteries & Solar System',
  'CCTV',
  'Carpentry',
  'Civil & Interiors',
  'DG',
  'ELV Automation',
  'ETP',
  'Electrical',
  'Electronics',
  'Facilities - Carpentry',
  'Facilities - Civil',
  'Facilities - Dormitory',
  'Facilities - Electrical',
  'Facilities - Furniture',
  'Facilities - Plumbing',
  'Fire Fighting & Fire Alarm',
  'Fire Safety',
  'Furniture',
  'HVAC',
  'House Keeping',
  'Interiors',
  'Kitchen Equipments',
  'Lighting',
  'Miscellaneous Work',
  'Office Equipment',
  'Paint',
  'Painting',
  'Plumbing',
  'RNM Visit',
  'Refrigeration System',
  'STP',
  'Supply',
  'UPS',
  'Wires & Power Distribution',
];

export type ObservationDraft = {
  siteVisitId: number;
  createdBy: string;
  tempObservationId: string;
  category: string;
  priority: string;
  observation: string;
  location: string;
  auditorRecommendation: string;
  clientRecommendation: string;
};

/** POST site_visits/submit_site_observation.php */
export async function submitSiteObservation(draft: ObservationDraft) {
  const payload = await apiRequest<InitiateResponse>('site_visits/submit_site_observation.php', {
    method: 'POST',
    auth: true,
    body: {
      SiteVisitID: String(draft.siteVisitId),
      Category: draft.category,
      Priority: draft.priority,
      Observation: draft.observation,
      Location: draft.location,
      CompanyRecommendation: draft.auditorRecommendation,
      ClientRecommendation: draft.clientRecommendation,
      CreatedBy: draft.createdBy,
      TempObservationID: draft.tempObservationId,
    },
  });

  const failed = payload?.error === true || payload?.error === 1 || payload?.error === '1' || payload?.error === 'true';
  if (failed) {
    throw new Error(payload.message || 'Unable to save the observation.');
  }
  return payload;
}

function throwIfFailed(payload: InitiateResponse | null | undefined, fallback: string) {
  const failed = payload?.error === true || payload?.error === 1 || payload?.error === '1' || payload?.error === 'true';
  if (failed) throw new Error(payload?.message || fallback);
}

/** POST site_visits/capture_sv_customer_signature.php */
export async function uploadCustomerSignature(siteVisitId: number, imageData: string) {
  const payload = await apiRequest<InitiateResponse>('site_visits/capture_sv_customer_signature.php', {
    method: 'POST',
    auth: true,
    body: {
      SiteVisitID: String(siteVisitId),
      imageData,
    },
  });
  throwIfFailed(payload, 'Unable to save the signature.');
  return payload;
}

/** POST site_visits/complete_site_visit.php */
export async function completeSiteVisit(input: { siteVisitId: number; createdBy: string; summary: string }) {
  const payload = await apiRequest<InitiateResponse>('site_visits/complete_site_visit.php', {
    method: 'POST',
    auth: true,
    body: {
      SiteVisitID: String(input.siteVisitId),
      CreatedBy: input.createdBy,
      Summary: input.summary,
    },
  });
  throwIfFailed(payload, 'Unable to submit the summary.');
  return payload;
}

/** POST site_visits/capture_site_observation_media.php. Body is wrapped in `data` for this endpoint. */
export async function uploadObservationPhoto(input: {
  siteVisitId: number;
  createdBy: string;
  tempObservationId: string;
  imageData: string;
}) {
  const payload = await apiRequest<InitiateResponse>('site_visits/capture_site_observation_media.php', {
    method: 'POST',
    auth: true,
    body: {
      data: {
        SiteVisitID: String(input.siteVisitId),
        ObservationID: '-1',
        TempObservationID: input.tempObservationId,
        CreatedBy: input.createdBy,
        imageData: input.imageData,
      },
    },
  });

  const failed = payload?.error === true || payload?.error === 1 || payload?.error === '1' || payload?.error === 'true';
  if (failed) {
    throw new Error(payload.message || 'Unable to save the photo.');
  }
  return payload;
}

function companyLabel(row: SiteVisitRaw) {
  const corporate = text(row.CorporateName);
  const company = text(row.CompanyName);
  if (company && (!corporate || /^\d+$/.test(corporate))) return company;
  return corporate || company;
}

function text(value: string | null | undefined) {
  return String(value ?? '').trim();
}
