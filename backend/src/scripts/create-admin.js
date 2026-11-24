import "dotenv/config";
import { createInterface } from "node:readline";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import connectDB from "../config/db.js";
import User from "../models/user.model.js";
import { validateRegistration } from "../validators/auth.validator.js";

const readSecret = (prompt) =>
  new Promise((resolve, reject) => {
    const input = process.stdin;
    if (!input.isTTY || typeof input.setRawMode !== "function") {
      reject(new Error("Run this command in an interactive terminal."));
      return;
    }

    process.stdout.write(prompt);
    input.setRawMode(true);
    input.resume();
    input.setEncoding("utf8");

    let value = "";
    const finish = (error) => {
      input.removeListener("data", onData);
      input.setRawMode(false);
      input.pause();
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (chunk) => {
      for (const character of chunk) {
        if (character === "\u0003") {
          finish(new Error("Admin setup cancelled."));
          return;
        }
        if (character === "\r" || character === "\n") {
          finish();
          return;
        }
        if (character === "\u0008" || character === "\u007f") {
          if (value.length) {
            value = value.slice(0, -1);
            process.stdout.write("\b \b");
          }
          continue;
        }
        if (character >= " ") {
          value += character;
          process.stdout.write("*");
        }
      }
    };

    input.on("data", onData);
  });

const promptForAdmin = async () => {
  const prompt = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    return {
      fullName: (await prompt.question("Admin full name: ")).trim(),
      email: (await prompt.question("Admin email: ")).trim().toLowerCase()
    };
  } finally {
    prompt.close();
  }
};

const main = async () => {
  const { fullName, email } = await promptForAdmin();
  const authorizedEmail = process.env.ADMIN_SIGNUP_EMAIL?.trim().toLowerCase();
  if (!authorizedEmail || email !== authorizedEmail) {
    throw new Error("The email must match the configured Admin signup email.");
  }

  const password = await readSecret("Choose password: ");
  const confirmPassword = await readSecret("Confirm password: ");

  if (password !== confirmPassword) {
    throw new Error("Passwords do not match.");
  }

  const validation = validateRegistration({ fullName, email, password });
  if (!validation.isValid) {
    throw new Error(validation.errors.join(" "));
  }

  await connectDB();

  if (await User.exists({ role: "admin" })) {
    throw new Error("An admin account already exists. Use the password reset flow or contact your database administrator.");
  }

  if (await User.exists({ email })) {
    throw new Error("An account already uses this email. Choose an unused email address.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await User.create({
    fullName,
    email,
    password: passwordHash,
    role: "admin",
    isEmailVerified: true
  });

  console.log("Admin account created. Sign in to the OnePass Control Center with the email you entered.");
};

main()
  .catch((error) => {
    console.error(error.message || "Unable to create the admin account.");
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });
