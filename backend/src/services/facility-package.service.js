import mongoose from "mongoose";

import Facility from "../models/facility.model.js";
import FacilityPackageSubscription from "../models/facility-package-subscription.model.js";
import { debitPointsInSession } from "./wallet.service.js";
import { getFacilityPackageConfig } from "./facility-package-config.js";

class FacilityPackageError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "FacilityPackageError";
    this.statusCode = statusCode;
  }
}

export const purchaseFacilityPackage = async ({
  travelerId,
  facilityId,
  packageType,
  idempotencyKey
}) => {
  if (!mongoose.isValidObjectId(travelerId)) {
    throw new FacilityPackageError("Invalid user ID.", 400);
  }

  if (!mongoose.isValidObjectId(facilityId)) {
    throw new FacilityPackageError("Invalid facility ID.", 400);
  }

  if (!["weekly", "monthly"].includes(packageType)) {
    throw new FacilityPackageError(
      "Package type must be weekly or monthly.",
      400
    );
  }

  if (
    typeof idempotencyKey !== "string" ||
    !idempotencyKey.trim() ||
    idempotencyKey.trim().length > 128
  ) {
    throw new FacilityPackageError(
      "A valid Idempotency-Key header is required.",
      400
    );
  }

  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      const facility = await Facility.findOne({
        _id: facilityId,
        status: "active",
        accessEnabled: true,
        isTestData: { $ne: true }
      }).session(session);

      if (!facility) {
        throw new FacilityPackageError("Facility not found.", 404);
      }

      const packageDetails = getFacilityPackageConfig(facility, packageType);

      if (
        !packageDetails ||
        !Number.isSafeInteger(packageDetails.pointsCost) ||
        packageDetails.pointsCost <= 0 ||
        !Number.isSafeInteger(packageDetails.hoursIncluded) ||
        packageDetails.hoursIncluded <= 0 ||
        !Number.isSafeInteger(packageDetails.durationDays) ||
        packageDetails.durationDays <= 0
      ) {
        throw new FacilityPackageError(
          "Facility package configuration is invalid.",
          500
        );
      }

      const description =
        `${packageType} facility package: ${facility.name}`;
      const referenceId = `${facility._id}:${packageType}`;

      const debit = await debitPointsInSession({
        session,
        travelerId,
        points: packageDetails.pointsCost,
        description,
        source: "package_purchase",
        referenceId,
        idempotencyKey
      });

      if (debit.duplicate) {
        const existingSubscription =
          await FacilityPackageSubscription.findOne({
            purchaseTransaction: debit.transaction._id
          }).session(session);

        if (!existingSubscription) {
          throw new FacilityPackageError(
            "The original package purchase could not be found.",
            500
          );
        }

        result = {
          subscription: existingSubscription,
          transaction: debit.transaction,
          duplicate: true
        };
        return;
      }

      const startsAt = new Date();
      const expiresAt = new Date(
        startsAt.getTime() +
          packageDetails.durationDays * 24 * 60 * 60 * 1000
      );

      const [subscription] =
        await FacilityPackageSubscription.create(
          [
            {
              traveler: travelerId,
              facility: facility._id,
              packageType,
              status: "active",
              hoursIncluded: packageDetails.hoursIncluded,
              hoursRemaining: packageDetails.hoursIncluded,
              pointsCost: packageDetails.pointsCost,
              startsAt,
              expiresAt,
              purchaseTransaction: debit.transaction._id
            }
          ],
          { session }
        );

      result = {
        subscription,
        transaction: debit.transaction,
        duplicate: false
      };
    });

    return result;
  } catch (error) {
    if (error.code === 11000) {
      throw new FacilityPackageError(
        "This facility package purchase has already been processed.",
        409
      );
    }

    throw error;
  } finally {
    await session.endSession();
  }
};

export { FacilityPackageError };
