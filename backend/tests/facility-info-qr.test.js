import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { serializeFacilityInfoQr } from "../src/services/facility-info-qr.service.js";

describe("facility information QR payload", () => {
  it("includes readable facility details and produces a unique payload per facility", () => {
    const facility = {
      _id: "facility-001",
      name: "Northside Fitness Club",
      category: "gym",
      address: "18 Garden Avenue",
      city: "Lahore",
      description: "Strength and group fitness studio.",
      amenities: ["Showers", "Lockers"],
      operatingHours: [
        { dayOfWeek: 1, open: "08:00", close: "18:00", closed: false },
        { dayOfWeek: 0, open: "00:00", close: "00:00", closed: true }
      ],
      timeZone: "Asia/Karachi",
      owner: { email: "private@example.test" },
      activeQr: { token: "private-access-token" }
    };

    const result = serializeFacilityInfoQr(facility);
    const otherResult = serializeFacilityInfoQr({ ...facility, _id: "facility-002" });

    assert.equal(result.facility.id, "facility-001");
    assert.match(result.payload, /Name: Northside Fitness Club/);
    assert.match(result.payload, /Location: 18 Garden Avenue, Lahore/);
    assert.match(result.payload, /Amenities: Showers, Lockers/);
    assert.match(result.payload, /Sunday: Closed\nMonday: 08:00–18:00/);
    assert.notEqual(result.payload, otherResult.payload);
    assert.doesNotMatch(result.payload, /private@example\.test|private-access-token/);
  });
});
