import express from "express";

import { protect } from "../middleware/auth.middleware.js";
import { getMyMonthlyHistory } from "../controllers/history.controller.js";

const router = express.Router();

router.get("/monthly", protect, getMyMonthlyHistory);

export default router;
