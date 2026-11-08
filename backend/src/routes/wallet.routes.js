
import express from "express";

import {
  getMyWallet,
  getMyTransactions,
  testWalletCredit,
  testWalletDebit
} from "../controllers/wallet.controller.js";

import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

// All wallet routes require authentication.
router.use(protect);

// Permanent traveler wallet endpoints.
router.get("/", getMyWallet);

router.get("/transactions", getMyTransactions);

// Development-only testing endpoints.
// These routes are not registered in production,
// staging, or when NODE_ENV is not development.
if (process.env.NODE_ENV === "development") {
  router.post("/test-credit", testWalletCredit);

  router.post("/test-debit", testWalletDebit);
}

export default router;
