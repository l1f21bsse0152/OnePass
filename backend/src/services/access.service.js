
import mongoose from "mongoose";
import { createHash } from "crypto";

import Facility from "../models/facility.model.js";
import FacilityQR from "../models/facility-qr.model.js";
import Access from "../models/access.model.js";
import Transaction from "../models/transaction.model.js";

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
    throw new AccessError("Invalid traveler ID.", 400);
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

const findActiveFacility = async (facilityId, session = null) => {
  let query = Facility.findById(facilityId);

  if (session) {
    query = query.session(session);
  }

  const facility = await query;

  if (!facility) {
    throw new AccessError("Facility not found.", 404);
  }

  if (facility.status !== "active") {
    throw new AccessError(
      "This facility is currently unavailable.",
      403
    );
  }

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

  // Retrieves the wallet balance without performing
  // a facility access deduction.
  const wallet = await getWalletBalance(travelerId);

  const pointsRequired = facility.pointsPerVisit;

  return {
    facility: {
      id: facility._id,
      name: facility.name,
      category: facility.category,
      address: facility.address,
      city: facility.city,
      pointsPerVisit: pointsRequired
    },

    wallet: {
      walletId: wallet.walletId,
      purchasedPoints: wallet.purchasedPoints,
      bonusPoints: wallet.bonusPoints,
      totalAvailablePoints: wallet.totalAvailablePoints,
      status: wallet.status
    },

    canAccess:
      wallet.totalAvailablePoints >= pointsRequired
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
  idempotencyKey
}) => {
  const normalizedToken = validateScanInput({
    travelerId,
    token
  });

  const normalizedKey =
    normalizeIdempotencyKey(idempotencyKey);

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

        if (!sameTraveler || !sameQR) {
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

      // Deduct points using the existing MongoDB session.
      const debitResult = await debitPointsInSession({
        session,
        travelerId,
        points: facility.pointsPerVisit,
        description: `Facility access: ${facility.name}`,
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

      // Create the successful access record.
      const access = new Access({
        traveler: travelerId,
        facility: facility._id,
        facilityQR: qrRecord._id,
        wallet: debitResult.wallet._id,
        transaction: debitResult.transaction._id,
        pointsCharged: facility.pointsPerVisit,
        idempotencyKey: normalizedKey,
        accessedAt: new Date()
      });

      await access.save({ session });

      result = {
        access,
        transaction: debitResult.transaction,
        balanceAfter: debitResult.balanceAfter,
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

export { AccessError };
