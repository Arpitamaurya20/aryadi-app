import { apiRequest, clearAuthToken, setAuthToken } from './client';
import { fetchEmployeeProfile } from './profile';

export type AuthUser = {
  id: number;
  employeeId: number;
  username: string;
  /** Display role / designation */
  user_type: string;
  accountType: string;
  email: string | null;
  personalEmail: string | null;
  phone: string | null;
  employee_code: string | null;
  uan: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  aadhaar: string | null;
  pan: string | null;
  photo_uri: string | null;
  aadhaarImage: string | null;
  panImage: string | null;
  policeImage: string | null;
  fatherName: string | null;
  gender: string | null;
  city: string | null;
  state: string | null;
  department: string | null;
  division: string | null;
  supervisor: string | null;
  weeklyOff: string | null;
  epfNumber: string | null;
  esicNumber: string | null;
  basicSalary: string | null;
  hra: string | null;
  da: string | null;
  bonus: string | null;
  others: string | null;
  convenienceAllowance: string | null;
  inhandSalary: string | null;
  is_active: number;
  token: string;
  tokenExpiry: string | null;
  corporateId: number;
  branchId: number;
  roles: string[];
  /** ISO date YYYY-MM-DD — account created (not joining) */
  createdDate: string | null;
  /** ISO date YYYY-MM-DD — Date of Joining from employee profile */
  joiningDate: string | null;
};

type LoginApiData = {
  UserID?: number;
  UserName?: string;
  UserType?: string;
  EmployeeID?: number;
  CorporateID?: number;
  BranchID?: number;
  IsActive?: number;
  IsEmployeeActive?: number;
  AuthToken?: string;
  TokenExpiry?: string;
  CreatedDate?: string;
  role?: {
    EmployeeRoles?: string[];
    EmployeeID?: number;
  };
};

type LoginApiResponse = {
  error?: boolean | number | string;
  message?: string;
  token?: string;
  data?: LoginApiData;
};

function isApiError(error: LoginApiResponse['error']) {
  return error === true || error === 1 || error === '1' || error === 'true';
}

/** Format API date `2026-09-21` → `21 Sep 2026` */
export function formatApiDate(value: string | null | undefined) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return value;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (monthIndex < 0 || monthIndex > 11 || !day) return value;
  return `${day} ${months[monthIndex]} ${match[1]}`;
}

export function emptyAuthExtras(): Pick<
  AuthUser,
  | 'personalEmail'
  | 'aadhaarImage'
  | 'panImage'
  | 'policeImage'
  | 'fatherName'
  | 'gender'
  | 'city'
  | 'state'
  | 'department'
  | 'division'
  | 'supervisor'
  | 'weeklyOff'
  | 'epfNumber'
  | 'esicNumber'
  | 'basicSalary'
  | 'hra'
  | 'da'
  | 'bonus'
  | 'others'
  | 'convenienceAllowance'
  | 'inhandSalary'
> {
  return {
    personalEmail: null,
    aadhaarImage: null,
    panImage: null,
    policeImage: null,
    fatherName: null,
    gender: null,
    city: null,
    state: null,
    department: null,
    division: null,
    supervisor: null,
    weeklyOff: null,
    epfNumber: null,
    esicNumber: null,
    basicSalary: null,
    hra: null,
    da: null,
    bonus: null,
    others: null,
    convenienceAllowance: null,
    inhandSalary: null,
  };
}

export async function login(username: string, password: string): Promise<AuthUser> {
  if (!username.trim() || !password) {
    throw new Error('Username and password are required.');
  }

  const payload = await apiRequest<LoginApiResponse>('login.php', {
    method: 'POST',
    auth: false,
    body: {
      username: username.trim(),
      password,
    },
  });

  if (isApiError(payload.error) || !payload.data) {
    throw new Error(payload.message || 'Invalid username or password');
  }

  const data = payload.data;
  const token = payload.token || data.AuthToken || '';
  if (!token) {
    throw new Error(payload.message || 'Login succeeded but no token was returned.');
  }

  setAuthToken(token);

  const roles = data.role?.EmployeeRoles ?? [];
  const employeeId = data.EmployeeID ?? data.role?.EmployeeID ?? 0;
  const roleLabel = roles[0] || data.UserType || 'Employee';

  const baseUser: AuthUser = {
    id: data.UserID ?? 0,
    employeeId,
    username: data.UserName || username.trim(),
    user_type: roleLabel,
    accountType: data.UserType || 'Employee',
    email: null,
    phone: null,
    employee_code: employeeId > 0 ? String(employeeId) : null,
    uan: null,
    bank_account_name: null,
    bank_account_number: null,
    aadhaar: null,
    pan: null,
    photo_uri: null,
    is_active: data.IsEmployeeActive ?? data.IsActive ?? 1,
    token,
    tokenExpiry: data.TokenExpiry ?? null,
    corporateId: data.CorporateID ?? -1,
    branchId: data.BranchID ?? -1,
    roles,
    createdDate: data.CreatedDate ?? null,
    joiningDate: null,
    ...emptyAuthExtras(),
  };

  try {
    return await fetchEmployeeProfile(baseUser);
  } catch {
    return baseUser;
  }
}

export function logout() {
  clearAuthToken();
}
