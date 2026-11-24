import {
  getFacilities,
  getFacilityById,
  FacilityError
} from "../services/facility.service.js";
import {
  purchaseFacilityPackage,
  FacilityPackageError
} from "../services/facility-package.service.js";

const handleError = (res, error) => {
  if (error instanceof FacilityError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message
    });
  }

  if (error instanceof FacilityPackageError) {
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

  console.error("Facility Controller Error:", error);

  return res.status(500).json({
    success: false,
    message: "An unexpected error occurred while fetching facilities."
  });
};

/**
 * GET /api/facilities
 * List active facilities with optional filters for city, category, search, and pagination.
 */
export const listFacilities = async (req, res) => {
  try {
    const { city, category, search, page, limit } = req.query;

    const result = await getFacilities({
      city,
      category,
      search,
      page,
      limit
    });

    return res.status(200).json({
      success: true,
      message: "Facilities retrieved successfully.",
      data: result
    });
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * GET /api/facilities/:id
 * Retrieve details of a single active facility by its ID.
 */
export const getFacility = async (req, res) => {
  try {
    const { id } = req.params;

    const facility = await getFacilityById(id);

    return res.status(200).json({
      success: true,
      message: "Facility retrieved successfully.",
      data: facility
    });
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * POST /api/facilities/:id/packages/:packageType/purchase
 * Purchase a weekly or monthly facility package with wallet points.
 */
export const buyFacilityPackage = async (req, res) => {
  try {
    const result = await purchaseFacilityPackage({
      travelerId: req.user.id,
      facilityId: req.params.id,
      packageType: req.params.packageType,
      idempotencyKey: req.get("Idempotency-Key")
    });

    return res.status(result.duplicate ? 200 : 201).json({
      success: true,
      message: result.duplicate
        ? "This facility package was already purchased."
        : "Facility package purchased successfully.",
      data: result
    });
  } catch (error) {
    return handleError(res, error);
  }
};
