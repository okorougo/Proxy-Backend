import { Router } from "express";
import multer from "multer";
import {
  uploadKycDocument,
  verifyKyc,
  verifyNinNumber,
  searchNinByPhone,
  searchNinByDemography,
  checkVerificationBalance,
} from "../controllers/kyc.controller";
import { authMiddleware } from "../middleware/auth";
import { submitKyc } from "../controllers/kyc.controller";

const upload = multer({ storage: multer.memoryStorage() });

const router = Router();

// User uploads KYC doc
router.post("/upload", authMiddleware, uploadKycDocument);
router.post(
  "/submit",
  authMiddleware,
  upload.fields([
    { name: "selfie", maxCount: 1 },
    { name: "idCard", maxCount: 1 },
  ]),
  submitKyc
);

// Admin verifies/rejects
router.post("/verify", authMiddleware, verifyKyc);

// NIN Verification endpoints
router.post("/verify-nin", verifyNinNumber);
router.post("/search-nin-phone", searchNinByPhone);
router.post("/search-nin-demography", searchNinByDemography);


// Check balance endpoint (admin only)
router.get("/verify-balance", authMiddleware, checkVerificationBalance);

export default router;
