import { apiRequest } from './api';
import { File } from 'expo-file-system';

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface Facility {
  _id: string;
  name: string;
  category: string;
  city: string;
  address: string;
  description: string;
  pointsPerVisit: number;
  pointsPerHour?: number;
  packages?: {
    weekly?: FacilityPackage;
    monthly?: FacilityPackage;
  };
  status: string;
  accessEnabled?: boolean;
  latitude?: number;
  longitude?: number;
}

export interface FacilityPackage {
  pointsCost: number;
  hoursIncluded: number;
  durationDays: number;
}

export type FacilityPackageType = 'weekly' | 'monthly';

export interface PassPlan {
  _id: string;
  code: string;
  name: string;
  duration: FacilityPackageType;
  durationDays: number;
  includedPoints: number;
  bonusPoints: number;
  demoOnly: boolean;
}

export interface PassStatus {
  hasActivePass: boolean;
  subscriptions: {
    _id: string;
    plan: Pick<PassPlan, 'code' | 'name' | 'duration' | 'includedPoints' | 'bonusPoints'>;
    pointsRemaining: number;
    startsAt: string;
    expiresAt: string;
  }[];
}

export interface FacilityList {
  facilities: Facility[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface WalletBalance {
  walletId: string;
  purchasedPoints: number;
  bonusPoints: number;
  totalAvailablePoints: number;
  status: 'active' | 'frozen';
}

export interface WalletTransaction {
  _id: string;
  type: string;
  status: string;
  points: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  source: string;
  balanceScope?: 'wallet' | 'onepass_pass' | 'facility_package';
  createdAt: string;
}

export interface TransactionList {
  transactions: WalletTransaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface AccessPreview {
  facility: {
    id: string;
    name: string;
    category: string;
    address: string;
    city: string;
    pointsPerVisit: number;
    pointsPerHour: number;
  };
  wallet: WalletBalance;
  accessOptions: {
    walletPoints: {
      maxHours: number;
      pointsPerHour: number;
    };
    onePass: {
      subscriptionId: string;
      plan: Pick<PassPlan, 'name' | 'duration' | 'includedPoints' | 'bonusPoints'>;
      pointsRemaining: number;
      maxHours: number;
      expiresAt: string;
    }[];
    facilityPackages: {
      subscriptionId: string;
      packageType: FacilityPackageType;
      hoursRemaining: number;
      maxHours: number;
      expiresAt: string;
    }[];
  };
  canAccess: boolean;
}

export type AccessMethod =
  | 'wallet_points'
  | 'onepass_pass'
  | 'facility_package';

export interface AccessVisit {
  _id: string;
  pointsCharged: number;
  hoursUsed: number;
  accessMethod: AccessMethod;
  accessedAt: string;
  facility: Pick<
    Facility,
    | '_id'
    | 'name'
    | 'category'
    | 'city'
    | 'address'
    | 'pointsPerVisit'
    | 'pointsPerHour'
  >;
  transaction?: Pick<
    WalletTransaction,
    'status' | 'points' | 'balanceBefore' | 'balanceAfter'
  >;
}

export interface MonthlyHistory {
  month: string;
  timezone: string;
  visits: {
    items: AccessVisit[];
    pagination: AccessHistory['pagination'];
  };
  transactions: {
    items: WalletTransaction[];
    pagination: AccessHistory['pagination'];
  };
}

export interface AccessHistory {
  visits: AccessVisit[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  isEmailVerified?: boolean;
  role: 'traveler' | 'facility' | 'admin';
  phoneNumber?: string | null;
  city?: string | null;
  country?: string | null;
  dateOfBirth?: string | null;
  bloodGroup?: string | null;
  emergencyContact?: EmergencyContact | null;
  profilePhotoUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface EmergencyContact {
  name: string;
  phoneNumber: string;
  relationship: string;
}

export interface ProfileUpdate {
  fullName: string;
  phoneNumber: string | null;
  city: string | null;
  country: string | null;
  dateOfBirth: string | null;
  bloodGroup: string | null;
  emergencyContact: EmergencyContact | null;
}

export async function getFacilities(options: {
  search?: string;
  category?: string;
  city?: string;
  page?: number;
  limit?: number;
} = {}) {
  const response = await apiRequest<ApiEnvelope<FacilityList>>(
    '/facilities',
    {
      params: {
        search: options.search,
        category: options.category,
        city: options.city,
        page: options.page ?? 1,
        limit: options.limit ?? 20,
      },
      skipAuth: true,
    }
  );
  return response.data;
}

export async function getAllFacilities() {
  const firstPage = await getFacilities({ page: 1, limit: 50 });
  const facilities = [...firstPage.facilities];

  for (let page = 2; page <= firstPage.pagination.pages; page += 1) {
    const result = await getFacilities({ page, limit: 50 });
    facilities.push(...result.facilities);
  }

  return facilities;
}

export async function getFacility(id: string) {
  const response = await apiRequest<ApiEnvelope<Facility>>(
    `/facilities/${encodeURIComponent(id)}`,
    { skipAuth: true }
  );
  return response.data;
}

export async function purchaseFacilityPackage(
  facilityId: string,
  packageType: FacilityPackageType,
  idempotencyKey: string
) {
  const response = await apiRequest<
    ApiEnvelope<{
      subscription: {
        _id: string;
        packageType: FacilityPackageType;
        hoursIncluded: number;
        hoursRemaining: number;
        pointsCost: number;
        expiresAt: string;
      };
      transaction: WalletTransaction;
      duplicate: boolean;
    }>
  >(
    `/facilities/${encodeURIComponent(facilityId)}/packages/${packageType}/purchase`,
    {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
    }
  );
  return response.data;
}

export async function getPassPlans() {
  const response = await apiRequest<ApiEnvelope<{ plans: PassPlan[] }>>(
    '/passes/plans',
    { skipAuth: true }
  );
  return response.data.plans;
}

export async function getMyPassStatus() {
  const response = await apiRequest<ApiEnvelope<PassStatus>>('/passes/me');
  return response.data;
}

export async function getWallet() {
  const response = await apiRequest<ApiEnvelope<WalletBalance>>('/wallet');
  return response.data;
}

export async function getTransactions(page = 1) {
  const response = await apiRequest<ApiEnvelope<TransactionList>>(
    '/wallet/transactions',
    { params: { page, limit: 20 } }
  );
  return response.data;
}

export async function scanFacility(token: string) {
  const response = await apiRequest<ApiEnvelope<AccessPreview>>(
    '/access/scan',
    {
      method: 'POST',
      body: JSON.stringify({ token }),
    }
  );
  return response.data;
}

export async function confirmFacilityAccess(
  token: string,
  choice: {
    accessMethod: AccessMethod;
    hours: number;
    idempotencyKey: string;
    onePassSubscriptionId?: string;
    facilityPackageSubscriptionId?: string;
  }
) {
  const response = await apiRequest<
    ApiEnvelope<{
      access: AccessVisit;
      transaction: WalletTransaction;
      pointsCharged: number;
      duplicate: boolean;
    }>
  >('/access/confirm', {
    method: 'POST',
    headers: {
      'Idempotency-Key': choice.idempotencyKey,
    },
    body: JSON.stringify({
      token,
      accessMethod: choice.accessMethod,
      hours: choice.hours,
      onePassSubscriptionId: choice.onePassSubscriptionId,
      facilityPackageSubscriptionId:
        choice.facilityPackageSubscriptionId,
    }),
  });
  return response.data;
}

export async function getAccessHistory(page = 1) {
  const response = await apiRequest<ApiEnvelope<AccessHistory>>(
    '/access/history',
    { params: { page, limit: 20 } }
  );
  return response.data;
}

export async function getMonthlyHistory(month?: string, page = 1) {
  const response = await apiRequest<ApiEnvelope<MonthlyHistory>>(
    '/history/monthly',
    { params: { month, page, limit: 20 } }
  );
  return response.data;
}

export async function updateProfile(payload: ProfileUpdate) {
  const response = await apiRequest<ApiEnvelope<{ user: UserProfile }>>(
    '/auth/me',
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    }
  );
  return response.data.user;
}

export async function uploadProfilePhoto(asset: {
  uri: string;
}) {
  const formData = new FormData();
  const photoFile = new File(asset.uri);
  // Expo's multipart fetch serializer reads FileSystem files through bytes().
  formData.append('photo', photoFile);

  const response = await apiRequest<ApiEnvelope<{ user: UserProfile }>>(
    '/auth/me/photo',
    {
      method: 'POST',
      body: formData,
      multipart: true,
    }
  );
  return response.data.user;
}

export async function deleteProfilePhoto() {
  const response = await apiRequest<ApiEnvelope<{ user: UserProfile }>>(
    '/auth/me/photo',
    { method: 'DELETE' }
  );
  return response.data.user;
}

export async function changePassword(payload: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}) {
  return apiRequest<{ success: boolean; message: string }>(
    '/auth/change-password',
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }
  );
}

export async function requestPasswordChangeOTP() {
  return apiRequest<{ success: boolean; message: string }>(
    '/auth/me/password-otp',
    { method: 'POST' }
  );
}

export async function changePasswordWithOTP(payload: {
  otp: string;
  newPassword: string;
  confirmPassword: string;
}) {
  return apiRequest<{ success: boolean; message: string }>(
    '/auth/me/password',
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }
  );
}
