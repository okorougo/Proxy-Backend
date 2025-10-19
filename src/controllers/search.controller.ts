import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { errorResponse, successResponse } from "../utils/response";

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
      JOIN "Location" loc ON loc.id = l."locationId"
      WHERE l."status" = 'ACTIVE'
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
        seller: { select: { id: true, name: true } },
        location: true,
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
