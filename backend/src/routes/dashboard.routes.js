import express from "express";

import {
  getAdminDashboard,
  getAdminFacilityInfoQrCode,
  getAdminUsers,
  getAdminFacilities,
  getAdminTransactions,
  getAdminAccesses,
  getFacilityDashboard,
  getFacilityAccesses,
  createFacility,
  updateFacility,
  updateFacilityStatus
} from "../controllers/dashboard.controller.js";
import { protect, requireRole } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get(
  "/admin/overview",
  protect,
  requireRole("admin"),
  getAdminDashboard
);
router.get(
  "/admin/users",
  protect,
  requireRole("admin"),
  getAdminUsers
);
router.get(
  "/admin/facilities",
  protect,
  requireRole("admin"),
  getAdminFacilities
);
router.get(
  "/admin/facilities/:facilityId/info-qr",
  protect,
  requireRole("admin"),
  getAdminFacilityInfoQrCode
);
router.patch(
  "/admin/facilities/:facilityId/status",
  protect,
  requireRole("admin"),
  updateFacilityStatus
);
router.get(
  "/admin/transactions",
  protect,
  requireRole("admin"),
  getAdminTransactions
);
router.get(
  "/admin/accesses",
  protect,
  requireRole("admin"),
  getAdminAccesses
);

router.get(
  "/facility/overview",
  protect,
  requireRole("facility"),
  getFacilityDashboard
);
router.post(
  "/facility/facilities",
  protect,
  requireRole("facility"),
  createFacility
);
router.patch(
  "/facility/facilities/:facilityId",
  protect,
  requireRole("facility"),
  updateFacility
);
router.get(
  "/facility/facilities/:facilityId/accesses",
  protect,
  requireRole("facility"),
  getFacilityAccesses
);

export default router;
