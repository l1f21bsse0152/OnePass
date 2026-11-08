
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

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
  sendPasswordResetOTP
} from "../services/email.service.js";


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
    console.error("Registration error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to complete registration."
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
// 3. LOGIN USER
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


// ==========================================
// 4. GET LOGGED-IN USER PROFILE
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
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          isEmailVerified: user.isEmailVerified,
          role: user.role,
          createdAt: user.createdAt
        }
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
// 5. UPDATE USER PROFILE
// ==========================================

export const updateMe = async (req, res) => {
  try {
    const { fullName } = req.body;

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

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { fullName: trimmedName } },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
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
    console.error("Update profile error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to update profile."
    });
  }
};


// ==========================================
// 6. CHANGE PASSWORD
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


// ==========================================
// 7. FORGOT PASSWORD
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

    return res.status(200).json({
      success: true,
      message: "If an eligible account exists, a password reset OTP will be sent."
    });
  }
};


// ==========================================
// 8. RESET PASSWORD
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

    const verification = await verifyOTP(
      normalizedEmail,
      otp,
      "password-reset",
      { consume: false }
    );

    if (!verification.success) {
      return res.status(400).json({
        success: false,
        message: verification.message
      });
    }

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

    const finalVerification = await verifyOTP(
      normalizedEmail,
      otp,
      "password-reset",
      { consume: true }
    );

    if (!finalVerification.success) {
      return res.status(400).json({
        success: false,
        message: finalVerification.message
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
