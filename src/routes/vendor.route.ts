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
} from "../controllers/vendor.controller";

const router = Router();

router.post("/apply", authMiddleware, applyVendor);
router.get("/applications", authMiddleware, adminOnly, getAllVendorApplications);
router.patch("/approve/:id", authMiddleware, adminOnly, approveVendor);
router.patch("/reject/:id", authMiddleware, adminOnly, rejectVendor);
router.post("/create-delivery", authMiddleware, createMultiVendorOrder);
router.post("/add-location",addeVendorLocation );
router.get("/orders", authMiddleware, getVendorOrders);
router.get("/dashboard", authMiddleware, getVendorDashboardStats);
router.get("/get-vendor/:id", authMiddleware, getVendorById);
router.get("/push-order-to-rider/:deliveryId", authMiddleware, pushOrderToRiders);
export default router;
