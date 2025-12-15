import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { errorResponse, successResponse } from "../utils/response";
import dotenv from 'dotenv';
dotenv.config();

export const searchByRadius = async (req: Request, res: Response) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const radiusKm = Number(req.query.radiusKm || 10);
    const limit = Number(req.query.limit || 50);

    if (isNaN(lat) || isNaN(lng)) return errorResponse(res, "Invalid latitude or longitude", "INVALID_COORDINATES", 400);

    const earth = 6371;
    const sql = `
      SELECT l.*, loc.lat as "lat", loc.lng as "lng",
        (${earth} * acos(
          cos(radians($1)) * cos(radians(loc.lat)) *
          cos(radians(loc.lng) - radians($2)) +
          sin(radians($1)) * sin(radians(loc.lat))
        )) AS distance_km
      FROM "Listing" l
      JOIN "User" u ON u.id = l."sellerId"
      JOIN "VendorApplication" va ON va."userId" = u.id
      JOIN "Location" loc ON loc.id = va."locationId"
      WHERE l."status" = 'ACTIVE'
        AND va."status" = 'APPROVED'
      HAVING (${earth} * acos(
          cos(radians($1)) * cos(radians(loc.lat)) *
          cos(radians(loc.lng) - radians($2)) +
          sin(radians($1)) * sin(radians(loc.lat))
        )) <= $3
      ORDER BY distance_km
      LIMIT $4;
    `;

    const results = await prisma.$queryRawUnsafe(sql, lat, lng, radiusKm, limit);
    return successResponse(res, "Search completed successfully", results);
  } catch (err) {
    console.error(err);
    return errorResponse(res, "Search by radius failed");
  }
};
export const searchListings = async (req: Request, res: Response) => {
  try {
    const { q, category, minPrice, maxPrice, limit = 20, skip = 0 } = req.query;

    const filters: any = { status: "ACTIVE" };

    // Full-text LIKE fallback
    if (q) {
      filters.OR = [
        { title: { contains: String(q), mode: "insensitive" } },
        { description: { contains: String(q), mode: "insensitive" } },
      ];
    }

    if (category) {
      filters.category = { equals: String(category), mode: "insensitive" };
    }

    if (minPrice || maxPrice) {
      filters.priceCents = {};
      if (minPrice) filters.priceCents.gte = Number(minPrice);
      if (maxPrice) filters.priceCents.lte = Number(maxPrice);
    }

    const listings = await prisma.listing.findMany({
      where: filters,
      include: {
        seller: {
          select: {
            id: true,
            name: true,
            vendorApplication: {
              select: {
                location: true
              }
            }
          }
        },
        media: true,
      },
      skip: Number(skip),
      take: Number(limit),
      orderBy: { createdAt: "desc" },
    });

    return successResponse(res, "Search completed successfully", listings);
  } catch (err) {
    console.error(err);
    return errorResponse(res, "Search listings failed");
  }
};
const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY;



export const autocompleteLocation = async (req: Request, res: Response) => {
  try {
    const input = req.query.input;

    if (!input || typeof input !== 'string') {
      return errorResponse(
        res,
        "Input query parameter is required",
        "MISSING_INPUT",
        400
      );
    }

    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
      input
    )}&components=country:ng&types=address&key=${GOOGLE_KEY}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    const data = await response.json();

    if (data.status !== "OK") {
      return errorResponse(
        res,
        data.error_message || "Google Places API error",
        data.status,
        502
      );
    }

    const predictions = data.predictions.map((p: any) => ({
      placeId: p.place_id,
      description: p.description,
    }));

    return successResponse(res, "Autocomplete successful", predictions);
  } catch (err: any) {
    console.error("Autocomplete error:", err);

    if (err.name === "AbortError") {
      return errorResponse(res, "Google request timed out", "TIMEOUT", 504);
    }

    return errorResponse(res, "Autocomplete location failed");
  }
};

export const getLocationDetails = async (req: Request, res: Response) => {
  try {
    const placeId = req.query.placeId;

    if (!placeId || typeof placeId !== 'string') {
      return errorResponse(
        res,
        "placeId query parameter is required",
        "MISSING_PLACE_ID",
        400
      );
    }

    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
      placeId
    )}&fields=geometry,formatted_address&key=${GOOGLE_KEY}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    const data = await response.json();

    if (data.status !== "OK") {
      return errorResponse(
        res,
        data.error_message || "Google Places API error",
        data.status,
        502
      );
    }

    const location = data.result.geometry.location;

    return successResponse(res, "Location details retrieved successfully", {
      latitude: location.lat,
      longitude: location.lng,
      address: data.result.formatted_address,
    });
  } catch (err: any) {
    console.error("Place details error:", err);

    if (err.name === "AbortError") {
      return errorResponse(res, "Google request timed out", "TIMEOUT", 504);
    }

    return errorResponse(res, "Get location details failed");
  }
};

export const getDirections = async (req: Request, res: Response) => {
  try {
    const { originLat, originLng, destLat, destLng } = req.query;
    if (
      !originLat || isNaN(Number(originLat)) ||
      !originLng || isNaN(Number(originLng)) ||
      !destLat || isNaN(Number(destLat)) ||
      !destLng || isNaN(Number(destLng))
    ) {
      return errorResponse(
        res,
        "Invalid or missing origin/destination coordinates",
        "INVALID_COORDINATES",
        400
      );
    }
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originLat},${originLng}&destination=${destLat},${destLng}&key=${GOOGLE_KEY}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    const data = await response.json();

    if (data.status !== "OK") {
      return errorResponse(
        res,
        data.error_message || "Google Directions API error",
        data.status,
        502
      );
    }
    const route = data.routes[0];

    return successResponse(res, "Directions retrieved successfully", route);
  } catch (err: any) {
    console.error("Get directions error:", err);

    if (err.name === "AbortError") {
      return errorResponse(res, "Google request timed out", "TIMEOUT", 504);
    }

    return errorResponse(res, "Get directions failed");
  }
};

