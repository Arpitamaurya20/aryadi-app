import { apiRequest, getAuthToken } from './client';
import { getApiBaseUrl } from './config';
import { emptyAuthExtras, type AuthUser } from './auth';
import { normalizeJoiningDate } from './attendance';

type EmployeeRaw = Record<string, string | number | null | undefined>;

type EmployeeProfileApi = {
  error?: boolean | number | string;
  message?: string;
  data?: EmployeeRaw;
  profile?: {
    employee_id?: number;
    username?: string;
    name?: string;
    designation?: string;
    photo_url?: string;
    roles?: string[];
    personal?: {
      father_name?: string;
      gender?: string;
    };
    employment?: {
      employee_number?: string;
      date_of_joining?: string;
      department?: string;
      weekly_off?: string;
      city?: string;
      state?: string;
    };
    contact?: {
      official_email?: string;
      personal_email?: string;
      contact_number?: string;
    };
    documents?: {
      uan_number?: string;
      pan?: string;
      aadhar?: string;
      pan_image_url?: string;
      aadhar_image_url?: string;
      police_verification_image_url?: string;
    };
    bank?: {
      account_name?: string;
      account_number?: string;
    };
  };
};

type UpdateProfileResponse = {
  error?: boolean | number | string;
  message?: string;
};

export type ProfileFormUpdates = {
  username: string;
  email: string;
  phone: string;
  employee_code: string;
  uan: string;
  bank_account_name: string;
  bank_account_number: string;
  pan: string;
  aadhaar: string;
};

function isApiError(error: EmployeeProfileApi['error']) {
  return error === true || error === 1 || error === '1' || error === 'true';
}

function clean(value: string | null | undefined) {
  const trimmed = value?.trim() ?? '';
  if (!trimmed || trimmed === '-1') return null;
  return trimmed;
}

function raw(data: EmployeeRaw | undefined, key: string) {
  if (!data) return null;
  return clean(data[key] != null ? String(data[key]) : null);
}

/**
 * Loads full employee profile from get_employee_info.php
 * and merges it into the logged-in AuthUser.
 */
export async function fetchEmployeeProfile(user: AuthUser): Promise<AuthUser> {
  if (!user.employeeId || user.employeeId <= 0) {
    return user;
  }

  const payload = await apiRequest<EmployeeProfileApi>('get_employee_info.php', {
    method: 'POST',
    auth: false,
    body: { EmployeeID: user.employeeId },
  });

  if (isApiError(payload.error) || !payload.profile) {
    throw new Error(payload.message || 'Unable to load employee profile.');
  }

  const p = payload.profile;
  const d = payload.data;
  const roles = p.roles?.length ? p.roles : user.roles;
  const displayName = clean(p.name) || clean(p.username) || user.username;
  const roleLabel = clean(p.designation) || roles[0] || user.user_type;

  return {
    ...user,
    ...emptyAuthExtras(),
    username: displayName,
    user_type: roleLabel,
    roles,
    email: clean(p.contact?.official_email) || user.email,
    personalEmail: clean(p.contact?.personal_email),
    phone: clean(p.contact?.contact_number) || user.phone,
    employee_code: clean(p.employment?.employee_number) || user.employee_code,
    uan: clean(p.documents?.uan_number) || user.uan,
    pan: clean(p.documents?.pan) || user.pan,
    aadhaar: clean(p.documents?.aadhar) || user.aadhaar,
    bank_account_name: clean(p.bank?.account_name) || user.bank_account_name,
    bank_account_number: clean(p.bank?.account_number) || user.bank_account_number,
    photo_uri: clean(p.photo_url) || user.photo_uri,
    aadhaarImage: clean(p.documents?.aadhar_image_url) || raw(d, 'AadharImage'),
    panImage: clean(p.documents?.pan_image_url) || raw(d, 'PANImage'),
    policeImage: clean(p.documents?.police_verification_image_url) || raw(d, 'PoliceVerificationImage'),
    fatherName: clean(p.personal?.father_name) || raw(d, 'FatherName'),
    gender: clean(p.personal?.gender) || raw(d, 'Gender'),
    city: clean(p.employment?.city) || raw(d, 'City'),
    state: clean(p.employment?.state) || raw(d, 'State'),
    department: clean(p.employment?.department) || raw(d, 'Department'),
    division: raw(d, 'Division'),
    supervisor: raw(d, 'Supervisor'),
    weeklyOff: clean(p.employment?.weekly_off) || raw(d, 'WeeklyOff'),
    epfNumber: raw(d, 'Epf_number'),
    esicNumber: raw(d, 'Esic_number'),
    basicSalary: raw(d, 'Basic'),
    hra: raw(d, 'HRA'),
    da: raw(d, 'DA'),
    bonus: raw(d, 'Bonus'),
    others: raw(d, 'Others'),
    convenienceAllowance: raw(d, 'ConvenienceAllowance'),
    inhandSalary: raw(d, 'InHandSalary'),
    createdDate: user.createdDate,
    joiningDate:
      normalizeJoiningDate(p.employment?.date_of_joining) ||
      normalizeJoiningDate(raw(d, 'DateofJoining')) ||
      normalizeJoiningDate(raw(d, 'DateOfJoining')) ||
      user.joiningDate,
    employeeId: p.employee_id || user.employeeId,
    is_active: raw(d, 'IsActive') === '1' || raw(d, 'IsActive') === 'true' ? 1 : user.is_active,
  };
}

/**
 * Updates employee profile via update_tx_customer_details.php
 * Payload matches live TechXpert API:
 * https://techxpertindia.in/api/update_tx_customer_details.php
 */
export async function updateEmployeeProfile(
  user: AuthUser,
  form: ProfileFormUpdates
): Promise<AuthUser> {
  if (!user.employeeId || user.employeeId <= 0) {
    throw new Error('Missing employee id. Please log in again.');
  }

  const employeeName = form.username.trim() || user.username;
  const employeeEmail = form.email.trim();
  const employeeContact = form.phone.trim();
  const employeeNumber = form.employee_code.trim() || user.employee_code || '';
  const uan = form.uan.trim();
  const bankName = form.bank_account_name.trim();
  const bankNumber = form.bank_account_number.trim();
  const pan = form.pan.trim().toUpperCase();
  const aadhaar = form.aadhaar.trim();
  const joining = user.joiningDate || '';

  // Live API keys (confirmed working) + local PHP aliases where names differ
  const body = {
    EmployeeID: String(user.employeeId),
    employee_id: employeeNumber,
    employee_name: employeeName,
    employee_email: employeeEmail,
    personal_email: user.personalEmail || '',
    employee_contact: employeeContact,
    EmployeeNumber: employeeNumber,
    gender: user.gender || '',
    employee_gender: user.gender || '',
    father_name: user.fatherName || '',
    city: user.city || '',
    employee_city: user.city || '',
    state: user.state || '',
    employee_state: user.state || '',
    employee_aadhar_number: aadhaar || user.aadhaar || '',
    employee_pan_number: pan || user.pan || '',
    UANNumber: uan,
    employee_uan_number: uan,
    epf_number: user.epfNumber || 'N/A',
    esic_number: user.esicNumber || 'N/A',
    bank_account_name: bankName,
    bank_account_number: bankNumber,
    BankAccountNumber: bankNumber,
    department: user.department || '',
    employee_department: user.department || '',
    designation: user.user_type || '',
    division: user.division || '',
    supervisor: user.supervisor || '',
    date_of_joining: joining,
    weekly_off: user.weeklyOff || '',
    basic_salary: user.basicSalary || '',
    hra: user.hra || '',
    da: user.da || '',
    bonus: user.bonus || '',
    others: user.others || '',
    convenience_allowance: user.convenienceAllowance || '',
    inhand_salary: user.inhandSalary || '',
    profile_image: user.photo_uri || '',
    aadhar_image: user.aadhaarImage || '',
    pan_image: user.panImage || '',
    police_verification_image: user.policeImage || '',
  };

  const payload = await apiRequest<UpdateProfileResponse>('update_tx_customer_details.php', {
    method: 'POST',
    auth: true,
    body,
  });

  if (isApiError(payload.error)) {
    throw new Error(payload.message || 'Unable to update profile.');
  }

  // Re-fetch so UI matches database
  try {
    return await fetchEmployeeProfile({
      ...user,
      username: employeeName,
      email: employeeEmail || null,
      phone: employeeContact || null,
      employee_code: employeeNumber || null,
      uan: uan || null,
      bank_account_name: bankName || null,
      bank_account_number: bankNumber || null,
      pan: pan || null,
      aadhaar: aadhaar || user.aadhaar,
    });
  } catch {
    return {
      ...user,
      username: employeeName,
      email: employeeEmail || null,
      phone: employeeContact || null,
      employee_code: employeeNumber || null,
      uan: uan || null,
      bank_account_name: bankName || null,
      bank_account_number: bankNumber || null,
      pan: pan || null,
      aadhaar: aadhaar || user.aadhaar,
    };
  }
}

type ProfileImageResponse = {
  error?: boolean | number | string;
  message?: string;
  ProfileImage?: string;
};

/** Public URL for a file stored by update_employee_profile_image.php. */
export function profileMediaUrl(fileName: string) {
  const root = getApiBaseUrl().replace(/\/api\/?$/, '');
  return `${root}/admin/employees/media/${encodeURIComponent(fileName)}`;
}

/** POST update_employee_profile_image.php with raw JPEG base64 (no data: prefix). */
export async function updateEmployeeProfileImage(employeeId: number, imageData: string) {
  if (!getAuthToken()) {
    throw new Error('Sign in again, then update your profile photo.');
  }

  const payload = await apiRequest<ProfileImageResponse>('update_employee_profile_image.php', {
    method: 'POST',
    auth: true,
    body: {
      EmployeeID: String(employeeId),
      imageData,
    },
  });

  if (isApiError(payload.error)) {
    throw new Error(payload.message || 'Unable to update profile photo.');
  }

  return payload;
}
