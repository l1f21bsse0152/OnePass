
import mongoose from "mongoose";

const walletLotSchema = new mongoose.Schema(
  {
    wallet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wallet",
      required: true,
      index: true
    },

    type: {
      type: String,
      enum: ["purchased", "bonus"],
      required: true
    },

    source: {
      type: String,
      enum: [
        "package_purchase",
        "custom_purchase",
        "promotion",
        "admin_credit",
        "refund",
        "other"
      ],
      default: "other"
    },

    originalPoints: {
      type: Number,
      required: true,
      min: 1
    },

    remainingPoints: {
      type: Number,
      required: true,
      min: 0
    },

    expiresAt: {
      type: Date,
      default: null
    },

    status: {
      type: String,
      enum: ["active", "expired", "depleted"],
      default: "active"
    },

    referenceId: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true
  }
);

walletLotSchema.index({
  wallet: 1,
  status: 1,
  expiresAt: 1,
  createdAt: 1
});

const WalletLot = mongoose.model("WalletLot", walletLotSchema);

export default WalletLot;
