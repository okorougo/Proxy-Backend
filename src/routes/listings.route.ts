import { Router } from "express";
import { createListing,deleteListing, getAllListingsByVendor, getPopularListings,getNewListings, getDigitalDownload, updateListing, searchListings, getListingsByCategory, getUserOrders, getListingById } from "../controllers/listings.controller";
import { authMiddleware } from "../middleware/auth";
import multer from "multer";

const storage = multer.memoryStorage();
export const upload = multer({ storage });

const router = Router();

router.post(
  "/create",
  authMiddleware,
  upload.fields([
    { name: "media", maxCount: 10 },       // images/videos from frontend
    { name: "digitalFiles", maxCount: 5 }, // pdfs/zip for digital listings
  ]),
  createListing
);
router.put("/update/:id", authMiddleware, updateListing);
router.delete("/delete/:id", authMiddleware, deleteListing);
router.get("/vendor", authMiddleware, getAllListingsByVendor);
router.get("/popular", getPopularListings);
router.get("/new", getNewListings);
router.get("/download/:id", authMiddleware, getDigitalDownload);
router.get("/search", searchListings);
router.get("/search-category", getListingsByCategory);
router.get("/get-user-order", authMiddleware, getUserOrders);
router.get("/listing/:id", getListingById);

export default router;
