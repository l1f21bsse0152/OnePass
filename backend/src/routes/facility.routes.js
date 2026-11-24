import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import {
  listFacilities,
  getFacility,
  buyFacilityPackage
} from "../controllers/facility.controller.js";

const router = express.Router();

// Public discovery endpoints
router.get("/", listFacilities);
router.post(
  "/:id/packages/:packageType/purchase",
  protect,
  buyFacilityPackage
);
router.get("/:id", getFacility);

export default router;
