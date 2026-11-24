import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { getFacilityPackageConfig } from "../src/services/facility-package-config.js";

describe("facility package configuration", () => {
  it("derives stable weekly and monthly package prices from the hourly rate", () => {
    const facility = { pointsPerHour: 125, packages: {} };

    assert.deepEqual(getFacilityPackageConfig(facility, "weekly"), {
      pointsCost: 1000,
      hoursIncluded: 10,
      durationDays: 7
    });
    assert.deepEqual(getFacilityPackageConfig(facility, "monthly"), {
      pointsCost: 3750,
      hoursIncluded: 40,
      durationDays: 30
    });
  });

  it("keeps explicitly configured packages and does not invent invalid prices", () => {
    const configuredPackage = {
      pointsCost: 850,
      hoursIncluded: 10,
      durationDays: 7
    };

    assert.equal(
      getFacilityPackageConfig(
        { pointsPerHour: 125, packages: { weekly: configuredPackage } },
        "weekly"
      ),
      configuredPackage
    );
    assert.equal(
      getFacilityPackageConfig({ pointsPerHour: 0, packages: {} }, "weekly"),
      null
    );
    assert.equal(
      getFacilityPackageConfig(
        { pointsPerHour: Number.MAX_SAFE_INTEGER, packages: {} },
        "weekly"
      ),
      null
    );
  });
});
