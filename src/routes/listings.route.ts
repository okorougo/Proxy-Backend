import { Router } from "express";
import { createListing,deleteListing, getAllListingsByVendor, getPopularListings,getNewListings, getDigitalDownload, updateListing, searchListings } from "../controllers/listings.controller";
import { authMiddleware } from "../middleware/auth";
import multer from "multer";

const storage = multer.memoryStorage();
export const upload = multer({ storage });

const router = Router();

router.post(
  "/create",
  authMiddleware,
  upload.fields([
    { name: "image", maxCount: 5 },   // allow multiple images
    { name: "video", maxCount: 1 },   // optional video
    { name: "pdf", maxCount: 3 }      // optional for digital goods
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

export default router;
