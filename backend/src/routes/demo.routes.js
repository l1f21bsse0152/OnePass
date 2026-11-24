import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import express from "express";
import { serializeFacilityInfoQr } from "../services/facility-info-qr.service.js";

const initialData = JSON.parse(
  readFileSync(new URL("../data/demo/dashboard.json", import.meta.url), "utf8")
);
const data = JSON.parse(JSON.stringify(initialData));
const router = express.Router();

const respond = (res, value, status = 200) =>
  res.status(status).json({ success: true, data: value });

const getPage = (query) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 20));
  return { page, limit, start: (page - 1) * limit };
};

const listRecords = (records, query, searchFields = [], filterFields = [], matches = () => true) => {
  const { page, limit, start } = getPage(query);
  const search = typeof query.search === "string" ? query.search.trim().toLowerCase() : "";
  const filtered = records.filter((record) => {
    if (!matches(record, query)) return false;
    for (const field of ["status", ...filterFields]) {
      const value = typeof query[field] === "string" ? query[field] : "";
      if (value && record[field] !== value) return false;
    }
    if (!search) return true;
    return searchFields.some((field) =>
      String(field.split(".").reduce((value, key) => value?.[key], record) || "")
        .toLowerCase()
        .includes(search)
    );
  });
  return {
    items: filtered.slice(start, start + limit),
    pagination: {
      page,
      limit,
      total: filtered.length,
      totalPages: Math.ceil(filtered.length / limit)
    }
  };
};

const facilityOwnerFacilities = () =>
  data.facilities.filter((facility) => facility.owner?.email === "jordan@example.test");

const facilityLocalDate = () => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Karachi",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    })
      .formatToParts(new Date())
      .map(({ type, value }) => [type, value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const syncAdminOverview = () => {
  data.adminOverview.overview.facilities = data.facilities.length;
  data.adminOverview.overview.activeFacilities = data.facilities.filter(
    (facility) => facility.status === "active"
  ).length;
  data.adminOverview.overview.accessEnabledFacilities = data.facilities.filter(
    (facility) => facility.accessEnabled
  ).length;
  data.adminOverview.overview.activeQRCodes = data.facilities.filter(
    (facility) => facility.activeQr
  ).length;
  data.adminOverview.overview.totalTransactions = data.transactions.length;
  data.adminOverview.facilitiesByStatus = Object.fromEntries(
    ["pending", "active", "suspended", "inactive"].map((status) => [
      status,
      data.facilities.filter((facility) => facility.status === status).length
    ])
  );
};

const getFacility = (id) => data.facilities.find((facility) => facility._id === id);

router.get("/dashboard/admin/overview", (_req, res) =>
  respond(res, data.adminOverview)
);

router.get("/dashboard/admin/users", (req, res) =>
  respond(res, listRecords(data.users, req.query, ["fullName", "email", "city"], ["role"]))
);

router.get("/dashboard/admin/facilities", (req, res) => {
  const { accessEnabled, hasActiveQr } = req.query;
  if ([accessEnabled, hasActiveQr].some((value) =>
    value !== undefined && value !== "" && value !== "true" && value !== "false"
  )) {
    return res.status(400).json({ success: false, message: "Invalid facility access filter." });
  }
  return respond(res, listRecords(
    data.facilities,
    req.query,
    ["name", "city", "category"],
    [],
    (facility, query) =>
      (!query.accessEnabled || String(facility.accessEnabled !== false) === query.accessEnabled) &&
      (!query.hasActiveQr || String(Boolean(facility.activeQr)) === query.hasActiveQr)
  ));
});

router.get("/dashboard/admin/facilities/:facilityId/info-qr", (req, res) => {
  const facility = getFacility(req.params.facilityId);
  if (!facility) {
    return res.status(404).json({ success: false, message: "Demo facility not found." });
  }
  return respond(res, serializeFacilityInfoQr(facility));
});

router.patch("/dashboard/admin/facilities/:facilityId/status", (req, res) => {
  const facility = getFacility(req.params.facilityId);
  const { status, reason } = req.body || {};
  if (!facility) return res.status(404).json({ success: false, message: "Demo facility not found." });
  if (!["pending", "active", "suspended", "inactive"].includes(status) ||
      typeof reason !== "string" || !reason.trim()) {
    return res.status(400).json({ success: false, message: "Choose a valid status and enter a reason." });
  }
  facility.status = status;
  facility.statusChangedAt = new Date().toISOString();
  facility.statusChangeReason = reason.trim();
  syncAdminOverview();
  return respond(res, facility);
});

router.get("/dashboard/admin/transactions", (req, res) =>
  respond(res, listRecords(data.transactions, req.query, [
    "traveler.fullName",
    "traveler.email",
    "type",
    "description"
  ], ["type"]))
);

router.get("/dashboard/admin/accesses", (req, res) => {
  if (req.query.period && req.query.period !== "today") {
    return res.status(400).json({ success: false, message: "Invalid access period filter." });
  }
  const today = new Date().toISOString().slice(0, 10);
  return respond(res, listRecords(data.accesses, req.query, [
    "traveler.fullName",
    "traveler.email",
    "facility.name",
    "facility.city"
  ], [], (access, query) =>
    query.period !== "today" || String(access.accessedAt || "").slice(0, 10) === today
  ));
});

router.get("/dashboard/facility/overview", (_req, res) => {
  const facilities = facilityOwnerFacilities();
  const facilityIds = new Set(facilities.map((facility) => facility._id));
  const accesses = data.accesses.filter((access) => facilityIds.has(access.facility?._id));
  const today = facilityLocalDate();
  const activeQrCount = facilities.filter((facility) => facility.activeQr).length;
  return respond(res, {
    overview: {
      facilities: facilities.length,
      activeFacilities: facilities.filter((facility) => facility.status === "active").length,
      totalCheckIns: accesses.length,
      todayCheckIns: accesses.filter((access) => access.accessedAt.startsWith(today)).length,
      activeQRCodes: activeQrCount,
      pointsUsedAtVisits: accesses.reduce((sum, access) => sum + access.pointsCharged, 0)
    },
    facilities,
    recentAccesses: accesses.slice(0, 10)
  });
});

router.get("/dashboard/facility/facilities/:facilityId/accesses", (req, res) => {
  const facility = getFacility(req.params.facilityId);
  if (!facility || facility.owner?.email !== "jordan@example.test") {
    return res.status(404).json({ success: false, message: "Demo facility not found." });
  }
  const accesses = data.accesses.filter(
    (access) => access.facility?._id === facility._id
  );
  return respond(res, listRecords(accesses, req.query, [
    "traveler.fullName",
    "traveler.email",
    "accessMethod"
  ]));
});

router.post("/dashboard/facility/facilities", (req, res) => {
  const facility = {
    ...req.body,
    _id: `demo-facility-${randomUUID()}`,
    status: "pending",
    accessEnabled: true,
    currentOccupancy: 0,
    activeQr: null,
    owner: { fullName: "Jordan Lee", email: "jordan@example.test" },
    createdAt: new Date().toISOString(),
    isTestData: false
  };
  data.facilities.push(facility);
  syncAdminOverview();
  return respond(res, facility, 201);
});

router.patch("/dashboard/facility/facilities/:facilityId", (req, res) => {
  const facility = getFacility(req.params.facilityId);
  if (!facility || facility.owner?.email !== "jordan@example.test") {
    return res.status(404).json({ success: false, message: "Demo facility not found." });
  }
  Object.assign(facility, req.body || {});
  return respond(res, facility);
});

router.post("/facility-qr/generate", (req, res) => {
  const facility = getFacility(req.body?.facilityId);
  if (!facility || facility.owner?.email !== "jordan@example.test") {
    return res.status(404).json({ success: false, message: "Demo facility not found." });
  }
  const createdAt = new Date().toISOString();
  facility.activeQr = { id: `demo-qr-${randomUUID()}`, createdAt };
  return respond(res, {
    token: `onepass-demo-qr-${randomUUID()}`,
    qr: { createdAt }
  });
});

export default router;
