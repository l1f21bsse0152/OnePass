
import mongoose from "mongoose";
import { randomBytes, createHash } from "crypto";

import Facility from "../models/facility.model.js";
import FacilityQR from "../models/facility-qr.model.js";

class FacilityQRError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "FacilityQRError";
    this.statusCode = statusCode;
  }
}

// Hash the raw token before saving it to MongoDB.
const hashQRToken = (token) => {
  return createHash("sha256")
    .update(token)
    .digest("hex");
};

// Generate a permanent QR code for a facility.
export const generateFacilityQR = async ({
  facilityId,
  ownerId
}) => {
  if (!mongoose.isValidObjectId(facilityId)) {
    throw new FacilityQRError("Invalid facility ID.", 400);
  }

  if (!mongoose.isValidObjectId(ownerId)) {
    throw new FacilityQRError("Invalid facility owner ID.", 400);
  }

  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      // Verify that the facility belongs to this owner.
      const facility = await Facility.findOne({
        _id: facilityId,
        owner: ownerId
      }).session(session);

      if (!facility) {
        throw new FacilityQRError(
          "Facility not found or you do not have permission to manage it.",
          404
        );
      }

      if (facility.status !== "active") {
        throw new FacilityQRError(
          "Only active facilities can generate QR codes.",
          403
        );
      }

      // Generate a secure, random, permanent QR token.
      const rawToken = randomBytes(32).toString("base64url");
      const tokenHash = hashQRToken(rawToken);

      // Revoke any previously active QR codes for this facility.
      await FacilityQR.updateMany(
        {
          facility: facility._id,
          status: "active"
        },
        {
          $set: {
            status: "revoked"
          }
        },
        {
          session
        }
      );

      // Create the new permanent QR record.
      const [qrRecord] = await FacilityQR.create(
        [
          {
            facility: facility._id,
            tokenHash,
            expiresAt: null,
            status: "active"
          }
        ],
        {
          session
        }
      );

      // Return the raw token only once.
      // It is never stored in the database.
      result = {
        qr: {
          id: qrRecord._id,
          facility: facility._id,
          facilityName: facility.name,
          status: qrRecord.status,
          expiresAt: null,
          createdAt: qrRecord.createdAt
        },
        token: rawToken
      };
    });

    return result;
  } finally {
    await session.endSession();
  }
};

export { FacilityQRError };
