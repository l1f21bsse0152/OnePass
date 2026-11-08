
import express from "express";

import {
  register,
  verifyRegistrationOTP,
  login,
  getMe,
  updateMe,
  changePassword,
  forgotPassword,
  resetPassword
} from "../controllers/auth.controller.js";

import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();


// PUBLIC AUTHENTICATION ROUTES

router.post("/register", register);

router.post("/verify-registration-otp", verifyRegistrationOTP);

router.post("/login", login);

router.post("/forgot-password", forgotPassword);

router.post("/reset-password", resetPassword);


// PROTECTED AUTHENTICATION ROUTES

router.get("/me", protect, getMe);

router.put("/me", protect, updateMe);

router.patch("/change-password", protect, changePassword);


export default router;
