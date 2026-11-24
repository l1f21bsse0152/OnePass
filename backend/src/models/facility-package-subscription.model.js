import mongoose from "mongoose";

const facilityPackageSubscriptionSchema = new mongoose.Schema(
  {
    traveler: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    facility: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Facility",
      required: true,
      index: true
    },

    packageType: {
      type: String,
      enum: ["weekly", "monthly"],
      required: true
    },

    status: {
      type: String,
      enum: ["active", "expired", "depleted", "revoked"],
      default: "active",
      index: true
    },

    hoursIncluded: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isSafeInteger
    },

    hoursRemaining: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isSafeInteger
    },

    pointsCost: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isSafeInteger
    },

    startsAt: {
      type: Date,
      required: true
    },

    expiresAt: {
      type: Date,
      required: true
    },

    purchaseTransaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
      required: true,
      unique: true
    }
  },
  { timestamps: true }
);

facilityPackageSubscriptionSchema.index({
  traveler: 1,
  facility: 1,
  status: 1,
  expiresAt: 1
});

const FacilityPackageSubscription = mongoose.model(
  "FacilityPackageSubscription",
  facilityPackageSubscriptionSchema
);

export default FacilityPackageSubscription;
