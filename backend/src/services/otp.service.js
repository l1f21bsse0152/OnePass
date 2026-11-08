
import crypto from "crypto";
import bcrypt from "bcryptjs";
import OTP from "../models/otp.model.js";

const OTP_EXPIRY_MINUTES = 10;
const OTP_RESEND_SECONDS = 60;
const MAX_OTP_ATTEMPTS = 5;

// Generate a cryptographically secure six-digit OTP.
export const generateOTP = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

// Store only a hashed version of the OTP.
export const storeOTP = async (
  email,
  otp,
  purpose = "registration"
) => {
  const otpHash = await bcrypt.hash(otp, 10);

  await OTP.deleteMany({ email, purpose });

  await OTP.create({
    email,
    otpHash,
    purpose,
    expiresAt: new Date(
      Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000
    ),
    lastSentAt: new Date(),
    attempts: 0
  });
};

// Verify OTP.
export const verifyOTP = async (
  email,
  submittedOTP,
  purpose = "registration",
  { consume = true } = {}
) => {
  const record = await OTP.findOne({
    email,
    purpose
  }).select("+otpHash");

  if (!record) {
    return {
      success: false,
      message: "OTP not found. Request a new one."
    };
  }

  if (record.expiresAt <= new Date()) {
    await OTP.deleteOne({ _id: record._id });

    return {
      success: false,
      message: "OTP has expired. Request a new one."
    };
  }

  if (record.attempts >= MAX_OTP_ATTEMPTS) {
    return {
      success: false,
      message: "Too many attempts. Request a new OTP."
    };
  }

  const isMatch = await bcrypt.compare(
    submittedOTP,
    record.otpHash
  );

  if (!isMatch) {
    record.attempts += 1;
    await record.save();

    return {
      success: false,
      message: "Incorrect OTP."
    };
  }

  if (consume) {
    await OTP.deleteOne({ _id: record._id });
  }

  return { success: true };
};

// Check the 60-second resend cooldown.
export const canResendOTP = async (
  email,
  purpose = "registration"
) => {
  const record = await OTP.findOne({
    email,
    purpose
  });

  if (!record) return true;

  const elapsed =
    (Date.now() - record.lastSentAt.getTime()) / 1000;

  return elapsed >= OTP_RESEND_SECONDS;
};
