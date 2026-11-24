import { describe, expect, it } from 'vitest';

import {
  assertTravelerRole,
  isTravelerRole,
  MOBILE_ROLE_ACCESS_MESSAGE,
} from '../src/utils/mobileRoleAccess';

describe('mobile role access', () => {
  it('allows traveler accounts', () => {
    expect(isTravelerRole('traveler')).toBe(true);
    expect(() => assertTravelerRole('traveler')).not.toThrow();
  });

  it('rejects admin, facility, and unknown roles', () => {
    for (const role of ['admin', 'facility', undefined]) {
      expect(isTravelerRole(role)).toBe(false);
      expect(() => assertTravelerRole(role)).toThrow(MOBILE_ROLE_ACCESS_MESSAGE);
    }
  });
});
