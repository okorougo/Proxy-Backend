import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { adminOnly } from "../middleware/admin";
import {
  applyVendor,
  approveVendor,
  rejectVendor,
  getAllVendorApplications,
  createDelivery,
  addeVendorLocation,
} from "../controllers/vendor.controller";

const router = Router();

router.post("/apply", authMiddleware, applyVendor);
router.get("/applications", authMiddleware, adminOnly, getAllVendorApplications);
router.patch("/approve/:id", authMiddleware, adminOnly, approveVendor);
router.patch("/reject/:id", authMiddleware, adminOnly, rejectVendor);
router.patch("/create-delivery", authMiddleware, createDelivery);
router.post("/add-location",addeVendorLocation );

export default router;
