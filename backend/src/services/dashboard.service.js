import mongoose from "mongoose";

import Access from "../models/access.model.js";
import Facility from "../models/facility.model.js";
import FacilityPackageSubscription from "../models/facility-package-subscription.model.js";
import FacilityQR from "../models/facility-qr.model.js";
import OnePassSubscription from "../models/onepass-subscription.model.js";
import Transaction from "../models/transaction.model.js";
import User from "../models/user.model.js";
import { serializeFacilityInfoQr } from "./facility-info-qr.service.js";

const USER_ROLES = ["traveler", "facility", "admin"];
const FACILITY_STATUSES = ["pending", "active", "suspended", "inactive"];
const TRANSACTION_STATUSES = ["pending", "completed", "failed", "reversed"];
const TRANSACTION_TYPES = [
  "purchase",
  "bonus",
  "debit",
  "pass_debit",
  "package_access",
  "refund",
  "admin_credit",
  "adjustment"
];

export class DashboardError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "DashboardError";
    this.statusCode = statusCode;
  }
}

const getPagination = (query) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 20));

  return {
    page,
    limit,
    skip: (page - 1) * limit
  };
};

const getPagedResult = (items, total, page, limit) => ({
  items,
  pagination: {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit)
  }
});

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const validateFilter = (value, allowedValues, label) => {
  if (value && !allowedValues.includes(value)) {
    throw new DashboardError(`Invalid ${label} filter.`);
  }
  return value;
};

const validateBooleanFilter = (value, label) => {
  if (value === undefined || value === "") return undefined;
  if (value !== "true" && value !== "false") {
    throw new DashboardError(`Invalid ${label} filter.`);
  }
  return value === "true";
};

const normalizeFacilityInput = (input, { partial = false } = {}) => {
  const fields = [
    "name",
    "description",
    "category",
    "address",
    "city",
    "pointsPerVisit",
    "pointsPerHour",
    "capacityLimit",
    "latitude",
    "longitude",
    "amenities",
    "photos",
    "operatingHours",
    "holidayClosures",
    "timeZone",
    "acceptedAccessMethods"
  ];
  const update = {};

  for (const field of fields) {
    if (input[field] === undefined) continue;
    update[field] = input[field];
  }

  for (const field of ["name", "category", "address", "city"]) {
    if (!partial || update[field] !== undefined) {
      if (typeof update[field] !== "string" || !update[field].trim()) {
        throw new DashboardError(`${field} is required.`);
      }
      update[field] = update[field].trim();
    }
  }

  if (update.name && update.name.length > 120) {
    throw new DashboardError("Facility name must be 120 characters or fewer.");
  }
  if (update.description !== undefined && (
    typeof update.description !== "string" ||
    update.description.length > 1000
  )) {
    throw new DashboardError("Facility description must be 1000 characters or fewer.");
  }
  if (update.category) update.category = update.category.toLowerCase();

  if (!partial || update.pointsPerVisit !== undefined) {
    if (!Number.isSafeInteger(update.pointsPerVisit) || update.pointsPerVisit < 1) {
      throw new DashboardError("Points per visit must be a positive whole number.");
    }
  }
  if (!partial || update.pointsPerHour !== undefined) {
    if (!Number.isSafeInteger(update.pointsPerHour) || update.pointsPerHour < 1) {
      throw new DashboardError("Points per hour must be a positive whole number.");
    }
  }
  if (update.capacityLimit !== undefined && update.capacityLimit !== null && (
    !Number.isSafeInteger(update.capacityLimit) || update.capacityLimit < 1
  )) {
    throw new DashboardError("Capacity must be a positive whole number or left blank.");
  }
  for (const [field, minimum, maximum] of [
    ["latitude", -90, 90],
    ["longitude", -180, 180]
  ]) {
    if (update[field] !== undefined && update[field] !== null &&
      (typeof update[field] !== "number" || !Number.isFinite(update[field]) ||
        update[field] < minimum || update[field] > maximum)) {
      throw new DashboardError(`${field} must be between ${minimum} and ${maximum}.`);
    }
  }

  if (update.amenities !== undefined && (
    !Array.isArray(update.amenities) ||
    update.amenities.length > 20 ||
    update.amenities.some((item) =>
      typeof item !== "string" || !item.trim() || item.trim().length > 40
    )
  )) {
    throw new DashboardError("Provide up to 20 valid amenity names.");
  }
  if (update.photos !== undefined && (
    !Array.isArray(update.photos) ||
    update.photos.length > 8 ||
    update.photos.some((photo) => {
      if (typeof photo !== "string" || photo.length > 500) return true;
      try {
        return !["http:", "https:"].includes(new URL(photo).protocol);
      } catch {
        return true;
      }
    })
  )) {
    throw new DashboardError("Facility photos must be up to 8 valid HTTPS or HTTP URLs.");
  }
  if (update.operatingHours !== undefined) {
    const seenDays = new Set();
    if (!Array.isArray(update.operatingHours) || update.operatingHours.length > 7 ||
      update.operatingHours.some((hours) => {
        if (!hours || !Number.isInteger(hours.dayOfWeek) ||
          hours.dayOfWeek < 0 || hours.dayOfWeek > 6 ||
          typeof hours.closed !== "boolean" ||
          !/^([01]\d|2[0-3]):[0-5]\d$/.test(hours.open) ||
          !/^([01]\d|2[0-3]):[0-5]\d$/.test(hours.close) ||
          seenDays.has(hours.dayOfWeek)) return true;
        seenDays.add(hours.dayOfWeek);
        return !hours.closed && hours.close <= hours.open;
      })) {
      throw new DashboardError("Operating hours must include one valid entry per day.");
    }
  }
  if (update.holidayClosures !== undefined && (
    !Array.isArray(update.holidayClosures) ||
    update.holidayClosures.length > 30 ||
    update.holidayClosures.some((closure) =>
      !closure || Number.isNaN(new Date(closure.date).getTime()) ||
      (closure.reason !== undefined && (
        typeof closure.reason !== "string" || closure.reason.length > 120
      ))
    )
  )) {
    throw new DashboardError("Holiday closures must contain valid dates and short reasons.");
  }
  if (update.timeZone !== undefined) {
    if (typeof update.timeZone !== "string" || !update.timeZone.trim()) {
      throw new DashboardError("Choose a valid facility time zone.");
    }
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: update.timeZone.trim() });
    } catch {
      throw new DashboardError("Choose a valid facility time zone.");
    }
    update.timeZone = update.timeZone.trim();
  }
  if (update.acceptedAccessMethods !== undefined && (
    !Array.isArray(update.acceptedAccessMethods) ||
    !update.acceptedAccessMethods.length ||
    update.acceptedAccessMethods.some((method) =>
      !["wallet_points", "onepass_pass", "facility_package"].includes(method)
    )
  )) {
    throw new DashboardError("Choose at least one valid access method.");
  }

  return update;
};

const getSearchRegex = (value) => {
  if (value === undefined) return null;
  if (typeof value !== "string") {
    throw new DashboardError("Invalid search value.");
  }

  const search = value.trim();
  if (search.length > 100) {
    throw new DashboardError("Search value must be 100 characters or fewer.");
  }

  return search ? new RegExp(escapeRegex(search), "i") : null;
};

export const getAdminOverview = async () => {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const weekStart = new Date(todayStart);
  weekStart.setUTCDate(weekStart.getUTCDate() - 6);

  const [
    users,
    facilities,
    activeFacilities,
    accessEnabledFacilities,
    totalAccesses,
    todayAccesses,
    totalTransactions,
    completedTransactions,
    pointsMoved,
    activeOnePassSubscriptions,
    activeFacilityPackages,
    usersByRole,
    facilitiesByStatus,
    accessTrend,
    activeQRCodes
  ] = await Promise.all([
    User.countDocuments(),
    Facility.countDocuments(),
    Facility.countDocuments({ status: "active" }),
    Facility.countDocuments({ accessEnabled: true }),
    Access.countDocuments(),
    Access.countDocuments({ accessedAt: { $gte: todayStart } }),
    Transaction.countDocuments(),
    Transaction.countDocuments({ status: "completed" }),
    Transaction.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: null, total: { $sum: "$points" } } }
    ]),
    OnePassSubscription.countDocuments({
      status: "active",
      expiresAt: { $gt: now }
    }),
    FacilityPackageSubscription.countDocuments({
      status: "active",
      expiresAt: { $gt: now }
    }),
    User.aggregate([
      { $group: { _id: "$role", count: { $sum: 1 } } }
    ]),
    Facility.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]),
    Access.aggregate([
      { $match: { accessedAt: { $gte: weekStart } } },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$accessedAt",
              timezone: "UTC"
            }
          },
          checkIns: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]),
    FacilityQR.countDocuments({ status: "active" })
  ]);

  const roleCounts = Object.fromEntries(
    usersByRole.map(({ _id, count }) => [_id, count])
  );
  const facilityStatusCounts = Object.fromEntries(
    facilitiesByStatus.map(({ _id, count }) => [_id, count])
  );
  const trendByDate = Object.fromEntries(
    accessTrend.map(({ _id, checkIns }) => [_id, checkIns])
  );
  const activity = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setUTCDate(date.getUTCDate() + index);
    const day = date.toISOString().slice(0, 10);
    return { date: day, checkIns: trendByDate[day] || 0 };
  });

  return {
    overview: {
      users,
      facilities,
      activeFacilities,
      accessEnabledFacilities,
      activeQRCodes,
      totalAccesses,
      todayAccesses,
      totalTransactions,
      completedTransactions,
      completedPoints: pointsMoved[0]?.total || 0,
      activeOnePassSubscriptions,
      activeFacilityPackages
    },
    usersByRole: Object.fromEntries(
      USER_ROLES.map((role) => [role, roleCounts[role] || 0])
    ),
    facilitiesByStatus: Object.fromEntries(
      FACILITY_STATUSES.map((status) => [status, facilityStatusCounts[status] || 0])
    ),
    activity
  };
};

export const listAdminUsers = async (query) => {
  const { page, limit, skip } = getPagination(query);
  const role = validateFilter(query.role, USER_ROLES, "role");
  const search = getSearchRegex(query.search);
  const filter = {};

  if (role) filter.role = role;
  if (search) {
    filter.$or = [{ fullName: search }, { email: search }, { city: search }];
  }

  const [items, total] = await Promise.all([
    User.find(filter)
      .select("fullName email role city isEmailVerified lastLoginDeviceType createdAt")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filter)
  ]);

  return getPagedResult(items, total, page, limit);
};

export const getAdminFacilityInfoQr = async (facilityId) => {
  if (!mongoose.isValidObjectId(facilityId)) {
    throw new DashboardError("Invalid facility ID.");
  }

  const facility = await Facility.findById(facilityId)
    .select("name category address city description amenities operatingHours timeZone latitude longitude")
    .lean();

  if (!facility) {
    throw new DashboardError("Facility not found.", 404);
  }

  return serializeFacilityInfoQr(facility);
};

export const listAdminFacilities = async (query) => {
  const { page, limit, skip } = getPagination(query);
  const status = validateFilter(query.status, FACILITY_STATUSES, "facility status");
  const accessEnabled = validateBooleanFilter(query.accessEnabled, "access enabled");
  const hasActiveQr = validateBooleanFilter(query.hasActiveQr, "active QR");
  const search = getSearchRegex(query.search);
  const filter = {};

  if (status) filter.status = status;
  if (accessEnabled !== undefined) filter.accessEnabled = accessEnabled;
  if (hasActiveQr !== undefined) {
    const activeQrFacilities = await FacilityQR.distinct("facility", { status: "active" });
    filter._id = hasActiveQr
      ? { $in: activeQrFacilities }
      : { $nin: activeQrFacilities };
  }
  if (search) {
    filter.$or = [{ name: search }, { city: search }, { category: search }];
  }

  const [items, total] = await Promise.all([
    Facility.find(filter)
      .select("name category address city status accessEnabled isTestData owner createdAt statusChangedAt statusChangeReason")
      .populate("owner", "fullName email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Facility.countDocuments(filter)
  ]);

  const activeQrRecords = items.length
    ? await FacilityQR.find({
        facility: { $in: items.map(({ _id }) => _id) },
        status: "active"
      })
        .select("facility createdAt")
        .lean()
    : [];
  const activeQrByFacility = new Map(
    activeQrRecords.map((record) => [
      String(record.facility),
      { id: String(record._id), createdAt: record.createdAt }
    ])
  );
  const facilitiesWithQr = items.map((facility) => ({
    ...facility,
    activeQr: activeQrByFacility.get(String(facility._id)) || null
  }));

  return getPagedResult(facilitiesWithQr, total, page, limit);
};

export const listAdminTransactions = async (query) => {
  const { page, limit, skip } = getPagination(query);
  const status = validateFilter(query.status, TRANSACTION_STATUSES, "transaction status");
  const type = validateFilter(query.type, TRANSACTION_TYPES, "transaction type");
  const filter = {};

  if (status) filter.status = status;
  if (type) filter.type = type;

  const [items, total] = await Promise.all([
    Transaction.find(filter)
      .select("traveler type status points description source balanceScope createdAt")
      .populate("traveler", "fullName email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Transaction.countDocuments(filter)
  ]);

  return getPagedResult(items, total, page, limit);
};

export const listAdminAccesses = async (query) => {
  const { page, limit, skip } = getPagination(query);
  const period = validateFilter(query.period, ["today"], "access period");
  const filter = {};
  if (period === "today") {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);
    filter.accessedAt = { $gte: todayStart, $lt: tomorrowStart };
  }
  const [items, total] = await Promise.all([
    Access.find(filter)
      .select("traveler facility pointsCharged hoursUsed accessMethod accessedAt")
      .populate("traveler", "fullName email")
      .populate("facility", "name city category")
      .sort({ accessedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Access.countDocuments(filter)
  ]);

  return getPagedResult(items, total, page, limit);
};

export const getFacilityOverview = async (ownerId) => {
  const facilities = await Facility.find({
    owner: ownerId,
    isTestData: { $ne: true }
  })
    .select("name description category address city status accessEnabled pointsPerVisit pointsPerHour capacityLimit amenities photos operatingHours holidayClosures timeZone acceptedAccessMethods latitude longitude createdAt")
    .sort({ createdAt: -1 })
    .lean();
  const facilityIds = facilities.map(({ _id }) => _id);

  if (!facilityIds.length) {
    return {
      overview: {
        facilities: 0,
        activeFacilities: 0,
        totalCheckIns: 0,
        todayCheckIns: 0,
        activeQRCodes: 0
      },
      facilities,
      recentAccesses: []
    };
  }

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const [totalCheckIns, todayCheckIns, activeQRCodes, recentAccesses, activeQrRecords, occupancyByFacility, pointsUsed] =
    await Promise.all([
      Access.countDocuments({ facility: { $in: facilityIds } }),
      Access.countDocuments({
        facility: { $in: facilityIds },
        accessedAt: { $gte: todayStart }
      }),
      FacilityQR.countDocuments({
        facility: { $in: facilityIds },
        status: "active"
      }),
      Access.find({ facility: { $in: facilityIds } })
        .select("traveler facility pointsCharged hoursUsed accessMethod accessedAt")
        .populate("traveler", "fullName email")
        .populate("facility", "name")
        .sort({ accessedAt: -1 })
        .limit(10)
        .lean(),
      FacilityQR.find({
        facility: { $in: facilityIds },
        status: "active"
      })
        .select("facility createdAt")
        .lean(),
      Access.aggregate([
        {
          $match: {
            facility: { $in: facilityIds },
            $expr: {
              $gt: [
                {
                  $add: [
                    "$accessedAt",
                    { $multiply: ["$hoursUsed", 60 * 60 * 1000] }
                  ]
                },
                new Date()
              ]
            }
          }
        },
        { $group: { _id: "$facility", occupancy: { $sum: 1 } } }
      ]),
      Access.aggregate([
        { $match: { facility: { $in: facilityIds } } },
        {
          $group: {
            _id: null,
            points: { $sum: "$pointsCharged" }
          }
        }
      ])
    ]);
  const activeQrByFacility = Object.fromEntries(
    activeQrRecords.map((record) => [
      String(record.facility),
      { id: String(record._id), createdAt: record.createdAt }
    ])
  );
  const occupancyById = Object.fromEntries(
    occupancyByFacility.map((record) => [String(record._id), record.occupancy])
  );
  const facilitiesWithQr = facilities.map((facility) => ({
    ...facility,
    activeQr: activeQrByFacility[String(facility._id)] || null,
    currentOccupancy: occupancyById[String(facility._id)] || 0
  }));

  return {
    overview: {
      facilities: facilities.length,
      activeFacilities: facilities.filter(({ status }) => status === "active").length,
      totalCheckIns,
      todayCheckIns,
      activeQRCodes,
      pointsUsedAtVisits: pointsUsed[0]?.points || 0
    },
    facilities: facilitiesWithQr,
    recentAccesses
  };
};

export const listFacilityAccesses = async (ownerId, facilityId, query) => {
  if (!mongoose.isValidObjectId(facilityId)) {
    throw new DashboardError("Invalid facility ID.");
  }

  const facility = await Facility.findOne({
    _id: facilityId,
    owner: ownerId,
    isTestData: { $ne: true }
  }).select("_id");

  if (!facility) {
    throw new DashboardError("Facility not found or you do not have permission to view it.", 404);
  }

  const { page, limit, skip } = getPagination(query);
  const filter = { facility: facility._id };
  const [items, total] = await Promise.all([
    Access.find(filter)
      .select("traveler pointsCharged hoursUsed accessMethod accessedAt")
      .populate("traveler", "fullName email")
      .sort({ accessedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Access.countDocuments(filter)
  ]);

  return getPagedResult(items, total, page, limit);
};

export const createOwnedFacility = async (ownerId, input) => {
  const facilityData = normalizeFacilityInput(input);
  if ((facilityData.latitude == null) !== (facilityData.longitude == null)) {
    throw new DashboardError("Provide both map coordinates, or leave both blank.");
  }
  const facility = await Facility.create({
    ...facilityData,
    owner: ownerId,
    status: "pending",
    accessEnabled: true,
    isTestData: false
  });
  return facility;
};

export const updateOwnedFacility = async (ownerId, facilityId, input) => {
  if (!mongoose.isValidObjectId(facilityId)) {
    throw new DashboardError("Invalid facility ID.");
  }
  const facility = await Facility.findOne({
    _id: facilityId,
    owner: ownerId,
    isTestData: { $ne: true }
  });
  if (!facility) {
    throw new DashboardError("Facility not found or you do not have permission to manage it.", 404);
  }

  const updates = normalizeFacilityInput(input, { partial: true });
  const latitude = updates.latitude === undefined ? facility.latitude : updates.latitude;
  const longitude = updates.longitude === undefined ? facility.longitude : updates.longitude;
  if ((latitude == null) !== (longitude == null)) {
    throw new DashboardError("Provide both map coordinates, or leave both blank.");
  }
  Object.assign(facility, updates);
  await facility.save();
  return facility;
};

export const updateAdminFacilityStatus = async ({
  facilityId,
  adminId,
  status,
  reason
}) => {
  if (!mongoose.isValidObjectId(facilityId)) {
    throw new DashboardError("Invalid facility ID.");
  }
  if (!["pending", "active", "suspended", "inactive"].includes(status)) {
    throw new DashboardError("Choose a valid facility status.");
  }
  if (typeof reason !== "string" || !reason.trim() || reason.length > 250) {
    throw new DashboardError("Provide a reason of 1–250 characters for the status change.");
  }

  const facility = await Facility.findById(facilityId);
  if (!facility) {
    throw new DashboardError("Facility not found.", 404);
  }
  facility.status = status;
  facility.statusChangedAt = new Date();
  facility.statusChangedBy = adminId;
  facility.statusChangeReason = reason.trim();
  await facility.save();
  return facility;
};
