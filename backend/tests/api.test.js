import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import jwt from "jsonwebtoken";

import app from "../src/app.js";

describe("OnePass Backend API Suite (Sprint 1)", () => {
  let server;
  let baseUrl;
  const originalJwtSecret = process.env.JWT_SECRET;
  const originalAdminSignupEmail = process.env.ADMIN_SIGNUP_EMAIL;
  const jwtSecret = "dashboard-api-test-secret";

  before(async () => {
    process.env.JWT_SECRET = jwtSecret;
    process.env.ADMIN_SIGNUP_EMAIL = "muhammadsalahuddin1414@gmail.com";
    server = http.createServer(app);
    await new Promise((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const address = server.address();
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (originalJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalJwtSecret;
    }
    if (originalAdminSignupEmail === undefined) {
      delete process.env.ADMIN_SIGNUP_EMAIL;
    } else {
      process.env.ADMIN_SIGNUP_EMAIL = originalAdminSignupEmail;
    }
  });

  it("BE-001: Health endpoint responds with server status", async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.server, "Online");
    assert.ok(body.timestamp);
  });

  it("BE-002: Rejects invalid MongoDB ObjectId on facility details with 400", async () => {
    const res = await fetch(`${baseUrl}/api/facilities/invalid-id-format`);
    assert.equal(res.status, 400);

    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.message, "Invalid facility ID.");
  });

  it("BE-003: Welcome route responds with success", async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.message, "Welcome to OnePass API");
  });

  it("BE-004: Centralized 404 handler catches unknown routes", async () => {
    const res = await fetch(`${baseUrl}/api/unknown-endpoint-path`);
    assert.equal(res.status, 404);

    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.message, "Endpoint not found.");
  });

  it("BE-005: Unauthorized access history request is rejected with 401", async () => {
    const res = await fetch(`${baseUrl}/api/access/history`);
    assert.equal(res.status, 401);

    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.message, /authentication required/i);
  });

  it("BE-006: Unauthorized facility QR scan is rejected with 401", async () => {
    const res = await fetch(`${baseUrl}/api/access/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "test-token-without-auth" })
    });
    assert.equal(res.status, 401);

    const body = await res.json();
    assert.equal(body.success, false);
  });

  it("BE-007: Unauthorized access confirmation is rejected with 401", async () => {
    const res = await fetch(`${baseUrl}/api/access/confirm`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "test-key"
      },
      body: JSON.stringify({ token: "test-token" })
    });
    assert.equal(res.status, 401);

    const body = await res.json();
    assert.equal(body.success, false);
  });

  it("BE-008: Unauthorized wallet request is rejected with 401", async () => {
    const res = await fetch(`${baseUrl}/api/wallet`);
    assert.equal(res.status, 401);

    const body = await res.json();
    assert.equal(body.success, false);
  });

  it("BE-009: Facility QR generation route rejects unauthenticated call with 401", async () => {
    const res = await fetch(`${baseUrl}/api/facility-qr/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ facilityId: "some-facility-id" })
    });

    it("Dashboard routes reject unauthenticated access", async () => {
      const res = await fetch(`${baseUrl}/api/dashboard/admin/overview`);
      assert.equal(res.status, 401);
    });

    it("Dashboard signup only allows the configured admin email", async () => {
      const response = await fetch(`${baseUrl}/api/auth/dashboard/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: "Not Authorized",
          email: "other@example.com",
          password: "StrongPass123",
          role: "admin"
        })
      });
      const body = await response.json();

      assert.equal(response.status, 403);
      assert.equal(body.success, false);
    });

    it("Dashboard signup accepts only admin or facility account roles", async () => {
      const response = await fetch(`${baseUrl}/api/auth/dashboard/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: "New Account",
          email: "new@example.com",
          password: "StrongPass123",
          role: "traveler"
        })
      });
      const body = await response.json();

      assert.equal(response.status, 400);
      assert.equal(body.success, false);
    });

    it("Dashboard signup verification rejects invalid input without querying accounts", async () => {
      const response = await fetch(
        `${baseUrl}/api/auth/dashboard/verify-registration-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "not-an-email", otp: "123" })
        }
      );
      const body = await response.json();

      assert.equal(response.status, 400);
      assert.equal(body.success, false);
    });

    it("Forgot-password endpoint rejects an invalid email", async () => {
      const response = await fetch(`${baseUrl}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "not-an-email" })
      });

      assert.equal(response.status, 400);
      assert.equal((await response.json()).success, false);
    });

    it("Password reset rejects invalid OTP input", async () => {
      const response = await fetch(`${baseUrl}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "user@example.com",
          otp: "123",
          newPassword: "StrongPass123",
          confirmPassword: "StrongPass123"
        })
      });

      assert.equal(response.status, 400);
      assert.equal((await response.json()).success, false);
    });

    it("Dashboard role scopes reject accounts of the wrong role", async () => {
      const facilityToken = jwt.sign(
        { role: "facility" },
        jwtSecret,
        { subject: "64b000000000000000000001" }
      );
      const adminToken = jwt.sign(
        { role: "admin" },
        jwtSecret,
        { subject: "64b000000000000000000002" }
      );
      const adminResponse = await fetch(
        `${baseUrl}/api/dashboard/admin/overview`,
        { headers: { Authorization: `Bearer ${facilityToken}` } }
      );
      const facilityResponse = await fetch(
        `${baseUrl}/api/dashboard/facility/overview`,
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );

      assert.equal(adminResponse.status, 403);
      assert.equal(facilityResponse.status, 403);
    });

    it("Facility dashboard validates a facility ID before querying records", async () => {
      const facilityToken = jwt.sign(
        { role: "facility" },
        jwtSecret,
        { subject: "64b000000000000000000001" }
      );
      const response = await fetch(
        `${baseUrl}/api/dashboard/facility/facilities/not-an-id/accesses`,
        { headers: { Authorization: `Bearer ${facilityToken}` } }
      );
      const body = await response.json();

      assert.equal(response.status, 400);
      assert.equal(body.success, false);
      assert.equal(body.message, "Invalid facility ID.");
    });
    assert.equal(res.status, 401);

    const body = await res.json();
    assert.equal(body.success, false);
  });

  it("BE-010: Google sign-in rejects a missing ID token with 400", async () => {
    const res = await fetch(`${baseUrl}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    assert.equal(res.status, 400);

    const body = await res.json();
    assert.equal(body.success, false);
  });

  it("BE-011: Profile photo routes require authentication", async () => {
    const res = await fetch(`${baseUrl}/api/auth/me/photo`);
    assert.equal(res.status, 401);

    const body = await res.json();
    assert.equal(body.success, false);
  });

  it("Password change OTP routes require authentication", async () => {
    const requestCode = await fetch(
      `${baseUrl}/api/auth/me/password-otp`,
      { method: "POST" }
    );
    const updatePassword = await fetch(
      `${baseUrl}/api/auth/me/password`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          otp: "123456",
          newPassword: "Password123",
          confirmPassword: "Password123"
        })
      }
    );

    assert.equal(requestCode.status, 401);
    assert.equal(updatePassword.status, 401);
  });
});
