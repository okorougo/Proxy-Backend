import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import geohash from "ngeohash";
import { errorResponse, successResponse } from "../utils/response";

export const createListing = async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, priceCents, currency = "NGN", isDigital = false, lat, lng, city, region, price } = req.body;

    let locationId: string | undefined = undefined;
    if (lat && lng) {
      const gh = geohash.encode(Number(lat), Number(lng));
      const location = await prisma.location.create({
        data: { lat: Number(lat), lng: Number(lng), city, region, geohash: gh },
      });
      locationId = location.id;
    }

    const listingData: any = {
      title,
      description,
      priceCents: Number(priceCents),
      currency,
      isDigital: Boolean(isDigital),
      seller: { connect: { id: req.user!.id } },
      price,
      status: "PENDING"
    };
    if (locationId) {
      listingData.locationId = locationId;
    }

    const listing = await prisma.listing.create({
      data: listingData,
    });

    res.json({ listing });
  } catch (err) {
    console.error(err);
    return successResponse(res, "Listing creation failed");
  }
};

export const getListingById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const listing = await prisma.listing.findUnique({
      where: { id },
      include: {
        location: true,
        seller: { select: { id: true, email: true, name: true } },
        media: true,
      },
    });
    if (!listing) return errorResponse(res, "Listing not found", "LISTING_NOT_FOUND", 404);
    res.json({ listing });
  } catch (err) {
    console.error(err);
    return errorResponse(res, "Failed to retrieve listing");
  }
};
