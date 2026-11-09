// Facility access routes

import express from "express";

import { protect } from "../middleware/auth.middleware.js";
import {
  createFacilityQR
} from "../controllers/facility-qr.controller.js";

const router = express.Router();

// Allow only authenticated facility accounts.
const requireFacilityRole = (req, res, next) => {
  if (req.user?.role !== "facility") {
    return res.status(403).json({
      success: false,
      message: "Only facility accounts can manage facility QR codes."
    });
  }

  next();
};

// Generate or replace a facility's permanent QR code.
router.post(
  "/generate",
  protect,
  requireFacilityRole,
  createFacilityQR
);

export default router;
