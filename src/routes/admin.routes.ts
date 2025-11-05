import { Router } from "express";
import { getDashboardStats, listKycRequests, updateKycStatus, listReports, resolveReport, listUsers, banUser, unbanUser, updateUserRole,listAllListings, approveListing, rejectListing, removeListing, createCategory, getCategories, updateCategory, deleteCategory, adminLogin, getRiderMonthlyStats, getSingleRider, getRiderDashboardStats, getAllRiders, getSingleUser} from "../controllers/admin.controller";
import multer from "multer";
import { authMiddleware } from "../middleware/auth";
import { adminOnly, modOrAdmin } from "../middleware/admin";
const upload = multer({ storage: multer.memoryStorage() });

const router = Router();
router.post("/login", adminLogin);
// Dashboard stats
router.get("/dashboard", authMiddleware, adminOnly, getDashboardStats);
router.get("/rider-stats", getRiderDashboardStats);

// 📋 All Riders
router.get("/riders", getAllRiders);

router.get("/single-rider/:id", getSingleRider)
router.get("/single-user/:id", getSingleUser)

// 📈 Monthly Stats
router.get("/rider-analytics/monthly", getRiderMonthlyStats);

// KYC management
router.get("/kyc", authMiddleware, modOrAdmin, listKycRequests);
router.post("/kyc/status", authMiddleware, adminOnly, updateKycStatus);

// Reports
router.get("/reports", authMiddleware, modOrAdmin, listReports);
router.post("/reports/resolve", authMiddleware, adminOnly, resolveReport);
router.get("/users", authMiddleware, adminOnly, listUsers);
router.post("/ban/:userId", authMiddleware, adminOnly, banUser);
router.post("/unban/:userId", authMiddleware, adminOnly, unbanUser);
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
