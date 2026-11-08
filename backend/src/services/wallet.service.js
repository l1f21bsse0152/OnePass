
import mongoose from "mongoose";

import Wallet from "../models/wallet.model.js";
import WalletLot from "../models/wallet-lot.model.js";
import Transaction from "../models/transaction.model.js";

class WalletError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "WalletError";
    this.statusCode = statusCode;
  }
}

const validatePoints = (points) => {
  if (!Number.isSafeInteger(points) || points <= 0) {
    throw new WalletError("Points must be a positive whole number.");
  }
};

const normalizeIdempotencyKey = (key) => {
  if (key === undefined || key === null) {
    return null;
  }

  if (typeof key !== "string") {
    throw new WalletError("Invalid idempotency key.");
  }

  const normalizedKey = key.trim();

  if (!normalizedKey || normalizedKey.length > 128) {
    throw new WalletError("Idempotency key must be between 1 and 128 characters.");
  }

  return normalizedKey;
};

const normalizeReferenceId = (referenceId) => {
  return referenceId === undefined || referenceId === null
    ? null
    : String(referenceId);
};

const runInTransaction = async (callback) => {
  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      result = await callback(session);
    });

    return result;
  } finally {
    await session.endSession();
  }
};

const getOrCreateWallet = async (travelerId, session) => {
  if (!mongoose.isValidObjectId(travelerId)) {
    throw new WalletError("Invalid traveler ID.", 400);
  }

  let wallet = await Wallet.findOne({
    traveler: travelerId
  }).session(session);

  if (!wallet) {
    wallet = new Wallet({
      traveler: travelerId,
      purchasedPointsBalance: 0,
      bonusPointsBalance: 0,
      status: "active"
    });

    await wallet.save({ session });
  }

  return wallet;
};

const expireBonusPointsInSession = async (wallet, session) => {
  const now = new Date();

  const expiredLots = await WalletLot.find({
    wallet: wallet._id,
    type: "bonus",
    status: "active",
    remainingPoints: { $gt: 0 },
    expiresAt: { $lte: now }
  }).session(session);

  let expiredPoints = 0;

  for (const lot of expiredLots) {
    expiredPoints += lot.remainingPoints;

    lot.remainingPoints = 0;
    lot.status = "expired";

    await lot.save({ session });
  }

  if (expiredPoints > 0) {
    if (wallet.bonusPointsBalance < expiredPoints) {
      throw new WalletError(
        "Wallet bonus balance is inconsistent.",
        500
      );
    }

    const balanceBefore =
      wallet.purchasedPointsBalance + wallet.bonusPointsBalance;

    wallet.bonusPointsBalance -= expiredPoints;

    await wallet.save({ session });

    const balanceAfter =
      wallet.purchasedPointsBalance + wallet.bonusPointsBalance;

    await Transaction.create(
      [
        {
          wallet: wallet._id,
          traveler: wallet.traveler,
          type: "adjustment",
          status: "completed",
          points: expiredPoints,
          balanceBefore,
          balanceAfter,
          description: "Expired promotional bonus points.",
          source: "system",
          metadata: {
            reason: "bonus_expiry"
          }
        }
      ],
      { session }
    );
  }

  return expiredPoints;
};

const findExistingCredit = async ({
  idempotencyKey,
  wallet,
  points,
  type,
  source,
  description,
  referenceId,
  expiresAt,
  session
}) => {
  if (!idempotencyKey) {
    return null;
  }

  const existing = await Transaction.findOne({
    idempotencyKey
  }).session(session);

  if (!existing) {
    return null;
  }

  const expectedTransactionType =
    type === "bonus" ? "bonus" : "purchase";

  // Older transactions may not contain pointType metadata.
  // Preserve compatibility with those existing records.
  const storedPointType = existing.metadata?.pointType;
  const storedExpiry = existing.metadata?.expiresAt;

  const metadataMatches =
    storedPointType === undefined ||
    (
      storedPointType === type &&
      (storedExpiry ?? null) ===
        (expiresAt ? expiresAt.toISOString() : null)
    );

  const matches =
    existing.wallet.toString() === wallet._id.toString() &&
    existing.points === points &&
    existing.type === expectedTransactionType &&
    existing.source === source &&
    (existing.description || "") === description &&
    (existing.referenceId ?? null) === referenceId &&
    metadataMatches;

  if (!matches) {
    throw new WalletError(
      "Idempotency key was already used for another operation.",
      409
    );
  }

  return existing;
};

const findExistingDebit = async ({
  idempotencyKey,
  wallet,
  points,
  source,
  description,
  referenceId,
  session
}) => {
  if (!idempotencyKey) {
    return null;
  }

  const existing = await Transaction.findOne({
    idempotencyKey
  }).session(session);

  if (!existing) {
    return null;
  }

  const matches =
    existing.wallet.toString() === wallet._id.toString() &&
    existing.points === points &&
    existing.type === "debit" &&
    existing.source === source &&
    (existing.description || "") === description &&
    (existing.referenceId ?? null) === referenceId;

  if (!matches) {
    throw new WalletError(
      "Idempotency key was already used for another operation.",
      409
    );
  }

  return existing;
};

export const createWallet = async (travelerId) => {
  return runInTransaction(async (session) => {
    const wallet = await getOrCreateWallet(travelerId, session);

    return wallet;
  });
};

export const getWalletBalance = async (travelerId) => {
  return runInTransaction(async (session) => {
    const wallet = await getOrCreateWallet(travelerId, session);

    if (wallet.status !== "active") {
      throw new WalletError(
        "Your wallet is currently frozen.",
        403
      );
    }

    await expireBonusPointsInSession(wallet, session);

    return {
      walletId: wallet._id,
      purchasedPoints: wallet.purchasedPointsBalance,
      bonusPoints: wallet.bonusPointsBalance,
      totalAvailablePoints:
        wallet.purchasedPointsBalance +
        wallet.bonusPointsBalance,
      status: wallet.status
    };
  });
};

export const creditPoints = async ({
  travelerId,
  points,
  type = "purchased",
  source = "other",
  description = "",
  expiresAt = null,
  referenceId = null,
  idempotencyKey = null
}) => {
  validatePoints(points);

  if (!["purchased", "bonus"].includes(type)) {
    throw new WalletError("Invalid point type.");
  }

  const normalizedKey =
    normalizeIdempotencyKey(idempotencyKey);

  const normalizedReference =
    normalizeReferenceId(referenceId);

  let normalizedExpiry = null;

  if (type === "bonus") {
    if (!expiresAt) {
      throw new WalletError(
        "Bonus points must have a future expiry date."
      );
    }

    normalizedExpiry = new Date(expiresAt);

    if (
      Number.isNaN(normalizedExpiry.getTime()) ||
      normalizedExpiry <= new Date()
    ) {
      throw new WalletError(
        "Bonus points must have a valid future expiry date."
      );
    }
  }

  return runInTransaction(async (session) => {
    const wallet = await getOrCreateWallet(travelerId, session);

    if (wallet.status !== "active") {
      throw new WalletError(
        "Your wallet is currently frozen.",
        403
      );
    }

    await expireBonusPointsInSession(wallet, session);

    const existing = await findExistingCredit({
      idempotencyKey: normalizedKey,
      wallet,
      points,
      type,
      source,
      description,
      referenceId: normalizedReference,
      expiresAt: normalizedExpiry,
      session
    });

    if (existing) {
      return {
        transaction: existing,
        duplicate: true
      };
    }

    const balanceBefore =
      wallet.purchasedPointsBalance +
      wallet.bonusPointsBalance;

    if (type === "purchased") {
      wallet.purchasedPointsBalance += points;
    } else {
      wallet.bonusPointsBalance += points;
    }

    await wallet.save({ session });

    const lot = new WalletLot({
      wallet: wallet._id,
      type,
      source,
      originalPoints: points,
      remainingPoints: points,
      expiresAt: normalizedExpiry,
      status: "active",
      referenceId: normalizedReference
    });

    await lot.save({ session });

    const balanceAfter =
      wallet.purchasedPointsBalance +
      wallet.bonusPointsBalance;

    const transaction = new Transaction({
      wallet: wallet._id,
      traveler: wallet.traveler,
      type: type === "bonus" ? "bonus" : "purchase",
      status: "completed",
      points,
      balanceBefore,
      balanceAfter,
      description,
      source,
      referenceId: normalizedReference,
      idempotencyKey: normalizedKey,
      metadata: {
        pointType: type,
        expiresAt: normalizedExpiry
          ? normalizedExpiry.toISOString()
          : null
      }
    });

    await transaction.save({ session });

    return {
      transaction,
      lot,
      balanceAfter,
      duplicate: false
    };
  });
};

export const debitPoints = async ({
  travelerId,
  points,
  description = "Points redeemed.",
  source = "facility_access",
  referenceId = null,
  idempotencyKey = null
}) => {
  validatePoints(points);

  const normalizedKey =
    normalizeIdempotencyKey(idempotencyKey);

  const normalizedReference =
    normalizeReferenceId(referenceId);

  return runInTransaction(async (session) => {
    const wallet = await getOrCreateWallet(travelerId, session);

    if (wallet.status !== "active") {
      throw new WalletError(
        "Your wallet is currently frozen.",
        403
      );
    }

    await expireBonusPointsInSession(wallet, session);

    const existing = await findExistingDebit({
      idempotencyKey: normalizedKey,
      wallet,
      points,
      source,
      description,
      referenceId: normalizedReference,
      session
    });

    if (existing) {
      return {
        transaction: existing,
        duplicate: true
      };
    }

    const balanceBefore =
      wallet.purchasedPointsBalance +
      wallet.bonusPointsBalance;

    if (balanceBefore < points) {
      throw new WalletError(
        "Insufficient wallet balance.",
        400
      );
    }

    const now = new Date();

    // Load all currently spendable bonus lots.
    // Earliest-expiring bonus points are consumed first.
    const bonusLots = await WalletLot.find({
      wallet: wallet._id,
      type: "bonus",
      status: "active",
      remainingPoints: { $gt: 0 },
      expiresAt: { $gt: now }
    })
      .sort({ expiresAt: 1, createdAt: 1 })
      .session(session);

    // Purchased lots are consumed in FIFO order.
    const purchasedLots = await WalletLot.find({
      wallet: wallet._id,
      type: "purchased",
      status: "active",
      remainingPoints: { $gt: 0 }
    })
      .sort({ createdAt: 1 })
      .session(session);

    // Verify that database lots agree with wallet balances
    // before changing either the lots or the wallet.
    const bonusLotBalance = bonusLots.reduce(
      (total, lot) => total + lot.remainingPoints,
      0
    );

    const purchasedLotBalance = purchasedLots.reduce(
      (total, lot) => total + lot.remainingPoints,
      0
    );

    if (
      bonusLotBalance !== wallet.bonusPointsBalance ||
      purchasedLotBalance !== wallet.purchasedPointsBalance
    ) {
      throw new WalletError(
        "Wallet balances do not match the remaining point lots. Please contact support.",
        500
      );
    }

    let remainingToDeduct = points;
    let bonusDeducted = 0;
    let purchasedDeducted = 0;

    // Deduct bonus points first.
    for (const lot of bonusLots) {
      if (remainingToDeduct <= 0) {
        break;
      }

      const deduction = Math.min(
        lot.remainingPoints,
        remainingToDeduct
      );

      lot.remainingPoints -= deduction;
      remainingToDeduct -= deduction;
      bonusDeducted += deduction;

      if (lot.remainingPoints === 0) {
        lot.status = "depleted";
      }

      await lot.save({ session });
    }

    // Use purchased points only after bonus points are exhausted.
    for (const lot of purchasedLots) {
      if (remainingToDeduct <= 0) {
        break;
      }

      const deduction = Math.min(
        lot.remainingPoints,
        remainingToDeduct
      );

      lot.remainingPoints -= deduction;
      remainingToDeduct -= deduction;
      purchasedDeducted += deduction;

      if (lot.remainingPoints === 0) {
        lot.status = "depleted";
      }

      await lot.save({ session });
    }

    if (remainingToDeduct > 0) {
      throw new WalletError(
        "Wallet point lots do not match the available balance.",
        500
      );
    }

    if (
      bonusDeducted + purchasedDeducted !== points ||
      bonusDeducted > wallet.bonusPointsBalance ||
      purchasedDeducted > wallet.purchasedPointsBalance
    ) {
      throw new WalletError(
        "Wallet deduction failed its balance consistency check.",
        500
      );
    }

    // Update wallet balances using the actual amounts
    // deducted from each type of point lot.
    wallet.bonusPointsBalance -= bonusDeducted;
    wallet.purchasedPointsBalance -= purchasedDeducted;

    await wallet.save({ session });

    const balanceAfter =
      wallet.purchasedPointsBalance +
      wallet.bonusPointsBalance;

    const transaction = new Transaction({
      wallet: wallet._id,
      traveler: wallet.traveler,
      type: "debit",
      status: "completed",
      points,
      balanceBefore,
      balanceAfter,
      description,
      source,
      referenceId: normalizedReference,
      idempotencyKey: normalizedKey
    });

    await transaction.save({ session });

    return {
      transaction,
      balanceAfter,
      duplicate: false
    };
  });
};

export const getTransactionHistory = async (
  travelerId,
  { page = 1, limit = 20 } = {}
) => {
  if (!mongoose.isValidObjectId(travelerId)) {
    throw new WalletError("Invalid traveler ID.", 400);
  }

  const requestedPage = Number(page);
  const requestedLimit = Number(limit);

  const safePage =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;

  const safeLimit =
    Number.isSafeInteger(requestedLimit) && requestedLimit > 0
      ? Math.min(100, requestedLimit)
      : 20;

  const wallet = await Wallet.findOne({
    traveler: travelerId
  });

  if (!wallet) {
    return {
      transactions: [],
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: 0,
        pages: 0
      }
    };
  }

  const filter = {
    wallet: wallet._id,
    status: "completed"
  };

  const [transactions, total] = await Promise.all([
    Transaction.find(filter)
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),

    Transaction.countDocuments(filter)
  ]);

  return {
    transactions,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.ceil(total / safeLimit)
    }
  };
};

export { WalletError };
