import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import jwt from "jsonwebtoken";

import app from "../src/app.js";

describe("admin facility information QR endpoint", () => {
  let server;
  let baseUrl;
  const originalJwtSecret = process.env.JWT_SECRET;
  const jwtSecret = "facility-info-qr-api-test-secret";

  before(async () => {
    process.env.JWT_SECRET = jwtSecret;
    server = http.createServer(app);
    await new Promise((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;
  });

  it("requires authentication and an admin role", async () => {
    const url = `${baseUrl}/api/dashboard/admin/facilities/invalid-id/info-qr`;
    const anonymousResponse = await fetch(url);
    const facilityToken = jwt.sign(
      { role: "facility" },
      jwtSecret,
      { subject: "64b000000000000000000001" }
    );
    const facilityResponse = await fetch(url, {
      headers: { Authorization: `Bearer ${facilityToken}` }
    });

    assert.equal(anonymousResponse.status, 401);
    assert.equal(facilityResponse.status, 403);
  });

  it("validates the facility ID after admin authorization", async () => {
    const adminToken = jwt.sign(
      { role: "admin" },
      jwtSecret,
      { subject: "64b000000000000000000002" }
    );
    const response = await fetch(
      `${baseUrl}/api/dashboard/admin/facilities/invalid-id/info-qr`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.message, "Invalid facility ID.");
  });

  it("serves the same facility details in dashboard sample mode", async () => {
    const response = await fetch(
      `${baseUrl}/api/demo/dashboard/admin/facilities/demo-facility-001/info-qr`
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.match(body.data.payload, /Name: Northside Fitness Club/);
    assert.match(body.data.payload, /Location: 18 Garden Avenue, Lahore/);
  });
});
