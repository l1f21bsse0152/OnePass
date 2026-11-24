const PACKAGE_TERMS = {
  weekly: { hoursIncluded: 10, durationDays: 7, hourlyRateMultiplier: 8 },
  monthly: { hoursIncluded: 40, durationDays: 30, hourlyRateMultiplier: 30 }
};

export const getFacilityPackageConfig = (facility, packageType) => {
  const configuredPackage = facility.packages?.[packageType];
  if (configuredPackage) {
    return configuredPackage;
  }

  const terms = PACKAGE_TERMS[packageType];
  const pointsPerHour = facility.pointsPerHour ?? facility.pointsPerVisit;
  if (!terms || !Number.isSafeInteger(pointsPerHour) || pointsPerHour < 1) {
    return null;
  }

  const pointsCost = pointsPerHour * terms.hourlyRateMultiplier;
  if (!Number.isSafeInteger(pointsCost)) {
    return null;
  }

  return {
    pointsCost,
    hoursIncluded: terms.hoursIncluded,
    durationDays: terms.durationDays
  };
};
