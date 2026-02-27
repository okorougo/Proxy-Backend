import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { adminOnly } from "../middleware/admin";
import {
  applyVendor,
  approveVendor,
  rejectVendor,
  getAllVendorApplications,
  createMultiVendorOrder,
  addeVendorLocation,
  getVendorDashboardStats,
  getVendorById,
  getVendorOrders,
  pushOrderToRiders,
  updateVendor,
  requestWithdrawal,
  saveVendorBank,
  getBanks,
  resolveAccount,
  getWallet,
  getVendorBanksDetails,
  completeSelfDelivery,
  vendorStartDelivery,
  previewOrder,
} from "../controllers/vendor.controller";

const router = Router();

router.post("/apply", authMiddleware, applyVendor);
router.get("/applications", authMiddleware, adminOnly, getAllVendorApplications);
router.patch("/approve/:id", authMiddleware, adminOnly, approveVendor);
router.patch("/reject/:id", authMiddleware, adminOnly, rejectVendor);
router.post("/create-delivery", authMiddleware, createMultiVendorOrder);
// preview calculates items total + delivery fee but does not create any records
router.post("/delivery/preview", authMiddleware, previewOrder);
router.post("/add-location",addeVendorLocation );
router.get("/orders", authMiddleware, getVendorOrders);
router.get("/dashboard", authMiddleware, getVendorDashboardStats);
router.get("/get-vendor/:id", authMiddleware, getVendorById);
router.post("/push-order-to-rider/:deliveryId", authMiddleware, pushOrderToRiders);
router.put("/update", authMiddleware, updateVendor);
// Vendor withdrawal Requests
router.post("/withdrawals/request", authMiddleware, requestWithdrawal);

// Getting bank details and saving bank details will be done in user routes since
router.post("/update-bank", authMiddleware, saveVendorBank);
router.get("/get-bank", authMiddleware, getBanks);
router.post("/resolve-account", resolveAccount);

router.get("/get-wallet", authMiddleware, getWallet);

router.get("/get-vendor-bank-details", authMiddleware, getVendorBanksDetails);

// ========== SELF-DELIVERY SERVICE ENDPOINTS ==========

// Vendor starts delivery (rendered service)
router.post("/delivery/start", authMiddleware, vendorStartDelivery);

// Vendor completes delivery (rendered service)
router.post("/delivery/complete", authMiddleware, completeSelfDelivery);

export default router;
