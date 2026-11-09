
import {
  generateFacilityQR,
  FacilityQRError
} from "../services/facility-qr.service.js";

export const createFacilityQR = async (req, res) => {
  try {
    const { facilityId } = req.body;
    const ownerId = req.user?.id;

    if (!facilityId) {
      return res.status(400).json({
        success: false,
        message: "Facility ID is required."
      });
    }

    if (!ownerId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required."
      });
    }

    const result = await generateFacilityQR({
      facilityId,
      ownerId
    });

    return res.status(201).json({
      success: true,
      message: "Permanent facility QR code generated successfully.",
      data: result
    });

  } catch (error) {
    console.error("Facility QR generation error:", error);

    if (error instanceof FacilityQRError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to generate facility QR code."
    });
  }
};
