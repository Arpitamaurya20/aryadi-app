import { apiRequest } from './client';

export type CompanyOption = {
  id: string;
  label: string;
};

export type BranchOption = {
  id: string;
  label: string;
};

type CompanyRaw = {
  ID?: string | number;
  CompanyName?: string | null;
  CorporateName?: string | null;
};

type BranchRaw = {
  ID?: string | number;
  BranchSite?: string | null;
  BranchCode?: string | null;
};

type ListError = {
  error?: boolean | number | string;
  message?: string;
};

/** POST company/select_corporate_account.php. search_term -1 asks for the full active list. */
export async function fetchCompanies() {
  const payload = await apiRequest<CompanyRaw[] | ListError>('company/select_corporate_account.php', {
    method: 'POST',
    auth: true,
    body: {
      CorporateID: '1',
      search_term: '-1',
    },
  });
  const rows = asList<CompanyRaw>(payload, 'Unable to load companies.');
  return rows
    .map((row) => ({
      id: String(row.ID ?? '').trim(),
      label: text(row.CompanyName) || text(row.CorporateName) || 'Company',
    }))
    .filter((company) => company.id !== '');
}

/** POST branch/search_branch.php for every active branch of the selected company. */
export async function fetchBranches(corporateId: string) {
  const payload = await apiRequest<BranchRaw[] | ListError>('branch/search_branch.php', {
    method: 'POST',
    auth: true,
    body: {
      CorporateID: corporateId,
      search_term: '-1',
    },
  });
  const rows = asList<BranchRaw>(payload, 'Unable to load branches.');
  return rows
    .map((row) => {
      const site = text(row.BranchSite);
      const code = text(row.BranchCode);
      return {
        id: String(row.ID ?? '').trim(),
        label: site && code ? `${site} (${code})` : site || code || 'Branch',
      };
    })
    .filter((branch) => branch.id !== '');
}

function asList<T>(payload: T[] | ListError, fallback: string) {
  if (Array.isArray(payload)) return payload;
  const failed =
    payload?.error === true || payload?.error === 1 || payload?.error === '1' || payload?.error === 'true';
  throw new Error(failed ? payload?.message || fallback : fallback);
}

function text(value: string | null | undefined) {
  return String(value ?? '').trim();
}

export type BranchDetails = {
  id: string;
  site: string;
  code: string;
  email: string;
  phone: string;
  incharge: string;
  address: string;
};

type BranchDetailsRaw = {
  ID?: string | number;
  BranchSite?: string | null;
  BranchCode?: string | null;
  BranchEmail?: string | null;
  BranchMobile?: string | null;
  BranchLandline?: string | null;
  SiteIncharge?: string | null;
  BranchAddress1?: string | null;
  BranchCity?: string | null;
  BranchState?: string | null;
  error?: boolean | number | string;
  message?: string;
};

/** POST branch/get_branch_details.php to start the visitor client form for one branch. */
export async function fetchBranchDetails(branchId: string) {
  const payload = await apiRequest<BranchDetailsRaw | null>('branch/get_branch_details.php', {
    method: 'POST',
    auth: true,
    body: {
      BranchID: String(branchId),
    },
  });

  if (!payload || typeof payload !== 'object' || !text(String(payload.ID ?? ''))) {
    const failed =
      payload?.error === true || payload?.error === 1 || payload?.error === '1' || payload?.error === 'true';
    throw new Error(failed ? payload?.message || 'Unable to load branch details.' : 'Unable to load branch details.');
  }

  const address = [text(payload.BranchAddress1), text(payload.BranchCity), text(payload.BranchState)]
    .filter(Boolean)
    .join(', ');

  return {
    id: String(payload.ID),
    site: text(payload.BranchSite) || 'Branch',
    code: text(payload.BranchCode),
    email: text(payload.BranchEmail),
    phone: text(payload.BranchMobile) || text(payload.BranchLandline),
    incharge: text(payload.SiteIncharge),
    address,
  };
}
