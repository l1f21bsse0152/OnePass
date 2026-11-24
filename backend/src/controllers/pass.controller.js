import OnePassSubscription from "../models/onepass-subscription.model.js";
import PassPlan from "../models/pass-plan.model.js";

export const listPassPlans = async (req, res) => {
  try {
    const plans = await PassPlan.find({ active: true })
      .sort({ duration: 1, includedPoints: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      message: "OnePass packages retrieved successfully.",
      data: { plans }
    });
  } catch (error) {
    console.error("OnePass package retrieval error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve OnePass packages."
    });
  }
};

export const getMyPassStatus = async (req, res) => {
  try {
    const now = new Date();
    const subscriptions = await OnePassSubscription.find({
      traveler: req.user.id,
      status: "active",
      startsAt: { $lte: now },
      expiresAt: { $gt: now }
    })
      .populate("plan", "code name duration includedPoints bonusPoints")
      .sort({ expiresAt: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      message: "OnePass pass status retrieved successfully.",
      data: {
        hasActivePass: subscriptions.length > 0,
        subscriptions
      }
    });
  } catch (error) {
    console.error("OnePass pass status error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve OnePass pass status."
    });
  }
};
