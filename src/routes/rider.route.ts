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
  getNearbyRiders
} from "../controllers/rider.controller";

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

// 🔌 Toggle online/offline
router.post("/toggle-online", toggleRiderOnline);

// 🗺️ Get nearby riders
router.get("/nearby", getNearbyRiders);

export default router;
