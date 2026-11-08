
import mongoose from "mongoose";

const walletSchema = new mongoose.Schema(
  {
    traveler: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true
    },

    purchasedPointsBalance: {
      type: Number,
      default: 0,
      min: 0
    },

    bonusPointsBalance: {
      type: Number,
      default: 0,
      min: 0
    },

    status: {
      type: String,
      enum: ["active", "frozen"],
      default: "active"
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

walletSchema.virtual("totalAvailablePoints").get(function () {
  return this.purchasedPointsBalance + this.bonusPointsBalance;
});

const Wallet = mongoose.model("Wallet", walletSchema);

export default Wallet;
