
import express from "express";

import { protect } from "../middleware/auth.middleware.js";

import {
  scanFacility,
  confirmAccess
} from "../controllers/access.controller.js";

const router = express.Router();

// Scan QR and preview facility access (no deduction).
router.post("/scan", protect, scanFacility);

// Confirm access and deduct wallet points.
router.post("/confirm", protect, confirmAccess);

export default router;
