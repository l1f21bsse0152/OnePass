
import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    wallet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wallet",
      required: true,
      index: true
    },

    traveler: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    type: {
      type: String,
      enum: [
        "purchase",
        "bonus",
        "debit",
        "refund",
        "admin_credit",
        "adjustment"
      ],
      required: true
    },

    status: {
      type: String,
      enum: [
        "pending",
        "completed",
        "failed",
        "reversed"
      ],
      default: "pending"
    },

    points: {
      type: Number,
      required: true,
      min: 1
    },

    balanceBefore: {
      type: Number,
      required: true,
      min: 0
    },

    balanceAfter: {
      type: Number,
      required: true,
      min: 0
    },

    description: {
      type: String,
      trim: true,
      maxlength: 250,
      default: ""
    },

    source: {
      type: String,
      enum: [
        "package_purchase",
        "custom_purchase",
        "promotion",
        "facility_access",
        "refund",
        "admin",
        "admin_credit",
        "system",
        "other"
      ],
      default: "system"
    },

    referenceId: {
      type: String,
      default: null
    },

    idempotencyKey: {
      type: String,
      default: null
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

// Retrieve wallet history efficiently.
transactionSchema.index({
  wallet: 1,
  createdAt: -1
});

// Prevent duplicate operations using the same idempotency key.
transactionSchema.index(
  { idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      idempotencyKey: { $type: "string" }
    }
  }
);

const Transaction = mongoose.model(
  "Transaction",
  transactionSchema
);

export default Transaction;
