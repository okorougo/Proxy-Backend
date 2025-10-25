import { Router } from "express";
import { createListing,deleteListing, getAllListingsByVendor, getPopularListings,getNewListings, getDigitalDownload, updateListing } from "../controllers/listings.controller";
import { authMiddleware } from "../middleware/auth";
import multer from "multer";

const storage = multer.memoryStorage();
export const upload = multer({ storage });

const router = Router();

router.post("/", authMiddleware, createListing);
router.put("/update/:id", authMiddleware, updateListing);
router.delete("/delete/:id", authMiddleware, deleteListing);
router.get("/vendor", authMiddleware, getAllListingsByVendor);
router.get("/popular", getPopularListings);
router.get("/new", getNewListings);
router.get("/download/:id", authMiddleware, getDigitalDownload);

export default router;
