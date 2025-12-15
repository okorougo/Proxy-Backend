import { Router } from "express";
import { autocompleteLocation, getLocationDetails, searchByRadius,searchListings } from "../controllers/search.controller";


const router = Router();

router.get("/radius", searchByRadius);
router.get("/", searchListings);
router.get("/autocomplete", autocompleteLocation);
router.get("/details", getLocationDetails);

export default router;
