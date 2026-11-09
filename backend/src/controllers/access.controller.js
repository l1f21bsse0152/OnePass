
import {
  previewFacilityQR,
  confirmFacilityAccess,
  AccessError
} from "../services/access.service.js";

/**
 * POST /api/access/scan
 *
 * Preview facility details and wallet balance.
 * Does NOT deduct points.
 */
export const scanFacility = async (req, res) => {
  try {
    const { token } = req.body;
    const travelerId = req.user?.id;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Facility QR token is required."
      });
    }

    if (!travelerId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required."
      });
    }

    const result = await previewFacilityQR({
      travelerId,
      token
    });

    return res.status(200).json({
      success: true,
      message: "Facility details retrieved successfully.",
      data: result
    });

  } catch (error) {
    console.error("Facility QR scan error:", error);

    if (error instanceof AccessError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }

    if (error.name === "WalletError") {
      return res.status(error.statusCode || 400).json({
        success: false,
        message: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to scan facility QR code."
    });
  }
};

/**
 * POST /api/access/confirm
 *
 * Confirms facility access and deducts points.
 */
export const confirmAccess = async (req, res) => {
  try {
    const { token } = req.body;
    const travelerId = req.user?.id;
    const idempotencyKey = req.headers["idempotency-key"];

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Facility QR token is required."
      });
    }

    if (!travelerId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required."
      });
    }

    if (!idempotencyKey) {
      return res.status(400).json({
        success: false,
        message: "Idempotency-Key header is required."
      });
    }

    const result = await confirmFacilityAccess({
      travelerId,
      token,
      idempotencyKey
    });

    return res.status(200).json({
      success: true,
      message: result.duplicate
        ? "This facility access was already confirmed."
        : "Facility access confirmed successfully.",
      data: result
    });

  } catch (error) {
    console.error("Facility access confirmation error:", error);

    if (error instanceof AccessError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }

    if (error.name === "WalletError") {
      return res.status(error.statusCode || 400).json({
        success: false,
        message: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to confirm facility access."
    });
  }
};
