import express from "express";

import { protect } from "../middleware/auth.middleware.js";
import {
  getMyPassStatus,
  listPassPlans
} from "../controllers/pass.controller.js";

const router = express.Router();

router.get("/plans", listPassPlans);
router.get("/me", protect, getMyPassStatus);

export default router;
