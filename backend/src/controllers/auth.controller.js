
import { randomBytes } from "node:crypto";
import path from "node:path";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";

import User from "../models/user.model.js";
import OTP from "../models/otp.model.js";
import PendingRegistration from "../models/pending-registration.model.js";

import {
  validateRegistration,
  validateEmail,
  validatePassword
} from "../validators/auth.validator.js";

import {
  generateOTP,
  storeOTP,
  canResendOTP,
  verifyOTP
} from "../services/otp.service.js";

import {
  sendRegistrationOTP,
  sendPasswordChangeOTP,
  sendPasswordResetOTP,
  sendAdminEmailChangeOTP
} from "../services/email.service.js";
import {
  PROFILE_PHOTO_DIRECTORY,
  removeProfilePhotoFile
} from "../services/profile-photo.service.js";

const getLoginDeviceType = (req) => {
  const declaredType = req.get("x-onepass-device-type")?.toLowerCase();
  if (declaredType === "mobile") return "mobile";
  if (["desktop", "pc/laptop"].includes(declaredType)) return "pc/laptop";

  const userAgent = req.get("user-agent") || "";
  if (!userAgent) return "unknown";
  if (/(ipad|tablet|kindle|silk|iphone|ipod|android|mobile|windows phone)/i.test(userAgent)) {
    return "mobile";
  }
  return "pc/laptop";
};

const serializeUser = (user) => ({
  id: user._id,
  fullName: user.fullName,
  email: user.email,
  isEmailVerified: user.isEmailVerified,
  role: user.role,
  phoneNumber: user.phoneNumber ?? null,
  city: user.city ?? null,
  country: user.country ?? null,
  dateOfBirth: user.dateOfBirth
    ? new Date(user.dateOfBirth).toISOString().slice(0, 10)
    : null,
  bloodGroup: user.bloodGroup ?? null,
  emergencyContact: user.emergencyContact?.name
    ? {
        name: user.emergencyContact.name,
        phoneNumber: user.emergencyContact.phoneNumber ?? "",
        relationship: user.emergencyContact.relationship ?? ""
      }
    : null,
  profilePhotoUrl: user.profilePhotoFilename
    ? "/api/auth/me/photo"
    : null,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
});

const createSession = (user) => {
  const expiresIn = process.env.JWT_EXPIRES_IN || "1h";
  const token = jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role
    },
    process.env.JWT_SECRET,
    {
      algorithm: "HS256",
      expiresIn
    }
  );

  return {
    token,
    tokenType: "Bearer",
    expiresIn,
    user: serializeUser(user)
  };
};

// ==========================================
// 1. REGISTER USER
// ==========================================

export const register = async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    const validation = validateRegistration({
      fullName,
      email,
      password
    });

    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: validation.errors
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists."
      });
    }

    const canResend = await canResendOTP(
      normalizedEmail,
      "registration"
    );

    if (!canResend) {
      return res.status(429).json({
        success: false,
        message: "Please wait before requesting another OTP."
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await PendingRegistration.findOneAndUpdate(
      { email: normalizedEmail },
      {
        fullName: fullName.trim(),
        email: normalizedEmail,
        passwordHash,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000)
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    );

    const otp = generateOTP();

    await storeOTP(
      normalizedEmail,
      otp,
      "registration"
    );

    try {
      await sendRegistrationOTP(normalizedEmail, otp);
    } catch (emailError) {
      await OTP.deleteMany({
        email: normalizedEmail,
        purpose: "registration"
      });

      await PendingRegistration.deleteOne({
        email: normalizedEmail
      });

      throw emailError;
    }

    return res.status(200).json({
      success: true,
      message: "Registration OTP sent successfully.",
      data: {
        email: normalizedEmail,
        expiresIn: "10 minutes"
      }
    });

  } catch (error) {
    console.error("Registration error details:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to complete registration."
    });
  }
};

export const registerDashboardAccount = async (req, res) => {
  try {
    const { fullName, email, password, role } = req.body ?? {};

    if (!["admin", "facility"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Choose an Admin or Facility account."
      });
    }

    const validation = validateRegistration({ fullName, email, password });
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: validation.errors
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (role === "admin") {
      const authorizedEmail = process.env.ADMIN_SIGNUP_EMAIL?.trim().toLowerCase();
      if (!authorizedEmail) {
        return res.status(503).json({
          success: false,
          message: "Admin account creation is not configured."
        });
      }
      if (normalizedEmail !== authorizedEmail) {
        return res.status(403).json({
          success: false,
          message: "This email is not authorized to create an Admin account."
        });
      }
      if (await User.exists({ role: "admin" })) {
        return res.status(409).json({
          success: false,
          message: "The Admin account has already been created. Please sign in."
        });
      }
    }

    if (await User.exists({ email: normalizedEmail })) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists."
      });
    }

    if (!(await canResendOTP(normalizedEmail, "registration"))) {
      return res.status(429).json({
        success: false,
        message: "Please wait before requesting another OTP."
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await PendingRegistration.findOneAndUpdate(
      { email: normalizedEmail },
      {
        fullName: fullName.trim(),
        email: normalizedEmail,
        passwordHash,
        role,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000)
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    );

    const otp = generateOTP();
    await storeOTP(normalizedEmail, otp, "registration");
    try {
      await sendRegistrationOTP(normalizedEmail, otp);
    } catch (emailError) {
      await OTP.deleteMany({
        email: normalizedEmail,
        purpose: "registration"
      });
      await PendingRegistration.deleteOne({ email: normalizedEmail });
      throw emailError;
    }

    return res.status(200).json({
      success: true,
      message: "Verification code sent.",
      data: {
        email: normalizedEmail,
        role,
        expiresIn: "10 minutes"
      }
    });
  } catch (error) {
    console.error("Dashboard registration error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to start account registration."
    });
  }
};

export const verifyDashboardRegistrationOTP = async (req, res) => {
  try {
    const { email, otp } = req.body ?? {};
    if (!validateEmail(email) || !/^\d{6}$/.test(String(otp || ""))) {
      return res.status(400).json({
        success: false,
        message: "A valid email and 6-digit verification code are required."
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const pending = await PendingRegistration.findOne({
      email: normalizedEmail
    }).select("+passwordHash");

    if (!pending || !["admin", "facility"].includes(pending.role)) {
      return res.status(404).json({
        success: false,
        message: "Dashboard registration was not found. Please register again."
      });
    }

    if (pending.expiresAt <= new Date()) {
      await PendingRegistration.deleteOne({ email: normalizedEmail });
      await OTP.deleteMany({
        email: normalizedEmail,
        purpose: "registration"
      });
      return res.status(400).json({
        success: false,
        message: "Registration expired. Please register again."
      });
    }

    if (pending.role === "admin") {
      const authorizedEmail = process.env.ADMIN_SIGNUP_EMAIL?.trim().toLowerCase();
      if (!authorizedEmail || normalizedEmail !== authorizedEmail) {
        return res.status(403).json({
          success: false,
          message: "This email is not authorized to create an Admin account."
        });
      }
      if (await User.exists({ role: "admin" })) {
        return res.status(409).json({
          success: false,
          message: "The Admin account has already been created. Please sign in."
        });
      }
    }

    if (await User.exists({ email: normalizedEmail })) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists."
      });
    }

    const verification = await verifyOTP(
      normalizedEmail,
      otp,
      "registration",
      { consume: false }
    );
    if (!verification.success) {
      return res.status(400).json({
        success: false,
        message: verification.message
      });
    }

    const user = await User.create({
      fullName: pending.fullName,
      email: normalizedEmail,
      password: pending.passwordHash,
      isEmailVerified: true,
      role: pending.role
    });
    await PendingRegistration.deleteOne({ email: normalizedEmail });
    await OTP.deleteMany({
      email: normalizedEmail,
      purpose: "registration"
    });

    return res.status(201).json({
      success: true,
      message: "Account created successfully. You can now sign in.",
      data: {
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          role: user.role
        }
      }
    });
  } catch (error) {
    console.error("Dashboard registration verification error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to verify dashboard registration."
    });
  }
};


// ==========================================
// 2. VERIFY REGISTRATION OTP
// ==========================================

export const verifyRegistrationOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address."
      });
    }

    if (!/^\d{6}$/.test(String(otp || ""))) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid 6-digit OTP."
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const pending = await PendingRegistration.findOne({
      email: normalizedEmail
    }).select("+passwordHash");

    if (!pending) {
      return res.status(404).json({
        success: false,
        message: "Registration session not found. Please register again."
      });
    }

    if (pending.role && pending.role !== "traveler") {
      return res.status(400).json({
        success: false,
        message: "Use the dashboard verification page to finish this registration."
      });
    }

    if (pending.expiresAt <= new Date()) {
      await PendingRegistration.deleteOne({
        email: normalizedEmail
      });

      await OTP.deleteMany({
        email: normalizedEmail,
        purpose: "registration"
      });

      return res.status(400).json({
        success: false,
        message: "Registration session expired. Please register again."
      });
    }

    const existingUser = await User.findOne({
      email: normalizedEmail
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists."
      });
    }

    const verification = await verifyOTP(
      normalizedEmail,
      otp,
      "registration",
      { consume: false }
    );

    if (!verification.success) {
      return res.status(400).json({
        success: false,
        message: verification.message
      });
    }

    const user = await User.create({
      fullName: pending.fullName,
      email: normalizedEmail,
      password: pending.passwordHash,
      isEmailVerified: true,
      role: "traveler"
    });

    await PendingRegistration.deleteOne({
      email: normalizedEmail
    });

    await OTP.deleteMany({
      email: normalizedEmail,
      purpose: "registration"
    });

    return res.status(201).json({
      success: true,
      message: "Email verified and account created successfully.",
      data: {
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          isEmailVerified: user.isEmailVerified,
          role: user.role
        }
      }
    });

  } catch (error) {
    console.error("OTP verification error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to verify registration."
    });
  }
};


// ==========================================
// 3. RESEND REGISTRATION OTP
// ==========================================

export const resendRegistrationOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address."
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const pending = await PendingRegistration.findOne({
      email: normalizedEmail
    });

    if (!pending) {
      return res.status(404).json({
        success: false,
        message: "Registration session not found. Please register again."
      });
    }

    if (pending.expiresAt <= new Date()) {
      await PendingRegistration.deleteOne({
        email: normalizedEmail
      });

      await OTP.deleteMany({
        email: normalizedEmail,
        purpose: "registration"
      });

      return res.status(400).json({
        success: false,
        message: "Registration session expired. Please register again."
      });
    }

    const existingUser = await User.findOne({
      email: normalizedEmail
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists."
      });
    }

    const canResend = await canResendOTP(
      normalizedEmail,
      "registration"
    );

    if (!canResend) {
      return res.status(429).json({
        success: false,
        message: "Please wait before requesting another OTP."
      });
    }

    const otp = generateOTP();

    await storeOTP(
      normalizedEmail,
      otp,
      "registration"
    );

    try {
      await sendRegistrationOTP(normalizedEmail, otp);
    } catch (emailError) {
      await OTP.deleteMany({
        email: normalizedEmail,
        purpose: "registration"
      });

      throw emailError;
    }

    return res.status(200).json({
      success: true,
      message: "A new registration OTP has been sent successfully.",
      data: {
        email: normalizedEmail,
        expiresIn: "10 minutes",
        resendAvailableIn: 60
      }
    });

  } catch (error) {
    console.error("Resend registration OTP error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to resend registration OTP."
    });
  }
};


// ==========================================
// 4. LOGIN USER
// ==========================================

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!validateEmail(email) || !password) {
      return res.status(400).json({
        success: false,
        message: "Valid email and password are required."
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        success: false,
        message: "Authentication configuration error."
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({
      email: normalizedEmail
    }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password."
      });
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email before logging in."
      });
    }

    if (user.lockUntil && user.lockUntil > new Date()) {
      return res.status(423).json({
        success: false,
        message: "Account temporarily locked. Please try again later."
      });
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      user.password
    );

    if (!isPasswordValid) {
      user.failedLoginAttempts += 1;

      if (user.failedLoginAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
        user.failedLoginAttempts = 0;
      }

      await user.save();

      return res.status(401).json({
        success: false,
        message: "Invalid email or password."
      });
    }

    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    user.lastLoginDeviceType = getLoginDeviceType(req);

    await user.save();

    const token = jwt.sign(
      {
        sub: user._id.toString(),
        role: user.role
      },
      process.env.JWT_SECRET,
      {
        algorithm: "HS256",
        expiresIn: process.env.JWT_EXPIRES_IN || "1h"
      }
    );

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      data: {
        token,
        tokenType: "Bearer",
        expiresIn: process.env.JWT_EXPIRES_IN || "1h",
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          isEmailVerified: user.isEmailVerified,
          role: user.role
        }
      }
    });

  } catch (error) {
    console.error("Login error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to complete login."
    });
  }
};

export const googleSignIn = async (req, res) => {
  const { idToken } = req.body ?? {};

  if (typeof idToken !== "string" || !idToken.trim()) {
    return res.status(400).json({
      success: false,
      message: "A Google ID token is required."
    });
  }

  const clientId = process.env.GOOGLE_WEB_CLIENT_ID;

  if (!clientId) {
    return res.status(503).json({
      success: false,
      message: "Google sign-in is not configured on the server."
    });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({
      success: false,
      message: "Authentication configuration error."
    });
  }

  let googleUser;

  try {
    const ticket = await new OAuth2Client(clientId).verifyIdToken({
      idToken,
      audience: clientId
    });
    const payload = ticket.getPayload();

    if (
      !payload?.sub ||
      !payload.email ||
      payload.email_verified !== true
    ) {
      return res.status(401).json({
        success: false,
        message: "Google could not verify this account."
      });
    }

    googleUser = {
      sub: payload.sub,
      email: payload.email.trim().toLowerCase(),
      fullName:
        typeof payload.name === "string" &&
        payload.name.trim().length >= 2 &&
        payload.name.trim().length <= 80
          ? payload.name.trim()
          : "OnePass User"
    };
  } catch {
    return res.status(401).json({
      success: false,
      message: "The Google ID token is invalid or expired."
    });
  }

  try {
    let user = await User.findOne({ googleSub: googleUser.sub });

    if (user) {
      user.lastLoginDeviceType = getLoginDeviceType(req);
      await user.save();
      return res.status(200).json({
        success: true,
        message: "Google sign-in successful.",
        data: createSession(user)
      });
    }

    user = await User.findOne({ email: googleUser.email });

    if (user) {
      if (user.googleSub && user.googleSub !== googleUser.sub) {
        return res.status(409).json({
          success: false,
          message: "This email is linked to a different Google account."
        });
      }

      user.googleSub = googleUser.sub;
      user.isEmailVerified = true;
      user.lastLoginDeviceType = getLoginDeviceType(req);
      await user.save();

      return res.status(200).json({
        success: true,
        message: "Google sign-in successful.",
        data: createSession(user)
      });
    }

    let pending = await PendingRegistration.findOne({
      email: googleUser.email
    });

    if (pending && pending.expiresAt <= new Date()) {
      await PendingRegistration.deleteOne({ _id: pending._id });
      await OTP.deleteMany({
        email: googleUser.email,
        purpose: "registration"
      });
      pending = null;
    }

    if (pending && !pending.googleSub) {
      return res.status(409).json({
        success: false,
        message: "Email registration is already in progress."
      });
    }

    if (
      pending &&
      pending.googleSub !== googleUser.sub
    ) {
      return res.status(409).json({
        success: false,
        message: "This email is linked to a different Google account."
      });
    }

    if (!(await canResendOTP(googleUser.email, "registration"))) {
      return res.status(429).json({
        success: false,
        message: "Please wait before requesting another OTP."
      });
    }

    const passwordHash = await bcrypt.hash(
      randomBytes(32).toString("hex"),
      12
    );

    if (pending) {
      pending.fullName = googleUser.fullName;
      pending.passwordHash = passwordHash;
      pending.expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await pending.save();
    } else {
      pending = await PendingRegistration.create({
        fullName: googleUser.fullName,
        email: googleUser.email,
        passwordHash,
        googleSub: googleUser.sub,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000)
      });
    }

    const otp = generateOTP();
    await storeOTP(googleUser.email, otp, "registration");

    try {
      await sendRegistrationOTP(googleUser.email, otp);
    } catch (emailError) {
      await OTP.deleteMany({
        email: googleUser.email,
        purpose: "registration"
      });
      await PendingRegistration.deleteOne({ _id: pending._id });
      throw emailError;
    }

    return res.status(200).json({
      success: true,
      message: "Google registration OTP sent successfully.",
      data: {
        requiresOtp: true,
        email: googleUser.email,
        expiresIn: "10 minutes"
      }
    });
  } catch (error) {
    console.error("Google sign-in error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to complete Google sign-in."
    });
  }
};

export const verifyGoogleRegistrationOTP = async (req, res) => {
  try {
    const { email, otp } = req.body ?? {};

    if (!validateEmail(email) || !/^\d{6}$/.test(String(otp || ""))) {
      return res.status(400).json({
        success: false,
        message: "A valid email and 6-digit OTP are required."
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        success: false,
        message: "Authentication configuration error."
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const pending = await PendingRegistration.findOne({
      email: normalizedEmail,
      googleSub: { $exists: true, $ne: null }
    }).select("+passwordHash");

    if (!pending) {
      return res.status(404).json({
        success: false,
        message: "Google registration session not found. Please sign in again."
      });
    }

    if (pending.expiresAt <= new Date()) {
      await PendingRegistration.deleteOne({ _id: pending._id });
      await OTP.deleteMany({
        email: normalizedEmail,
        purpose: "registration"
      });

      return res.status(400).json({
        success: false,
        message: "Registration session expired. Please sign in again."
      });
    }

    const existingUser = await User.findOne({
      $or: [
        { email: normalizedEmail },
        { googleSub: pending.googleSub }
      ]
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "This Google account is already registered. Please sign in."
      });
    }

    const verification = await verifyOTP(
      normalizedEmail,
      otp,
      "registration"
    );

    if (!verification.success) {
      return res.status(400).json({
        success: false,
        message: verification.message
      });
    }

    const user = await User.create({
      fullName: pending.fullName,
      email: normalizedEmail,
      password: pending.passwordHash,
      googleSub: pending.googleSub,
      isEmailVerified: true,
      role: "traveler",
      lastLoginDeviceType: getLoginDeviceType(req)
    });

    await PendingRegistration.deleteOne({ _id: pending._id });

    return res.status(201).json({
      success: true,
      message: "Google account created successfully.",
      data: createSession(user)
    });
  } catch (error) {
    console.error("Google registration verification error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to verify Google registration."
    });
  }
};


// ==========================================
// 5. GET LOGGED-IN USER PROFILE
// ==========================================

export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    return res.status(200).json({
      success: true,
      message: "Profile retrieved successfully.",
      data: {
        user: serializeUser(user)
      }
    });

  } catch (error) {
    console.error("Get profile error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve profile."
    });
  }
};


// ==========================================
// 6. UPDATE USER PROFILE
// ==========================================

export const updateMe = async (req, res) => {
  try {
    const { fullName } = req.body ?? {};

    if (!fullName || typeof fullName !== "string") {
      return res.status(400).json({
        success: false,
        message: "Full name is required."
      });
    }

    const trimmedName = fullName.trim();

    if (trimmedName.length < 2 || trimmedName.length > 80) {
      return res.status(400).json({
        success: false,
        message: "Full name must be between 2 and 80 characters."
      });
    }

    const updates = { fullName: trimmedName };
    const hasField = (field) =>
      Object.prototype.hasOwnProperty.call(req.body, field);

    if (hasField("phoneNumber")) {
      const phoneNumber = req.body.phoneNumber;

      if (phoneNumber !== null && typeof phoneNumber !== "string") {
        return res.status(400).json({
          success: false,
          message: "Phone number must be text or null."
        });
      }

      const normalizedPhone = phoneNumber?.trim() || null;

      if (
        normalizedPhone &&
        (
          !/^\+?[0-9()\-\s]{7,25}$/.test(normalizedPhone) ||
          normalizedPhone.replace(/\D/g, "").length < 7 ||
          normalizedPhone.replace(/\D/g, "").length > 15
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Enter a valid phone number."
        });
      }

      updates.phoneNumber = normalizedPhone;
    }

    for (const field of ["city", "country"]) {
      if (!hasField(field)) continue;

      const value = req.body[field];

      if (value !== null && typeof value !== "string") {
        return res.status(400).json({
          success: false,
          message: `${field} must be text or null.`
        });
      }

      const normalizedValue = value?.trim() || null;

      if (normalizedValue && normalizedValue.length > 80) {
        return res.status(400).json({
          success: false,
          message: `${field} must be 80 characters or fewer.`
        });
      }

      updates[field] = normalizedValue;
    }

    if (hasField("dateOfBirth")) {
      const dateOfBirth = req.body.dateOfBirth;

      if (dateOfBirth === null || dateOfBirth === "") {
        updates.dateOfBirth = null;
      } else if (typeof dateOfBirth !== "string") {
        return res.status(400).json({
          success: false,
          message: "Date of birth must be an ISO date or null."
        });
      } else {
        const parsedDate = new Date(`${dateOfBirth}T00:00:00.000Z`);
        const today = new Date(
          `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`
        );

        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) ||
          Number.isNaN(parsedDate.getTime()) ||
          parsedDate.toISOString().slice(0, 10) !== dateOfBirth ||
          parsedDate > today
        ) {
          return res.status(400).json({
            success: false,
            message: "Enter a valid date of birth in YYYY-MM-DD format."
          });
        }

        updates.dateOfBirth = parsedDate;
      }
    }

    if (hasField("bloodGroup")) {
      const bloodGroup = req.body.bloodGroup;
      const normalizedBloodGroup =
        typeof bloodGroup === "string" ? bloodGroup.trim().toUpperCase() : "";
      const supportedBloodGroups = [
        "A+",
        "A-",
        "B+",
        "B-",
        "AB+",
        "AB-",
        "O+",
        "O-"
      ];

      if (
        bloodGroup !== null &&
        (typeof bloodGroup !== "string" ||
          !supportedBloodGroups.includes(normalizedBloodGroup))
      ) {
        return res.status(400).json({
          success: false,
          message: "Choose a supported blood group or leave it blank."
        });
      }

      updates.bloodGroup = bloodGroup === null ? null : normalizedBloodGroup;
    }

    if (hasField("emergencyContact")) {
      const emergencyContact = req.body.emergencyContact;

      if (emergencyContact === null) {
        updates.emergencyContact = null;
      } else if (
        !emergencyContact ||
        typeof emergencyContact !== "object" ||
        Array.isArray(emergencyContact)
      ) {
        return res.status(400).json({
          success: false,
          message: "Emergency contact must be an object or null."
        });
      } else {
        const name =
          typeof emergencyContact.name === "string"
            ? emergencyContact.name.trim()
            : "";
        const phoneNumber =
          typeof emergencyContact.phoneNumber === "string"
            ? emergencyContact.phoneNumber.trim()
            : "";
        const relationship =
          typeof emergencyContact.relationship === "string"
            ? emergencyContact.relationship.trim()
            : "";

        if (!name || !phoneNumber) {
          return res.status(400).json({
            success: false,
            message: "Emergency contact name and phone number are required."
          });
        }

        if (
          name.length > 80 ||
          relationship.length > 40 ||
          !/^\+?[0-9()\-\s]{7,25}$/.test(phoneNumber) ||
          phoneNumber.replace(/\D/g, "").length < 7 ||
          phoneNumber.replace(/\D/g, "").length > 15
        ) {
          return res.status(400).json({
            success: false,
            message: "Emergency contact details are invalid."
          });
        }

        updates.emergencyContact = {
          name,
          phoneNumber,
          relationship
        };
      }
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    user.set(updates);
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      data: {
        user: serializeUser(user)
      }
    });

  } catch (error) {
    console.error("Update profile error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to update profile."
    });
  }
};

export const requestAdminEmailChangeOTP = async (req, res) => {
  try {
    const { newEmail, currentPassword } = req.body ?? {};
    if (!validateEmail(newEmail) || typeof currentPassword !== "string" || !currentPassword) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid new email and your current password."
      });
    }

    const normalizedEmail = newEmail.trim().toLowerCase();
    const authorizedEmail = process.env.ADMIN_SIGNUP_EMAIL?.trim().toLowerCase();
    if (!authorizedEmail || normalizedEmail !== authorizedEmail) {
      return res.status(403).json({
        success: false,
        message: "Only the authorized Admin email can be used for this account."
      });
    }
    const user = await User.findById(req.user.id).select("+password");
    if (!user || user.role !== "admin") {
      return res.status(404).json({
        success: false,
        message: "Admin account not found."
      });
    }
    if (normalizedEmail === user.email) {
      return res.status(400).json({
        success: false,
        message: "Enter an email address different from your current one."
      });
    }
    if (await User.exists({ email: normalizedEmail })) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists."
      });
    }

    const currentPasswordMatches = await bcrypt.compare(currentPassword, user.password);
    if (!currentPasswordMatches) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect."
      });
    }
    if (!(await canResendOTP(normalizedEmail, "email-change"))) {
      return res.status(429).json({
        success: false,
        message: "Please wait before requesting another verification code."
      });
    }

    const otp = generateOTP();
    await storeOTP(normalizedEmail, otp, "email-change");
    try {
      await sendAdminEmailChangeOTP(normalizedEmail, otp);
    } catch (emailError) {
      await OTP.deleteMany({ email: normalizedEmail, purpose: "email-change" });
      throw emailError;
    }

    return res.status(200).json({
      success: true,
      message: "A verification code was sent to your new email address.",
      data: { email: normalizedEmail, expiresIn: "10 minutes" }
    });
  } catch (error) {
    console.error("Admin email change request error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to send the Admin email verification code."
    });
  }
};

export const verifyAdminEmailChangeOTP = async (req, res) => {
  try {
    const { newEmail, otp } = req.body ?? {};
    if (!validateEmail(newEmail) || typeof otp !== "string" || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid email address and six-digit verification code."
      });
    }

    const normalizedEmail = newEmail.trim().toLowerCase();
    const authorizedEmail = process.env.ADMIN_SIGNUP_EMAIL?.trim().toLowerCase();
    if (!authorizedEmail || normalizedEmail !== authorizedEmail) {
      return res.status(403).json({
        success: false,
        message: "Only the authorized Admin email can be used for this account."
      });
    }
    const user = await User.findById(req.user.id);
    if (!user || user.role !== "admin") {
      return res.status(404).json({
        success: false,
        message: "Admin account not found."
      });
    }
    if (await User.exists({ email: normalizedEmail, _id: { $ne: user._id } })) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists."
      });
    }

    const verification = await verifyOTP(normalizedEmail, otp, "email-change");
    if (!verification.success) {
      return res.status(400).json({
        success: false,
        message: verification.message
      });
    }

    user.email = normalizedEmail;
    user.isEmailVerified = true;
    try {
      await user.save();
    } catch (error) {
      if (error?.code === 11000) {
        return res.status(409).json({
          success: false,
          message: "An account with this email already exists."
        });
      }
      throw error;
    }

    return res.status(200).json({
      success: true,
      message: "Admin login email updated successfully.",
      data: { user: serializeUser(user) }
    });
  } catch (error) {
    console.error("Admin email change verification error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to update the Admin login email."
    });
  }
};


export const getProfilePhoto = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select("profilePhotoFilename");

    if (!user || !user.profilePhotoFilename) {
      return res.status(404).json({
        success: false,
        message: "Profile photo not found."
      });
    }

    const filename = user.profilePhotoFilename;

    if (path.basename(filename) !== filename) {
      return res.status(404).json({
        success: false,
        message: "Profile photo not found."
      });
    }

    return res.sendFile(
      filename,
      { root: PROFILE_PHOTO_DIRECTORY },
      (error) => {
        if (!error || res.headersSent) return;

        if (error.code === "ENOENT") {
          res.status(404).json({
            success: false,
            message: "Profile photo not found."
          });
          return;
        }

        console.error("Profile photo retrieval error:", error.message);
        res.status(500).json({
          success: false,
          message: "Unable to retrieve profile photo."
        });
      }
    );
  } catch (error) {
    console.error("Profile photo retrieval error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve profile photo."
    });
  }
};

export const updateProfilePhoto = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "Choose a profile photo to upload."
    });
  }

  let user;
  let saved = false;

  try {
    user = await User.findById(req.user.id);

    if (!user) {
      await removeProfilePhotoFile(req.file.filename);
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    const previousFilename = user.profilePhotoFilename;
    user.profilePhotoFilename = req.file.filename;
    await user.save();
    saved = true;

    if (previousFilename) {
      await removeProfilePhotoFile(previousFilename);
    }

    return res.status(200).json({
      success: true,
      message: "Profile photo updated successfully.",
      data: {
        user: serializeUser(user)
      }
    });
  } catch (error) {
    if (!saved) {
      await removeProfilePhotoFile(req.file.filename);
    }

    console.error("Profile photo update error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to update profile photo."
    });
  }
};

export const deleteProfilePhoto = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    const previousFilename = user.profilePhotoFilename;
    user.profilePhotoFilename = null;
    await user.save();

    if (previousFilename) {
      await removeProfilePhotoFile(previousFilename);
    }

    return res.status(200).json({
      success: true,
      message: "Profile photo removed successfully.",
      data: {
        user: serializeUser(user)
      }
    });
  } catch (error) {
    console.error("Profile photo removal error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to remove profile photo."
    });
  }
};


// ==========================================
// 7. CHANGE PASSWORD
// ==========================================

export const changePassword = async (req, res) => {
  try {
    const {
      currentPassword,
      newPassword,
      confirmPassword
    } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "All password fields are required."
      });
    }

    if (newPassword === currentPassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from current password."
      });
    }

    const passwordValidation = validatePassword(newPassword);

    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: "Password validation failed.",
        errors: passwordValidation.errors
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "New password and confirmation do not match."
      });
    }

    const user = await User.findById(req.user.id).select("+password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!isCurrentPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect."
      });
    }

    user.password = await bcrypt.hash(newPassword, 12);
    user.passwordChangedAt = new Date();
    user.failedLoginAttempts = 0;
    user.lockUntil = null;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password changed successfully. Please log in again."
    });

  } catch (error) {
    console.error("Change password error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to change password."
    });
  }
};

export const requestPasswordChangeOTP = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message: "Verify your account email before changing your password."
      });
    }

    const canResend = await canResendOTP(user.email, "password-change");
    if (!canResend) {
      return res.status(429).json({
        success: false,
        message: "Please wait before requesting another OTP."
      });
    }

    const otp = generateOTP();
    await storeOTP(user.email, otp, "password-change");

    try {
      await sendPasswordChangeOTP(user.email, otp);
    } catch (emailError) {
      await OTP.deleteMany({
        email: user.email,
        purpose: "password-change"
      });
      throw emailError;
    }

    return res.status(200).json({
      success: true,
      message: "A password verification code has been sent to your account email."
    });
  } catch (error) {
    console.error("Password change OTP error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to send a password verification code."
    });
  }
};

export const changePasswordWithOTP = async (req, res) => {
  try {
    const { otp, newPassword, confirmPassword } = req.body ?? {};

    if (!/^\d{6}$/.test(String(otp || ""))) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid 6-digit OTP."
      });
    }

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: "Password validation failed.",
        errors: passwordValidation.errors
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "New password and confirmation do not match."
      });
    }

    const user = await User.findById(req.user.id).select("+password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message: "Verify your account email before changing your password."
      });
    }

    if (await bcrypt.compare(newPassword, user.password)) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from your current password."
      });
    }

    const verification = await verifyOTP(
      user.email,
      otp,
      "password-change",
      { consume: true }
    );

    if (!verification.success) {
      return res.status(400).json({
        success: false,
        message: verification.message
      });
    }

    user.password = await bcrypt.hash(newPassword, 12);
    user.passwordChangedAt = new Date();
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password changed successfully. Please log in again."
    });
  } catch (error) {
    console.error("Password change with OTP error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to change password."
    });
  }
};


// ==========================================
// 8. FORGOT PASSWORD
// ==========================================

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address."
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const genericResponse = {
      success: true,
      message: "If an eligible account exists, a password reset OTP will be sent."
    };

    const user = await User.findOne({
      email: normalizedEmail,
      isEmailVerified: true
    });

    if (!user) {
      return res.status(200).json(genericResponse);
    }

    const canResend = await canResendOTP(
      normalizedEmail,
      "password-reset"
    );

    if (!canResend) {
      return res.status(429).json({
        success: false,
        message: "Please wait before requesting another OTP."
      });
    }

    const otp = generateOTP();

    await storeOTP(
      normalizedEmail,
      otp,
      "password-reset"
    );

    try {
      await sendPasswordResetOTP(normalizedEmail, otp);
    } catch (emailError) {
      await OTP.deleteMany({
        email: normalizedEmail,
        purpose: "password-reset"
      });

      throw emailError;
    }

    return res.status(200).json(genericResponse);

  } catch (error) {
    console.error("Forgot password error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to send a password reset code."
    });
  }
};


// ==========================================
// 9. RESET PASSWORD
// ==========================================

export const resetPassword = async (req, res) => {
  try {
    const {
      email,
      otp,
      newPassword,
      confirmPassword
    } = req.body;

    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address."
      });
    }

    if (!/^\d{6}$/.test(String(otp || ""))) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid 6-digit OTP."
      });
    }

    const passwordValidation = validatePassword(newPassword);

    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: "Password validation failed.",
        errors: passwordValidation.errors
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "New password and confirmation do not match."
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({
      email: normalizedEmail,
      isEmailVerified: true
    }).select("+password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Account not found."
      });
    }

    const verification = await verifyOTP(
      normalizedEmail,
      otp,
      "password-reset",
      { consume: true }
    );

    if (!verification.success) {
      return res.status(400).json({
        success: false,
        message: verification.message
      });
    }

    user.password = await bcrypt.hash(newPassword, 12);
    user.passwordChangedAt = new Date();
    user.failedLoginAttempts = 0;
    user.lockUntil = null;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password reset successfully. Please log in again."
    });

  } catch (error) {
    console.error("Reset password error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to reset password."
    });
  }
};
