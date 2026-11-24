export const MOBILE_ROLE_ACCESS_MESSAGE =
  'This OnePass mobile app is for user accounts. Admin and facility accounts must use their web dashboard.';

export function isTravelerRole(role: unknown): role is 'traveler' {
  return role === 'traveler';
}

export function assertTravelerRole(role: unknown): asserts role is 'traveler' {
  if (!isTravelerRole(role)) {
    throw new Error(MOBILE_ROLE_ACCESS_MESSAGE);
  }
}
