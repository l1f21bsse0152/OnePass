import mongoose from "mongoose";
import Access from "../models/access.model.js";
import Facility from "../models/facility.model.js";
import { getFacilityPackageConfig } from "./facility-package-config.js";

class FacilityError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "FacilityError";
    this.statusCode = statusCode;
  }
}

const attachFacilityPackages = (facility) => {
  facility.pointsPerHour ??= facility.pointsPerVisit;
  const packages = {};

  if (facility.accessEnabled !== false) {
    for (const packageType of ["weekly", "monthly"]) {
      const packageConfig = getFacilityPackageConfig(facility, packageType);
      if (packageConfig) {
        packages[packageType] = packageConfig;
      }
    }
  }

  facility.packages = packages;
  return facility;
};

const attachCurrentOccupancy = async (facilities) => {
  if (!facilities.length) return facilities;

  const activeAccesses = await Access.aggregate([
    {
      $match: {
        facility: { $in: facilities.map(({ _id }) => _id) },
        $expr: {
          $gt: [
            {
              $add: [
                "$accessedAt",
                { $multiply: ["$hoursUsed", 60 * 60 * 1000] }
              ]
            },
            new Date()
          ]
        }
      }
    },
    { $group: { _id: "$facility", occupancy: { $sum: 1 } } }
  ]);
  const occupancyByFacility = Object.fromEntries(
    activeAccesses.map((item) => [String(item._id), item.occupancy])
  );

  return facilities.map((facility) => {
    const currentOccupancy = occupancyByFacility[String(facility._id)] || 0;
    return {
      ...facility,
      currentOccupancy,
      isAtCapacity: Boolean(
        facility.capacityLimit &&
        currentOccupancy >= facility.capacityLimit
      )
    };
  });
};

const publicFacilityFields =
  "name description category address city accessEnabled pointsPerVisit pointsPerHour packages capacityLimit amenities photos operatingHours holidayClosures timeZone acceptedAccessMethods latitude longitude";

/**
 * Retrieve facilities with filtering, search, and pagination.
 */
export const getFacilities = async ({
  city,
  category,
  search,
  page = 1,
  limit = 20
} = {}) => {
  const query = {
    status: "active",
    isTestData: { $ne: true }
  };

  if (city && typeof city === "string" && city.trim()) {
    query.city = new RegExp(`^${city.trim()}$`, "i");
  }

  if (
    category &&
    typeof category === "string" &&
    category.trim() &&
    category.trim().toLowerCase() !== "all"
  ) {
    query.category = category.trim().toLowerCase();
  }

  if (search && typeof search === "string" && search.trim()) {
    const term = search.trim();
    const sanitizedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    query.$or = [
      { name: { $regex: sanitizedTerm, $options: "i" } },
      { address: { $regex: sanitizedTerm, $options: "i" } },
      { description: { $regex: sanitizedTerm, $options: "i" } }
    ];
  }

  const requestedPage = Number(page);
  const requestedLimit = Number(limit);

  const safePage =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;

  const safeLimit =
    Number.isSafeInteger(requestedLimit) && requestedLimit > 0
      ? Math.min(50, requestedLimit)
      : 20;

  const [facilities, total] = await Promise.all([
    Facility.find(query)
      .select(publicFacilityFields)
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    Facility.countDocuments(query)
  ]);

  return {
    facilities: (await attachCurrentOccupancy(facilities))
      .map(attachFacilityPackages),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.ceil(total / safeLimit)
    }
  };
};

/**
 * Retrieve a single active facility by ID.
 */
export const getFacilityById = async (facilityId) => {
  if (!mongoose.isValidObjectId(facilityId)) {
    throw new FacilityError("Invalid facility ID.", 400);
  }

  const facility = await Facility.findOne({
    _id: facilityId,
    status: "active",
    isTestData: { $ne: true }
  })
    .select(publicFacilityFields)
    .lean();

  if (!facility) {
    throw new FacilityError("Facility not found.", 404);
  }

  const [facilityWithOccupancy] = await attachCurrentOccupancy([facility]);
  return attachFacilityPackages(facilityWithOccupancy);
};

export { FacilityError };
