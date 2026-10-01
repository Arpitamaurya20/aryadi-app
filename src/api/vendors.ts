import { apiRequest } from './client';

export type VendorRegistration = {
  id: number;
  registrationCode: string;
  name: string;
  businessName: string;
  mobile: string;
  email: string;
  profileImage: string | null;
  vendorType: string;
  vendorCategory: string;
  city: string;
  stateName: string;
  gstNumber: string;
  panNumber: string;
  status: string;
  statusLabel: string;
  rejectionReason: string;
  createdDate: string;
  createdTime: string;
};

type VendorRowApi = {
  ID?: number | string;
  RegistrationCode?: string;
  Name?: string;
  BusinessName?: string;
  Mobile?: string;
  Email?: string;
  ProfileImage?: string | null;
  VendorType?: string;
  VendorCategory?: string;
  City?: string;
  StateName?: string;
  GstNumber?: string;
  PanNumber?: string;
  Status?: string;
  StatusLabel?: string;
  RejectionReason?: string | null;
  CreatedDate?: string;
  CreatedTime?: string;
};

type VendorListApi = {
  error?: boolean | number | string;
  message?: string;
  count?: number;
  data?: VendorRowApi[] | null;
};

function isApiError(error: VendorListApi['error']) {
  return error === true || error === 1 || error === '1' || error === 'true';
}

function mapVendor(row: VendorRowApi): VendorRegistration {
  const image = String(row.ProfileImage ?? '').trim();
  return {
    id: Number(row.ID ?? 0),
    registrationCode: String(row.RegistrationCode ?? '').trim(),
    name: String(row.Name ?? '').trim(),
    businessName: String(row.BusinessName ?? '').trim(),
    mobile: String(row.Mobile ?? '').trim(),
    email: String(row.Email ?? '').trim(),
    profileImage: image || null,
    vendorType: String(row.VendorType ?? '').trim(),
    vendorCategory: String(row.VendorCategory ?? '').trim(),
    city: String(row.City ?? '').trim(),
    stateName: String(row.StateName ?? '').trim(),
    gstNumber: String(row.GstNumber ?? '').trim(),
    panNumber: String(row.PanNumber ?? '').trim(),
    status: String(row.Status ?? '').trim(),
    statusLabel: String(row.StatusLabel || row.Status || 'Pending').trim(),
    rejectionReason: String(row.RejectionReason ?? '').trim(),
    createdDate: String(row.CreatedDate ?? '').trim(),
    createdTime: String(row.CreatedTime ?? '').trim(),
  };
}

/**
 * POST get_vendor_registrations_by_employee.php
 * { EmployeeID }
 */
export async function fetchVendorRegistrations(employeeId: number): Promise<VendorRegistration[]> {
  if (!employeeId || employeeId <= 0) {
    throw new Error('Missing employee id.');
  }

  const payload = await apiRequest<VendorListApi>('get_vendor_registrations_by_employee.php', {
    method: 'POST',
    body: { EmployeeID: String(employeeId) },
  });

  if (isApiError(payload.error)) {
    throw new Error(payload.message || 'Unable to load vendor registrations.');
  }

  const rows = Array.isArray(payload.data) ? payload.data : [];
  return rows.map(mapVendor);
}

export type VendorTimelineStep = {
  stage: string;
  status: string;
  datetime: string;
  remarks: string;
  approverName: string;
};

export type VendorRegistrationDetail = VendorRegistration & {
  pincode: string;
  gstImage: string | null;
  panImage: string | null;
  aadhaarNumber: string;
  aadhaarImage: string | null;
  bankName: string;
  accountName: string;
  accountNumber: string;
  ifscCode: string;
  cancelChequeImage: string | null;
  currentAddress: string;
  permanentAddress: string;
  remarks: string;
  timeline: VendorTimelineStep[];
};

type TimelineStepApi = {
  stage?: string;
  status?: string;
  datetime?: string | null;
  remarks?: string | null;
  approver_name?: string | null;
};

type VendorDetailApi = VendorRowApi & {
  Pincode?: string;
  GstImage?: string | null;
  PanImage?: string | null;
  AadharNumber?: string;
  AadharImage?: string | null;
  BankName?: string;
  AccountName?: string;
  AccountNumber?: string;
  IfscCode?: string;
  CancelCheckImage?: string | null;
  CurrentAddress?: string;
  PermanentAddress?: string;
  Remarks?: string;
  status_timeline?: TimelineStepApi[] | null;
};

type VendorDetailResponse = {
  error?: boolean | number | string;
  message?: string;
  data?: VendorDetailApi | null;
};

function imageOrNull(value: string | null | undefined) {
  const image = String(value ?? '').trim();
  return image || null;
}

/**
 * POST get_vendor_registration_details.php
 * { EmployeeID, ID }
 */
export async function fetchVendorRegistrationDetails(employeeId: number, id: number): Promise<VendorRegistrationDetail> {
  if (!employeeId || employeeId <= 0) {
    throw new Error('Missing employee id.');
  }
  if (!id || id <= 0) {
    throw new Error('Missing registration id.');
  }

  const payload = await apiRequest<VendorDetailResponse>('get_vendor_registration_details.php', {
    method: 'POST',
    body: { EmployeeID: String(employeeId), ID: String(id) },
  });

  if (isApiError(payload.error) || !payload.data) {
    throw new Error(payload.message || 'Vendor registration not found');
  }

  const row = payload.data;
  const timeline = Array.isArray(row.status_timeline) ? row.status_timeline : [];
  return {
    ...mapVendor(row),
    pincode: String(row.Pincode ?? '').trim(),
    gstImage: imageOrNull(row.GstImage),
    panImage: imageOrNull(row.PanImage),
    aadhaarNumber: String(row.AadharNumber ?? '').trim(),
    aadhaarImage: imageOrNull(row.AadharImage),
    bankName: String(row.BankName ?? '').trim(),
    accountName: String(row.AccountName ?? '').trim(),
    accountNumber: String(row.AccountNumber ?? '').trim(),
    ifscCode: String(row.IfscCode ?? '').trim(),
    cancelChequeImage: imageOrNull(row.CancelCheckImage),
    currentAddress: String(row.CurrentAddress ?? '').trim(),
    permanentAddress: String(row.PermanentAddress ?? '').trim(),
    remarks: String(row.Remarks ?? '').trim(),
    timeline: timeline.map((step) => ({
      stage: String(step.stage ?? '').trim(),
      status: String(step.status ?? '').trim(),
      datetime: String(step.datetime ?? '').trim(),
      remarks: String(step.remarks ?? '').trim(),
      approverName: String(step.approver_name ?? '').trim(),
    })),
  };
}

export type VendorRegistrationInput = {
  employeeId: string;
  name: string;
  mobile: string;
  email: string;
  profileImage: string;
  gstNumber: string;
  gstImage: string;
  panNumber: string;
  panImage: string;
  aadhaarNumber: string;
  aadhaarImage: string;
  cancelChequeImage: string;
  accountName: string;
  accountNumber: string;
  ifscCode: string;
  currentAddress: string;
  permanentAddress: string;
  businessName: string;
  vendorType: string;
  vendorCategory: string;
  pincode: string;
  city: string;
  stateId: number | '';
  stateName: string;
  bankName: string;
  remarks: string;
};

type VendorSubmitApi = {
  error?: boolean | number | string;
  message?: string;
  registration_code?: string;
};

export async function submitVendorRegistration(input: VendorRegistrationInput) {
  const payload = await apiRequest<VendorSubmitApi>('post_vendor_registration.php', {
    method: 'POST',
    body: {
      EmployeeID: String(input.employeeId),
      name: input.name.trim(),
      mobile: input.mobile.trim(),
      email: input.email.trim(),
      profile_image: input.profileImage,
      gst_number: input.gstNumber.trim().toUpperCase(),
      gst_image: input.gstImage,
      pan_number: input.panNumber.trim().toUpperCase(),
      pan_image: input.panImage,
      aadhar_number: input.aadhaarNumber.trim(),
      aadhar_image: input.aadhaarImage,
      cancel_check_image: input.cancelChequeImage,
      account_name: input.accountName.trim(),
      account_number: input.accountNumber.trim(),
      ifsc_code: input.ifscCode.trim().toUpperCase(),
      current_address: input.currentAddress.trim(),
      permanent_address: input.permanentAddress.trim(),
      business_name: input.businessName.trim(),
      vendor_type: input.vendorType.trim(),
      vendor_category: input.vendorCategory.trim(),
      pincode: input.pincode.trim(),
      city: input.city.trim(),
      state_id: input.stateId === '' ? '' : input.stateId,
      state_name: input.stateName.trim(),
      bank_name: input.bankName.trim(),
      remarks: input.remarks.trim(),
    },
  });

  if (isApiError(payload.error)) {
    throw new Error(payload.message || 'Vendor registration failed');
  }

  return {
    message: payload.message || 'Vendor registration submitted successfully.',
    registrationCode: String(payload.registration_code ?? '').trim(),
  };
}
