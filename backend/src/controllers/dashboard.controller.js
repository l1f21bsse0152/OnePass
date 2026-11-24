import {
  DashboardError,
  createOwnedFacility,
  getAdminFacilityInfoQr,
  getAdminOverview,
  getFacilityOverview,
  listAdminAccesses,
  listAdminFacilities,
  listAdminTransactions,
  listAdminUsers,
  listFacilityAccesses,
  updateAdminFacilityStatus,
  updateOwnedFacility
} from "../services/dashboard.service.js";

const sendDashboardError = (res, error, context) => {
  if (error instanceof DashboardError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message
    });
  }

  console.error(`${context}:`, error);
  return res.status(500).json({
    success: false,
    message: "Unable to load dashboard data."
  });
};

export const getAdminDashboard = async (req, res) => {
  try {
    const data = await getAdminOverview();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendDashboardError(res, error, "Admin dashboard error");
  }
};

export const getAdminUsers = async (req, res) => {
  try {
    const data = await listAdminUsers(req.query);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendDashboardError(res, error, "Admin users dashboard error");
  }
};

export const getAdminFacilities = async (req, res) => {
  try {
    const data = await listAdminFacilities(req.query);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendDashboardError(res, error, "Admin facilities dashboard error");
  }
};

export const getAdminFacilityInfoQrCode = async (req, res) => {
  try {
    const data = await getAdminFacilityInfoQr(req.params.facilityId);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendDashboardError(res, error, "Admin facility QR error");
  }
};

export const getAdminTransactions = async (req, res) => {
  try {
    const data = await listAdminTransactions(req.query);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendDashboardError(res, error, "Admin transactions dashboard error");
  }
};

export const getAdminAccesses = async (req, res) => {
  try {
    const data = await listAdminAccesses(req.query);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendDashboardError(res, error, "Admin accesses dashboard error");
  }
};

export const getFacilityDashboard = async (req, res) => {
  try {
    const data = await getFacilityOverview(req.user.id);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendDashboardError(res, error, "Facility dashboard error");
  }
};

export const getFacilityAccesses = async (req, res) => {
  try {
    const data = await listFacilityAccesses(
      req.user.id,
      req.params.facilityId,
      req.query
    );
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendDashboardError(res, error, "Facility access history error");
  }
};

export const createFacility = async (req, res) => {
  try {
    const data = await createOwnedFacility(req.user.id, req.body ?? {});
    return res.status(201).json({
      success: true,
      message: "Facility submitted for admin review.",
      data
    });
  } catch (error) {
    return sendDashboardError(res, error, "Facility creation error");
  }
};

export const updateFacility = async (req, res) => {
  try {
    const data = await updateOwnedFacility(
      req.user.id,
      req.params.facilityId,
      req.body ?? {}
    );
    return res.status(200).json({
      success: true,
      message: "Facility updated successfully.",
      data
    });
  } catch (error) {
    return sendDashboardError(res, error, "Facility update error");
  }
};

export const updateFacilityStatus = async (req, res) => {
  try {
    const data = await updateAdminFacilityStatus({
      facilityId: req.params.facilityId,
      adminId: req.user.id,
      status: req.body?.status,
      reason: req.body?.reason
    });
    return res.status(200).json({
      success: true,
      message: "Facility status updated successfully.",
      data
    });
  } catch (error) {
    return sendDashboardError(res, error, "Facility status update error");
  }
};
