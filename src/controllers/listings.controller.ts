import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import geohash from "ngeohash";
import { errorResponse, successResponse } from "../utils/response";
import { uploadToCloudinary } from "../lib/cloudinary";
import cloudinary from "../lib/cloudinary";

/* ==========================================================
   🟢 CREATE LISTING WITH MEDIA UPLOAD
   ========================================================== */
export const createListing = async (req: AuthRequest, res: Response) => {
  try {
    const {
      title,
      description,
      price,
      priceCents,
      currency = "NGN",
      isDigital = false,
      lat,
      lng,
      city,
      region,
      categoryId,
      condition,
      stock,
      extraDetails,
    } = req.body;

    if (!title || !description || !price) {
      return errorResponse(res, "Title, description, and price are required");
    }

    
    let parsedDetails: { title: string; description: string }[] | null = null;
    if (extraDetails) {
      try {
        parsedDetails = JSON.parse(extraDetails);
      } catch (err) {
        return errorResponse(res, "Invalid JSON format for extraDetails");
      }
    }
    let locationId: string | null = null;
    // Handle location if provided
    if (lat && lng) {
      const gh = geohash.encode(Number(lat), Number(lng));
      const location = await prisma.location.create({
        data: { lat: Number(lat), lng: Number(lng), city, region, geohash: gh },
      });
      locationId = location.id;
    }

    // Create listing record
    const listing = await prisma.listing.create({
      data: {
        title,
        description,
        price: Number(price),
        priceCents: Number(priceCents || price * 100),
        currency,
        isDigital: Boolean(isDigital),
        condition,
        stock: stock ? Number(stock) : null,
        seller: { connect: { id: req.user!.id } },
        category: { connect: { id: categoryId } },
        location: locationId ? { connect: { id: locationId } } : undefined,
        status: "PENDING",
        extraDetails: parsedDetails ?? undefined,
      },
    });

    // Handle file uploads
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    if (files && Object.keys(files).length > 0) {
      const mediaUploads = [];

      for (const field in files) {
        for (const file of files[field]) {
          const folder = isDigital ? "digital_listings" : "listing_media";
          const uploaded = await uploadToCloudinary(file.buffer, folder);
          const mimeType = file.mimetype;
          mediaUploads.push({
            url: uploaded.secure_url,
            publicId: uploaded.public_id,
            mimeType,
            size: file.size,
            listingId: listing.id,
          });
        }
      }

      if (mediaUploads.length > 0) {
        await prisma.media.createMany({ data: mediaUploads });
      }
    }

    return successResponse(res, "Listing created successfully", listing);
  } catch (err) {
    console.error("❌ createListing error:", err);
    return errorResponse(res, "Listing creation failed");
  }
};

/* ==========================================================
   🟡 UPDATE LISTING
   ========================================================== */
export const updateListing = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.listing.findUnique({ where: { id } });

    if (!existing) return errorResponse(res, "Listing not found", "LISTING_NOT_FOUND", 404);
    if (existing.sellerId !== req.user!.id) return errorResponse(res, "Unauthorized", "UNAUTHORIZED", 403);

    const updated = await prisma.listing.update({
      where: { id },
      data: req.body,
    });

    return successResponse(res, "Listing updated successfully", updated);
  } catch (err) {
    console.error("❌ updateListing error:", err);
    return errorResponse(res, "Listing update failed");
  }
};

/* ==========================================================
   🔴 DELETE LISTING & CLOUDINARY MEDIA
   ========================================================== */
export const deleteListing = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const listing = await prisma.listing.findUnique({
      where: { id },
      include: { media: true },
    });

    if (!listing) return errorResponse(res, "Listing not found");
    if (listing.sellerId !== req.user!.id) return errorResponse(res, "Unauthorized");

    // Delete associated media from Cloudinary
    for (const m of listing.media) {
      if (m.publicId) {
        try {
          await cloudinary.uploader.destroy(m.publicId, { resource_type: "auto" });
        } catch (e) {
          console.warn("Cloudinary deletion error:", e);
        }
      }
    }

    await prisma.listing.delete({ where: { id } });
    return successResponse(res, "Listing deleted successfully");
  } catch (err) {
    console.error("❌ deleteListing error:", err);
    return errorResponse(res, "Failed to delete listing");
  }
};

/* ==========================================================
   🧾 GET ALL LISTINGS BY VENDOR
   ========================================================== */
export const getAllListingsByVendor = async (req: AuthRequest, res: Response) => {
  try {
    const vendorId = req.user!.id;

    const listings = await prisma.listing.findMany({
      where: { sellerId: vendorId },
      include: {
        category: true,
        media: true,
        transactions: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return successResponse(res, "Vendor listings fetched successfully", listings);
  } catch (err) {
    console.error("❌ getAllListingsByVendor error:", err);
    return errorResponse(res, "Failed to get vendor listings");
  }
};

/* ==========================================================
   🏆 POPULAR LISTINGS
   ========================================================== */
export const getPopularListings = async (req: Request, res: Response) => {
  try {
    const listings = await prisma.listing.findMany({
      where: { status: "APPROVED" },
      include: {
        _count: { select: { transactions: true } },
        category: true,
        media: true,
      },
      orderBy: { transactions: { _count: "desc" } },
      take: 10,
    });

    return successResponse(res, "Popular listings fetched successfully", listings);
  } catch (err) {
    console.error("❌ getPopularListings error:", err);
    return errorResponse(res, "Failed to get popular listings");
  }
};

/* ==========================================================
   🆕 NEW LISTINGS
   ========================================================== */
export const getNewListings = async (req: Request, res: Response) => {
  try {
    const listings = await prisma.listing.findMany({
      where: { status: "APPROVED" },
      include: { category: true, media: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return successResponse(res, "New listings fetched successfully", listings);
  } catch (err) {
    console.error("❌ getNewListings error:", err);
    return errorResponse(res, "Failed to get new listings");
  }
};

/* ==========================================================
   🔒 DIGITAL DOWNLOAD (Verified Buyers Only)
   ========================================================== */
export const getDigitalDownload = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const transaction = await prisma.transaction.findFirst({
      where: { listingId: id, buyerId: userId, status: "COMPLETED" },
    });

    if (!transaction) {
      return errorResponse(res, "Access denied: not a verified buyer", "FORBIDDEN", 403);
    }

    const media = await prisma.media.findMany({
      where: { listingId: id },
    });

    const signedUrls = media.map((m) => ({
      mimeType: m.mimeType,
      url: cloudinary.url(m.publicId, {
        resource_type: "auto",
        sign_url: true,
        expires_at: Math.floor(Date.now() / 1000) + 60 * 10,
      }),
    }));

    return successResponse(res, "Download links generated", signedUrls);
  } catch (err) {
    console.error("❌ getDigitalDownload error:", err);
    return errorResponse(res, "Failed to generate digital download");
  }
};

/* ==========================================================
   🔍 SEARCH + FILTER LISTINGS
   ========================================================== */
export const searchListings = async (req: Request, res: Response) => {
  try {
    const {
      q,              // keyword
      minPrice,
      maxPrice,
      categoryId,
      condition,
      sortBy,
      order = "desc",
      lat,
      lng,
      radiusKm = "20", // default 20km radius
    } = req.query as Record<string, string>;

    const where: any = { status: "APPROVED" };

    // 🔍 Keyword Search (title or description)
    if (q) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ];
    }

    // 💰 Price Range
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = Number(minPrice);
      if (maxPrice) where.price.lte = Number(maxPrice);
    }

    // 🏷️ Category Filter
    if (categoryId) where.categoryId = categoryId;

    // 📦 Condition Filter
    if (condition) where.condition = { equals: condition, mode: "insensitive" };

    // 📍 GEO Filter (optional)
    let nearbyListingIds: string[] = [];
    if (lat && lng) {
      const radius = Number(radiusKm);
      const neighbors = geohash.neighbors(geohash.encode(Number(lat), Number(lng)));
      const centerHash = geohash.encode(Number(lat), Number(lng));
      const allHashes = [centerHash, ...neighbors];

      // Find nearby locations based on geohash prefix match
      const nearbyLocations = await prisma.location.findMany({
        where: {
          geohash: { in: allHashes },
        },
        select: { id: true },
      });

      if (nearbyLocations.length > 0) {
        nearbyListingIds = (
          await prisma.listing.findMany({
            where: {
              locationId: { in: nearbyLocations.map((l) => l.id) },
              status: "APPROVED",
            },
            select: { id: true },
          })
        ).map((l) => l.id);

        where.id = { in: nearbyListingIds };
      }
    }

    // 🧮 Sorting
    let orderBy: any = { createdAt: order };
    if (sortBy === "price") orderBy = { price: order };
    if (sortBy === "popularity") orderBy = { transactions: { _count: order } };

    // ✅ Fetch Listings
    const listings = await prisma.listing.findMany({
      where,
      include: {
        category: true,
        location: true,
        media: true,
        seller: { select: { id: true, name: true, email: true } },
        _count: { select: { transactions: true } },
      },
      orderBy,
      take: 50,
    });

    return successResponse(res, "Listings fetched successfully", listings);
  } catch (err) {
    console.error("❌ searchListings error:", err);
    return errorResponse(res, "Failed to search listings");
  }
};
