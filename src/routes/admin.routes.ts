import { Router } from "express";
import { getDashboardStats, listKycRequests, updateKycStatus, listReports, resolveReport, listUsers, banUser, unbanUser, updateUserRole,listAllListings, approveListing, rejectListing, removeListing, createCategory, getCategories, updateCategory, deleteCategory} from "../controllers/admin.controller";
import multer from "multer";
import { authMiddleware } from "../middleware/auth";
import { adminOnly, modOrAdmin } from "../middleware/admin";
const upload = multer({ storage: multer.memoryStorage() });

const router = Router();

// Dashboard stats
router.get("/dashboard", authMiddleware, adminOnly, getDashboardStats);

// KYC management
router.get("/kyc", authMiddleware, modOrAdmin, listKycRequests);
router.post("/kyc/status", authMiddleware, adminOnly, updateKycStatus);

// Reports
router.get("/reports", authMiddleware, modOrAdmin, listReports);
router.post("/reports/resolve", authMiddleware, adminOnly, resolveReport);
router.get("/", authMiddleware, adminOnly, listUsers);
router.post("/ban", authMiddleware, adminOnly, banUser);
router.post("/unban", authMiddleware, adminOnly, unbanUser);
router.post("/role", authMiddleware, adminOnly, updateUserRole);
router.get("/", authMiddleware, modOrAdmin, listAllListings);

// Approve, Reject, Remove
router.post("/approve", authMiddleware, adminOnly, approveListing);
router.post("/reject", authMiddleware, modOrAdmin, rejectListing);
router.post("/remove", authMiddleware, adminOnly, removeListing);

// Add category
router.post("/add-category", authMiddleware,adminOnly,upload.single("image"), createCategory)
router.get("/get-category", getCategories);
router.put("/edit-category/:id", authMiddleware, upload.single("image"), updateCategory);
router.delete("/delete-category/:id", authMiddleware, deleteCategory);

export default router;
