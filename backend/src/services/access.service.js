
import mongoose from "mongoose";
import { createHash } from "crypto";

import Facility from "../models/facility.model.js";
import FacilityQR from "../models/facility-qr.model.js";
import Access from "../models/access.model.js";
import Transaction from "../models/transaction.model.js";
import Wallet from "../models/wallet.model.js";
import OnePassSubscription from "../models/onepass-subscription.model.js";
import FacilityPackageSubscription from "../models/facility-package-subscription.model.js";

import {
  debitPointsInSession,
  getWalletBalance
} from "./wallet.service.js";

class AccessError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "AccessError";
    this.statusCode = statusCode;
  }
}

const hashQRToken = (token) => {
  return createHash("sha256")
    .update(token)
    .digest("hex");
};

const normalizeIdempotencyKey = (key) => {
  if (typeof key !== "string") {
    throw new AccessError(
      "A valid Idempotency-Key header is required."
    );
  }

  const normalizedKey = key.trim();

  if (!normalizedKey || normalizedKey.length > 128) {
    throw new AccessError(
      "Idempotency key must be between 1 and 128 characters."
    );
  }

  return normalizedKey;
};

const validateScanInput = ({ travelerId, token }) => {
  if (!mongoose.isValidObjectId(travelerId)) {
    throw new AccessError("Invalid user ID.", 400);
  }

  if (
    typeof token !== "string" ||
    token.trim().length < 20 ||
    token.trim().length > 256
  ) {
    throw new AccessError(
      "Invalid or missing facility QR token.",
      400
    );
  }

  return token.trim();
};

const validateAccessChoice = ({
  accessMethod,
  hours,
  onePassSubscriptionId,
  facilityPackageSubscriptionId
}) => {
  if (
    !["wallet_points", "onepass_pass", "facility_package"].includes(
      accessMethod
    )
  ) {
    throw new AccessError("Choose a valid access method.");
  }

  if (!Number.isSafeInteger(hours) || hours < 1 || hours > 24) {
    throw new AccessError(
      "Access duration must be between 1 and 24 whole hours."
    );
  }

  if (
    accessMethod === "onepass_pass" &&
    !mongoose.isValidObjectId(onePassSubscriptionId)
  ) {
    throw new AccessError("Choose an active OnePass Pass.");
  }

  if (
    accessMethod === "facility_package" &&
    !mongoose.isValidObjectId(facilityPackageSubscriptionId)
  ) {
    throw new AccessError("Choose an active facility package.");
  }
};

const findActiveFacilityQR = async (tokenHash, session = null) => {
  let query = FacilityQR.findOne({ tokenHash })
    .select("+tokenHash");

  if (session) {
    query = query.session(session);
  }

  const qrRecord = await query;

  if (!qrRecord) {
    throw new AccessError(
      "Invalid facility QR code.",
      404
    );
  }

  if (qrRecord.status !== "active") {
    throw new AccessError(
      "This facility QR code is no longer active.",
      400
    );
  }

  // Permanent QR codes have expiresAt = null.
  // Temporary QR codes are checked against their expiry.
  if (
    qrRecord.expiresAt &&
    qrRecord.expiresAt <= new Date()
  ) {
    throw new AccessError(
      "This facility QR code has expired.",
      400
    );
  }

  return qrRecord;
};

const ensureFacilityOpen = (facility, now = new Date()) => {
  const timeZone = facility.timeZone || "UTC";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    })
      .formatToParts(now)
      .map(({ type, value }) => [type, value])
  );
  const localDate = `${parts.year}-${parts.month}-${parts.day}`;

  if (
    facility.holidayClosures?.some(
      (closure) =>
        new Date(closure.date).toISOString().slice(0, 10) === localDate
    )
  ) {
    throw new AccessError("This facility is closed for a scheduled holiday.", 403);
  }

  if (facility.operatingHours?.length) {
    const weekdayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
      .indexOf(parts.weekday);
    const hours = facility.operatingHours.find(
      (entry) => entry.dayOfWeek === weekdayIndex
    );
    const currentTime = `${parts.hour}:${parts.minute}`;
    if (!hours || hours.closed || currentTime < hours.open || currentTime >= hours.close) {
      throw new AccessError("This facility is currently outside operating hours.", 403);
    }
  }
};

const findActiveFacility = async (facilityId, session = null) => {
  let query = Facility.findById(facilityId);

  if (session) {
    query = query.session(session);
  }

  const facility = await query;

  if (!facility) {
    throw new AccessError("Facility not found.", 404);
  }

  if (facility.isTestData) {
    throw new AccessError("Facility not found.", 404);
  }

  if (facility.status !== "active") {
    throw new AccessError(
      "This facility is currently unavailable.",
      403
    );
  }

  if (facility.accessEnabled === false) {
    throw new AccessError(
      "This directory listing does not support OnePass access.",
      403
    );
  }

  ensureFacilityOpen(facility);

  const pointsRequired = facility.pointsPerVisit;

  if (
    !Number.isSafeInteger(pointsRequired) ||
    pointsRequired <= 0
  ) {
    throw new AccessError(
      "Facility point configuration is invalid.",
      500
    );
  }

  const pointsPerHour =
    facility.pointsPerHour ?? facility.pointsPerVisit;

  if (
    !Number.isSafeInteger(pointsPerHour) ||
    pointsPerHour <= 0
  ) {
    throw new AccessError(
      "Facility hourly point configuration is invalid.",
      500
    );
  }

  return facility;
};

/**
 * STEP 1: Scan and preview facility access.
 *
 * This function does NOT deduct points.
 * It only identifies the facility and retrieves
 * the current wallet balance.
 */
export const previewFacilityQR = async ({
  travelerId,
  token
}) => {
  const normalizedToken = validateScanInput({
    travelerId,
    token
  });

  const tokenHash = hashQRToken(normalizedToken);

  const qrRecord = await findActiveFacilityQR(tokenHash);

  const facility = await findActiveFacility(qrRecord.facility);
  const acceptedAccessMethods = Array.isArray(facility.acceptedAccessMethods)
    ? facility.acceptedAccessMethods
    : ["wallet_points", "onepass_pass", "facility_package"];
  const currentOccupancy = facility.capacityLimit
    ? await Access.countDocuments({
        facility: facility._id,
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
      })
    : 0;
  const isAtCapacity = Boolean(
    facility.capacityLimit &&
    currentOccupancy >= facility.capacityLimit
  );

  // Retrieves the wallet balance without performing
  // a facility access deduction.
  const wallet = await getWalletBalance(travelerId);

  const pointsPerHour =
    facility.pointsPerHour ?? facility.pointsPerVisit;
  const now = new Date();
  const [passes, facilityPackages] = await Promise.all([
    OnePassSubscription.find({
      traveler: travelerId,
      status: "active",
      startsAt: { $lte: now },
      expiresAt: { $gt: now },
      pointsRemaining: { $gt: 0 }
    })
      .populate("plan", "name duration includedPoints bonusPoints")
      .sort({ expiresAt: 1 })
      .lean(),
    FacilityPackageSubscription.find({
      traveler: travelerId,
      facility: facility._id,
      status: "active",
      startsAt: { $lte: now },
      expiresAt: { $gt: now },
      hoursRemaining: { $gt: 0 }
    })
      .sort({ expiresAt: 1 })
      .lean()
  ]);
  const accessOptions = {
    walletPoints: {
      maxHours: acceptedAccessMethods.includes("wallet_points")
        ? Math.min(
            24,
            Math.floor(wallet.totalAvailablePoints / pointsPerHour)
          )
        : 0,
      pointsPerHour
    },
    onePass: acceptedAccessMethods.includes("onepass_pass")
      ? passes.map((pass) => ({
      subscriptionId: pass._id,
      plan: pass.plan,
      pointsRemaining: pass.pointsRemaining,
      maxHours: Math.min(
        24,
        Math.floor(pass.pointsRemaining / pointsPerHour)
      ),
      expiresAt: pass.expiresAt
    }))
      : [],
    facilityPackages: acceptedAccessMethods.includes("facility_package")
      ? facilityPackages.map((facilityPackage) => ({
      subscriptionId: facilityPackage._id,
      packageType: facilityPackage.packageType,
      hoursRemaining: facilityPackage.hoursRemaining,
      maxHours: Math.min(24, facilityPackage.hoursRemaining),
      expiresAt: facilityPackage.expiresAt
    }))
      : []
  };

  return {
    facility: {
      id: facility._id,
      name: facility.name,
      category: facility.category,
      address: facility.address,
      city: facility.city,
      pointsPerVisit: facility.pointsPerVisit,
      pointsPerHour,
      capacityLimit: facility.capacityLimit ?? null,
      currentOccupancy,
      isAtCapacity
    },

    wallet: {
      walletId: wallet.walletId,
      purchasedPoints: wallet.purchasedPoints,
      bonusPoints: wallet.bonusPoints,
      totalAvailablePoints: wallet.totalAvailablePoints,
      status: wallet.status
    },

    accessOptions,
    canAccess: !isAtCapacity && (
      accessOptions.walletPoints.maxHours > 0 ||
      accessOptions.onePass.some((pass) => pass.maxHours > 0) ||
      accessOptions.facilityPackages.some(
        (facilityPackage) => facilityPackage.maxHours > 0
      )
    )
  };
};

/**
 * STEP 2: Confirm facility access.
 *
 * Points are deducted ONLY after the traveler confirms.
 * Wallet deduction and access creation happen in the
 * same MongoDB transaction.
 */
export const confirmFacilityAccess = async ({
  travelerId,
  token,
  idempotencyKey,
  accessMethod,
  hours,
  onePassSubscriptionId = null,
  facilityPackageSubscriptionId = null
}) => {
  const normalizedToken = validateScanInput({
    travelerId,
    token
  });

  const normalizedKey =
    normalizeIdempotencyKey(idempotencyKey);

  validateAccessChoice({
    accessMethod,
    hours,
    onePassSubscriptionId,
    facilityPackageSubscriptionId
  });

  const tokenHash = hashQRToken(normalizedToken);

  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      // Find the QR record.
      const qrRecord = await FacilityQR.findOne({
        tokenHash
      })
        .select("+tokenHash")
        .session(session);

      if (!qrRecord) {
        throw new AccessError(
          "Invalid facility QR code.",
          404
        );
      }

      // Check for an already completed request first.
      // This makes retries safe even if the QR was
      // subsequently replaced or revoked.
      const existingAccess = await Access.findOne({
        idempotencyKey: normalizedKey
      }).session(session);

      if (existingAccess) {
        const sameTraveler =
          existingAccess.traveler.toString() ===
          travelerId.toString();

        const sameQR =
          existingAccess.facilityQR.toString() ===
          qrRecord._id.toString();
        const sameChoice =
          existingAccess.accessMethod === accessMethod &&
          existingAccess.hoursUsed === hours &&
          (existingAccess.onePassSubscription?.toString() ?? null) ===
            (onePassSubscriptionId ?? null) &&
          (
            existingAccess.facilityPackageSubscription?.toString() ??
            null
          ) === (facilityPackageSubscriptionId ?? null);

        if (!sameTraveler || !sameQR || !sameChoice) {
          throw new AccessError(
            "Idempotency key was already used for another access request.",
            409
          );
        }

        const existingTransaction =
          await Transaction.findById(
            existingAccess.transaction
          ).session(session);

        if (!existingTransaction) {
          throw new AccessError(
            "Original access transaction could not be found.",
            500
          );
        }

        result = {
          access: existingAccess,
          transaction: existingTransaction,
          balanceAfter: existingTransaction.balanceAfter,
          duplicate: true
        };

        return;
      }

      // Validate that the QR is still active.
      await findActiveFacilityQR(tokenHash, session);

      // Recheck the facility and its current points price.
      const facility = await findActiveFacility(
        qrRecord.facility,
        session
      );

      if (
        Array.isArray(facility.acceptedAccessMethods) &&
        !facility.acceptedAccessMethods.includes(accessMethod)
      ) {
        throw new AccessError(
          "This facility does not accept the selected access method.",
          403
        );
      }

      if (facility.capacityLimit) {
        await Facility.updateOne(
          { _id: facility._id },
          { $inc: { capacityRevision: 1 } },
          { session }
        );
        const currentOccupancy = await Access.countDocuments({
          facility: facility._id,
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
        }).session(session);

        if (currentOccupancy >= facility.capacityLimit) {
          throw new AccessError(
            "This facility is currently at capacity.",
            409
          );
        }
      }

      const pointsPerHour =
        facility.pointsPerHour ?? facility.pointsPerVisit;
      const pointsRequired = pointsPerHour * hours;

      if (!Number.isSafeInteger(pointsRequired)) {
        throw new AccessError(
          "Requested access duration exceeds the supported point range."
        );
      }

      const description =
        `Facility access: ${facility.name} (${hours} hour${hours === 1 ? "" : "s"})`;
      let transaction;
      let wallet;
      let pointsCharged = pointsRequired;

      if (accessMethod === "wallet_points") {
        const debitResult = await debitPointsInSession({
          session,
          travelerId,
          points: pointsRequired,
          description,
          source: "facility_access",
          referenceId: facility._id.toString(),
          idempotencyKey: normalizedKey
        });

        if (debitResult.duplicate) {
          throw new AccessError(
            "This idempotency key has already been used for another wallet operation.",
            409
          );
        }

        transaction = debitResult.transaction;
        wallet = debitResult.wallet;
      } else {
        wallet = await Wallet.findOne({
          traveler: travelerId
        }).session(session);

        if (!wallet) {
          wallet = new Wallet({
            traveler: travelerId,
            purchasedPointsBalance: 0,
            bonusPointsBalance: 0,
            status: "active"
          });
          await wallet.save({ session });
        }

        if (wallet.status !== "active") {
          throw new AccessError(
            "Your wallet is currently frozen.",
            403
          );
        }

        if (accessMethod === "onepass_pass") {
          const pass = await OnePassSubscription.findOne({
            _id: onePassSubscriptionId,
            traveler: travelerId,
            status: "active",
            startsAt: { $lte: new Date() },
            expiresAt: { $gt: new Date() }
          }).session(session);

          if (!pass) {
            throw new AccessError(
              "An active OnePass Pass is required.",
              403
            );
          }

          if (pass.pointsRemaining < pointsRequired) {
            throw new AccessError(
              "The OnePass Pass does not have enough points.",
              400
            );
          }

          const balanceBefore = pass.pointsRemaining;
          pass.pointsRemaining -= pointsRequired;
          await pass.save({ session });

          transaction = new Transaction({
            wallet: wallet._id,
            traveler: travelerId,
            type: "pass_debit",
            status: "completed",
            points: pointsRequired,
            balanceBefore,
            balanceAfter: pass.pointsRemaining,
            balanceScope: "onepass_pass",
            description,
            source: "onepass_pass",
            referenceId: facility._id.toString(),
            idempotencyKey: normalizedKey,
            onePassSubscription: pass._id
          });
          await transaction.save({ session });
        } else {
          const facilityPackage =
            await FacilityPackageSubscription.findOne({
              _id: facilityPackageSubscriptionId,
              traveler: travelerId,
              facility: facility._id,
              status: "active",
              startsAt: { $lte: new Date() },
              expiresAt: { $gt: new Date() },
              hoursRemaining: { $gte: hours }
            }).session(session);

          if (!facilityPackage) {
            throw new AccessError(
              "An active facility package with enough hours is required.",
              403
            );
          }

          const balanceBefore = facilityPackage.hoursRemaining;
          facilityPackage.hoursRemaining -= hours;
          if (facilityPackage.hoursRemaining === 0) {
            facilityPackage.status = "depleted";
          }
          await facilityPackage.save({ session });

          pointsCharged = 0;
          transaction = new Transaction({
            wallet: wallet._id,
            traveler: travelerId,
            type: "package_access",
            status: "completed",
            points: 0,
            balanceBefore,
            balanceAfter: facilityPackage.hoursRemaining,
            balanceScope: "facility_package",
            description,
            source: "facility_package",
            referenceId: facility._id.toString(),
            idempotencyKey: normalizedKey,
            facilityPackageSubscription: facilityPackage._id
          });
          await transaction.save({ session });
        }
      }

      // Create the successful access record.
      const access = new Access({
        traveler: travelerId,
        facility: facility._id,
        facilityQR: qrRecord._id,
        wallet: wallet._id,
        transaction: transaction._id,
        pointsCharged,
        hoursUsed: hours,
        accessMethod,
        onePassSubscription: onePassSubscriptionId,
        facilityPackageSubscription:
          facilityPackageSubscriptionId,
        idempotencyKey: normalizedKey,
        accessedAt: new Date()
      });

      await access.save({ session });

      result = {
        access,
        transaction,
        pointsCharged,
        duplicate: false
      };
    });

    return result;

  } catch (error) {
    if (error.code === 11000) {
      throw new AccessError(
        "This access request has already been processed.",
        409
      );
    }

    throw error;

  } finally {
    await session.endSession();
  }
};

/**
 * STEP 3: Retrieve a traveler's past facility check-ins.
 */
export const getTravelerAccessHistory = async (
  travelerId,
  { page = 1, limit = 20 } = {}
) => {
  if (!mongoose.isValidObjectId(travelerId)) {
    throw new AccessError("Invalid user ID.", 400);
  }

  const requestedPage = Number(page);
  const requestedLimit = Number(limit);

  const safePage =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;

  const safeLimit =
    Number.isSafeInteger(requestedLimit) && requestedLimit > 0
      ? Math.min(100, requestedLimit)
      : 20;

  const filter = { traveler: travelerId };

  const [visits, total] = await Promise.all([
    Access.find(filter)
      .populate("facility", "name category city address pointsPerVisit")
      .populate(
        "transaction",
        "status type points balanceBefore balanceAfter balanceScope source"
      )
      .sort({ accessedAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),

    Access.countDocuments(filter)
  ]);

  return {
    visits,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.ceil(total / safeLimit)
    }
  };
};

export { AccessError };
