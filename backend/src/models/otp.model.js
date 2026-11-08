
import mongoose from "mongoose";

const otpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true
    },

    otpHash: {
      type: String,
      required: true,
      select: false
    },

    expiresAt: {
      type: Date,
      required: true
    },

    lastSentAt: {
      type: Date,
      default: Date.now
    },

    attempts: {
      type: Number,
      default: 0
    },

    purpose: {
      type: String,
      enum: ["registration", "password-reset"],
      required: true
    }
  },
  {
    timestamps: true
  }
);

// Automatically remove expired OTP records.
otpSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);

const OTP = mongoose.model("OTP", otpSchema);

export default OTP;
