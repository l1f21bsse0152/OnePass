
import express from "express";

import {
  register,
  registerDashboardAccount,
  verifyDashboardRegistrationOTP,
  verifyRegistrationOTP,
  resendRegistrationOTP,
  login,
  googleSignIn,
  verifyGoogleRegistrationOTP,
  getMe,
  updateMe,
  requestAdminEmailChangeOTP,
  verifyAdminEmailChangeOTP,
  changePassword,
  requestPasswordChangeOTP,
  changePasswordWithOTP,
  forgotPassword,
  resetPassword,
  getProfilePhoto,
  updateProfilePhoto,
  deleteProfilePhoto
} from "../controllers/auth.controller.js";

import { protect, requireRole } from "../middleware/auth.middleware.js";
import { profilePhotoUpload } from "../middleware/profile-photo-upload.middleware.js";

const router = express.Router();


// PUBLIC AUTHENTICATION ROUTES

router.post("/register", register);

router.post("/dashboard/register", registerDashboardAccount);

router.post(
  "/dashboard/verify-registration-otp",
  verifyDashboardRegistrationOTP
);

router.post("/verify-registration-otp", verifyRegistrationOTP);

router.post("/resend-registration-otp", resendRegistrationOTP);

router.post("/login", login);

router.post("/google", googleSignIn);

router.post("/google/verify-registration-otp", verifyGoogleRegistrationOTP);

router.post("/forgot-password", forgotPassword);

router.post("/reset-password", resetPassword);


// PROTECTED AUTHENTICATION ROUTES

router.get("/me", protect, getMe);

router.put("/me", protect, updateMe);
router.post(
  "/admin/email-change/request-otp",
  protect,
  requireRole("admin"),
  requestAdminEmailChangeOTP
);
router.post(
  "/admin/email-change/verify-otp",
  protect,
  requireRole("admin"),
  verifyAdminEmailChangeOTP
);
router.get("/me/photo", protect, getProfilePhoto);
router.post("/me/photo", protect, profilePhotoUpload, updateProfilePhoto);
router.delete("/me/photo", protect, deleteProfilePhoto);

router.patch("/change-password", protect, changePassword);

router.post("/me/password-otp", protect, requestPasswordChangeOTP);

router.patch("/me/password", protect, changePasswordWithOTP);


export default router;
