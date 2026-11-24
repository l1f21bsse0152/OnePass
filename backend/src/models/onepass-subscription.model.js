import mongoose from "mongoose";

const onePassSubscriptionSchema = new mongoose.Schema(
  {
    traveler: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PassPlan",
      required: true
    },

    status: {
      type: String,
      enum: ["active", "expired", "revoked"],
      default: "active",
      index: true
    },

    startsAt: {
      type: Date,
      required: true
    },

    expiresAt: {
      type: Date,
      required: true
    },

    pointsRemaining: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isSafeInteger
    }
  },
  { timestamps: true }
);

onePassSubscriptionSchema.index({
  traveler: 1,
  status: 1,
  expiresAt: 1
});

const OnePassSubscription = mongoose.model(
  "OnePassSubscription",
  onePassSubscriptionSchema
);

export default OnePassSubscription;
