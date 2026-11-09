
import mongoose from "mongoose";

const accessSchema = new mongoose.Schema(
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

    facilityQR: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FacilityQR",
      required: true
    },

    wallet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wallet",
      required: true
    },

    transaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
      required: true,
      unique: true
    },

    pointsCharged: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isSafeInteger,
        message: "Points charged must be a positive whole number."
      }
    },

    // Prevent duplicate processing of the same access request.
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    accessedAt: {
      type: Date,
      default: Date.now,
      required: true
    }
  },
  {
    timestamps: true
  }
);

// Traveler's access history.
accessSchema.index({
  traveler: 1,
  accessedAt: -1
});

// Facility's entry history.
accessSchema.index({
  facility: 1,
  accessedAt: -1
});

const Access = mongoose.model("Access", accessSchema);

export default Access;
