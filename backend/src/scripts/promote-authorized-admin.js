import "dotenv/config";
import mongoose from "mongoose";

import connectDB from "../config/db.js";
import User from "../models/user.model.js";

const main = async () => {
  const authorizedEmail = process.env.ADMIN_SIGNUP_EMAIL?.trim().toLowerCase();
  if (!authorizedEmail) {
    throw new Error("ADMIN_SIGNUP_EMAIL is not configured.");
  }

  await connectDB();

  const user = await User.findOne({ email: authorizedEmail });
  if (!user) {
    throw new Error("No account exists for the configured Admin email.");
  }
  if (user.role === "admin") {
    console.log("The authorized account is already an Admin.");
    return;
  }
  if (user.role !== "traveler") {
    throw new Error("Only the authorized User account can be promoted to Admin.");
  }
  if (!user.isEmailVerified) {
    throw new Error("Verify the account email before promoting it to Admin.");
  }
  if (await User.exists({ role: "admin", _id: { $ne: user._id } })) {
    throw new Error("Another Admin account exists; no account was changed.");
  }

  user.role = "admin";
  await user.save();
  console.log("The verified authorized account is now the Admin account. Its password was not changed.");
};

main()
  .catch((error) => {
    console.error(error.message || "Unable to promote the authorized account.");
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });
