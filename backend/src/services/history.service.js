import mongoose from "mongoose";

import Access from "../models/access.model.js";
import Transaction from "../models/transaction.model.js";

class HistoryError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "HistoryError";
    this.statusCode = statusCode;
  }
}

const currentMonthInLahore = () => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit"
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value])
  );

  return `${values.year}-${values.month}`;
};

const getMonthRange = (month) => {
  const normalizedMonth = month || currentMonthInLahore();
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(normalizedMonth);

  if (!match) {
    throw new HistoryError("Month must use the YYYY-MM format.");
  }

  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  const lahoreOffsetMs = 5 * 60 * 60 * 1000;

  return {
    month: normalizedMonth,
    start: new Date(
      Date.UTC(year, monthNumber - 1, 1) - lahoreOffsetMs
    ),
    end: new Date(
      Date.UTC(year, monthNumber, 1) - lahoreOffsetMs
    )
  };
};

const paginationValues = ({ page = 1, limit = 20 } = {}) => {
  const requestedPage = Number(page);
  const requestedLimit = Number(limit);

  return {
    page:
      Number.isSafeInteger(requestedPage) && requestedPage > 0
        ? requestedPage
        : 1,
    limit:
      Number.isSafeInteger(requestedLimit) && requestedLimit > 0
        ? Math.min(100, requestedLimit)
        : 20
  };
};

export const getTravelerMonthlyHistory = async (
  travelerId,
  { month, page, limit } = {}
) => {
  if (!mongoose.isValidObjectId(travelerId)) {
    throw new HistoryError("Invalid user ID.", 400);
  }

  const range = getMonthRange(month);
  const pagination = paginationValues({ page, limit });
  const visitFilter = {
    traveler: travelerId,
    accessedAt: { $gte: range.start, $lt: range.end }
  };
  const transactionFilter = {
    traveler: travelerId,
    status: "completed",
    createdAt: { $gte: range.start, $lt: range.end }
  };
  const offset = (pagination.page - 1) * pagination.limit;

  const [visits, visitCount, transactions, transactionCount] =
    await Promise.all([
      Access.find(visitFilter)
        .populate(
          "facility",
          "name category city address pointsPerVisit pointsPerHour"
        )
        .populate(
          "transaction",
          "status type points balanceBefore balanceAfter balanceScope source"
        )
        .sort({ accessedAt: -1 })
        .skip(offset)
        .limit(pagination.limit)
        .lean(),
      Access.countDocuments(visitFilter),
      Transaction.find(transactionFilter)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(pagination.limit)
        .lean(),
      Transaction.countDocuments(transactionFilter)
    ]);

  return {
    month: range.month,
    timezone: "Asia/Karachi",
    visits: {
      items: visits,
      pagination: {
        ...pagination,
        total: visitCount,
        pages: Math.ceil(visitCount / pagination.limit)
      }
    },
    transactions: {
      items: transactions,
      pagination: {
        ...pagination,
        total: transactionCount,
        pages: Math.ceil(transactionCount / pagination.limit)
      }
    }
  };
};

export { HistoryError };
