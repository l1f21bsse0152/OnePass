import {
  getTravelerMonthlyHistory,
  HistoryError
} from "../services/history.service.js";

export const getMyMonthlyHistory = async (req, res) => {
  try {
    const result = await getTravelerMonthlyHistory(req.user.id, {
      month: req.query.month,
      page: req.query.page,
      limit: req.query.limit
    });

    return res.status(200).json({
      success: true,
      message: "Monthly history retrieved successfully.",
      data: result
    });
  } catch (error) {
    if (error instanceof HistoryError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }

    console.error("Monthly history error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve monthly history."
    });
  }
};
