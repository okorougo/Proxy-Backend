import express from "express";
import multer from "multer";
import { authMiddleware } from "../middleware/auth";
import {
  registerRider,
  uploadRiderVehicle,
  uploadRiderKyc,
  getMyRiderProfile,
  updateRiderStatus,
  updateRiderLocation,
  toggleRiderOnline,
  getNearbyRiders,
  approveRiderKyc,
  rejectRiderKyc,
  approveRiderAccount,
  rejectRiderAccount,
  acceptDelivery
} from "../controllers/rider.controller";
import { adminOnly } from "../middleware/admin";

const router = express.Router();

// memory storage for direct cloud upload (Cloudinary)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// 🧍 Rider Registration
router.post("/register", authMiddleware, registerRider);

// 🚘 Upload Vehicle Details
router.post(
  "/vehicle",
  authMiddleware,
  upload.fields([
    { name: "frontView", maxCount: 1 },
    { name: "backView", maxCount: 1 },
    { name: "document", maxCount: 1 },
  ]),
  uploadRiderVehicle
);

// 🪪 Upload Rider KYC
router.post(
  "/kyc/upload",
  authMiddleware,
  upload.fields([
    { name: "selfie", maxCount: 1 },
    { name: "idCard", maxCount: 1 },
    { name: "license", maxCount: 1 },
    { name: "roadWorthiness", maxCount: 1 },
  ]),
  uploadRiderKyc
);

// 👤 Get My Rider Profile
router.get("/me", authMiddleware, getMyRiderProfile);

// 🔒 Admin: Approve/Reject Rider
router.patch("/status/:id", updateRiderStatus);
router.post("/update-location", updateRiderLocation);
router.post("/accept-delivery/:deliveryId", authMiddleware, acceptDelivery);
router.post("/kyc/approve/:userId", authMiddleware, adminOnly, approveRiderKyc);
router.post("/kyc/reject/:userId", authMiddleware, adminOnly , rejectRiderKyc);

router.post("/approve/:userId", authMiddleware,adminOnly, approveRiderAccount);
router.post("/reject/:userId", authMiddleware, adminOnly, rejectRiderAccount);

// 🔌 Toggle online/offline
router.post("/toggle-online", toggleRiderOnline);

// 🗺️ Get nearby riders
router.get("/nearby", getNearbyRiders);

export default router;
