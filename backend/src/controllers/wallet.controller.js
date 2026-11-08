
import {
  getWalletBalance,
  creditPoints,
  debitPoints,
  getTransactionHistory,
  WalletError
} from "../services/wallet.service.js";

const handleError = (res, error) => {
  console.error("Wallet Error:", error);

  if (error instanceof WalletError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message
    });
  }

  return res.status(500).json({
    success: false,
    message: "An unexpected wallet error occurred."
  });
};

const rejectOutsideDevelopment = (res) => {
  if (process.env.NODE_ENV !== "development") {
    res.status(404).json({
      success: false,
      message: "Endpoint not found."
    });

    return true;
  }

  return false;
};

// Get the logged-in traveler's wallet.
export const getMyWallet = async (req, res) => {
  try {
    const wallet = await getWalletBalance(req.user.id);

    return res.status(200).json({
      success: true,
      message: "Wallet retrieved successfully.",
      data: wallet
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// Get the logged-in traveler's transaction history.
export const getMyTransactions = async (req, res) => {
  try {
    const result = await getTransactionHistory(
      req.user.id,
      {
        page: req.query.page,
        limit: req.query.limit
      }
    );

    return res.status(200).json({
      success: true,
      message: "Transaction history retrieved successfully.",
      data: result
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// Development-only wallet credit endpoint.
export const testWalletCredit = async (req, res) => {
  try {
    if (rejectOutsideDevelopment(res)) {
      return;
    }

    const { points, type, expiresAt } = req.body;

    const idempotencyKey =
      req.get("Idempotency-Key")?.trim();

    if (!Number.isSafeInteger(points) || points <= 0) {
      return res.status(400).json({
        success: false,
        message: "Points must be a positive whole number."
      });
    }

    if (!["purchased", "bonus"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Type must be purchased or bonus."
      });
    }

    if (!idempotencyKey || idempotencyKey.length > 128) {
      return res.status(400).json({
        success: false,
        message: "A valid Idempotency-Key header is required."
      });
    }

    const result = await creditPoints({
      travelerId: req.user.id,
      points,
      type,
      source: "admin_credit",
      description: "Development wallet credit",
      expiresAt: type === "bonus" ? expiresAt : null,
      idempotencyKey
    });

    return res.status(200).json({
      success: true,
      message: result.duplicate
        ? "This credit was already processed."
        : "Wallet credited successfully.",
      data: result
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// Development-only wallet debit endpoint.
export const testWalletDebit = async (req, res) => {
  try {
    if (rejectOutsideDevelopment(res)) {
      return;
    }

    const { points } = req.body;

    const idempotencyKey =
      req.get("Idempotency-Key")?.trim();

    if (!Number.isSafeInteger(points) || points <= 0) {
      return res.status(400).json({
        success: false,
        message: "Points must be a positive whole number."
      });
    }

    if (!idempotencyKey || idempotencyKey.length > 128) {
      return res.status(400).json({
        success: false,
        message: "A valid Idempotency-Key header is required."
      });
    }

    const result = await debitPoints({
      travelerId: req.user.id,
      points,
      description: "Development wallet debit test",
      source: "system",
      idempotencyKey
    });

    return res.status(200).json({
      success: true,
      message: result.duplicate
        ? "This debit was already processed."
        : "Wallet debited successfully.",
      data: result
    });
  } catch (error) {
    return handleError(res, error);
  }
};
