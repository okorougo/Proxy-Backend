import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import geohash from "ngeohash";
import { errorResponse, successResponse } from "../utils/response";
import { deleteFromCloudinary, uploadToCloudinary } from "../lib/cloudinary";
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
      categoryId,
      subCategoryId, // ← new
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
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category) return errorResponse(res, "Category not found");

    // Validate sub-category if provided
    if (subCategoryId) {
      const subCategory = await prisma.subCategory.findUnique({
        where: { id: subCategoryId },
      });
      if (!subCategory) return errorResponse(res, "Sub-category not found");
      if (subCategory.categoryId !== categoryId) {
        return errorResponse(
          res,
          "Sub-category does not belong to the selected category"
        );
      }
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
        subCategory: subCategoryId
          ? { connect: { id: subCategoryId } }
          : undefined,
        status: "PENDING",
        extraDetails: parsedDetails ?? undefined,
      },
    });

    // Handle file uploads
    // Files are in memory via multer; types:
    // req.files: { [fieldname: string]: Express.Multer.File[] }
    const files = req.files as
      | { [fieldname: string]: Express.Multer.File[] }
      | undefined;

    // Upload media (images/videos) -> saves to Media table
    if (files?.media && files.media.length > 0) {
      const mediaCreates = [];
      for (const f of files.media) {
        const uploaded = await uploadToCloudinary(f.buffer, "listings/media");
        mediaCreates.push({
          url: uploaded.secure_url,
          publicId: uploaded.public_id,
          mimeType: f.mimetype,
          size: f.size,
          listingId: listing.id,
        });
      }
      if (mediaCreates.length > 0) {
        // createMany will not return ids; we just persist
        await prisma.media.createMany({ data: mediaCreates });
      }
    }

    // Upload digital files (for digital listings) -> also Media table
    if (files?.digitalFiles && files.digitalFiles.length > 0) {
      const digitalCreates = [];
      for (const f of files.digitalFiles) {
        const uploaded = await uploadToCloudinary(f.buffer, "listings/digital");
        digitalCreates.push({
          url: uploaded.secure_url,
          publicId: uploaded.public_id,
          mimeType: f.mimetype,
          size: f.size,
          listingId: listing.id,
        });
      }
      if (digitalCreates.length > 0) {
        await prisma.media.createMany({ data: digitalCreates });
      }
    }

    // Return the created listing with media & category
    const created = await prisma.listing.findUnique({
      where: { id: listing.id },
      include: { media: true, category: true },
    });

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
    const {
      title,
      description,
      price,
      priceCents,
      currency,
      isDigital,
      categoryId,
      subCategoryId, // ← new
      condition,
      stock,
      extraDetails,
      replaceMedia, // boolean to indicate whether to replace old media
    } = req.body;

    const existing = await prisma.listing.findUnique({
      where: { id },
      include: { media: true },
    });

    if (!existing)
      return errorResponse(res, "Listing not found", "LISTING_NOT_FOUND", 404);
    if (existing.sellerId !== req.user!.id)
      return errorResponse(res, "Unauthorized", "UNAUTHORIZED", 403);

    // Parse extraDetails safely
    let parsedDetails: { title: string; description: string }[] | null = null;
    if (extraDetails) {
      try {
        parsedDetails = JSON.parse(extraDetails);
      } catch (err) {
        return errorResponse(res, "Invalid JSON format for extraDetails");
      }
    }

    // Prepare fields to update (only provided ones)
    const dataToUpdate: any = {};
    if (title) dataToUpdate.title = title;
    if (description) dataToUpdate.description = description;
    if (price) {
      dataToUpdate.price = Number(price);
      dataToUpdate.priceCents = Number(priceCents || price * 100);
    }
    if (currency) dataToUpdate.currency = currency;
    if (condition) dataToUpdate.condition = condition;
    if (stock !== undefined) dataToUpdate.stock = Number(stock);
    if (typeof isDigital !== "undefined")
      dataToUpdate.isDigital = Boolean(isDigital);
    if (parsedDetails) dataToUpdate.extraDetails = parsedDetails;
    if (categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: categoryId },
      });
      if (!category) return errorResponse(res, "Category not found");
      dataToUpdate.category = { connect: { id: categoryId } };
    }

    // Validate sub-category if provided
    if (subCategoryId) {
      const subCategory = await prisma.subCategory.findUnique({
        where: { id: subCategoryId },
      });
      if (!subCategory) return errorResponse(res, "Sub-category not found");
      const parentIdToCheck = categoryId || existing.categoryId;
      if (subCategory.categoryId !== parentIdToCheck) {
        return errorResponse(
          res,
          "Sub-category does not belong to the selected category"
        );
      }
      dataToUpdate.subCategory = { connect: { id: subCategoryId } };
    }

    // Handle file uploads
    const files = req.files as
      | { [fieldname: string]: Express.Multer.File[] }
      | undefined;

    // 🟡 Replace or add new media
    if (files?.media && files.media.length > 0) {
      // If replaceMedia=true, remove old media first
      if (replaceMedia === "true" || replaceMedia === true) {
        for (const old of existing.media) {
          try {
            await deleteFromCloudinary(old.publicId);
          } catch (err) {
            console.warn("Failed to delete old media:", old.publicId);
          }
        }
        await prisma.media.deleteMany({ where: { listingId: id } });
      }

      // Upload new media
      const newMedia = [];
      for (const f of files.media) {
        const uploaded = await uploadToCloudinary(f.buffer, "listings/media");
        newMedia.push({
          url: uploaded.secure_url,
          publicId: uploaded.public_id,
          mimeType: f.mimetype,
          size: f.size,
          listingId: id,
        });
      }
      if (newMedia.length > 0) {
        await prisma.media.createMany({ data: newMedia });
      }
    }

    // 🟢 Update listing record
    const updated = await prisma.listing.update({
      where: { id },
      data: dataToUpdate,
      include: { media: true, category: true,subCategory: true  },
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
    if (listing.sellerId !== req.user!.id)
      return errorResponse(res, "Unauthorized");

    // Delete associated media from Cloudinary
    for (const m of listing.media) {
      if (m.publicId) {
        try {
          await cloudinary.uploader.destroy(m.publicId, {
            resource_type: "auto",
          });
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
export const getAllListingsByVendor = async (
  req: AuthRequest,
  res: Response
) => {
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

    return successResponse(
      res,
      "Vendor listings fetched successfully",
      listings
    );
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
      where: {
        status: "APPROVED",
      },
      include: {
        category: true,
        media: true,
        seller: {
          include: {
            kycDocument: true,
            vendorApplication: {
              include: { location: true },
            },
            Session: true,
          },
        },
        _count: {
          select: { transactions: true },
        },
      },
      orderBy: {
        transactions: {
          _count: "desc",
        },
      },
      take: 15, // top 15 popular listings
    });

    return successResponse(
      res,
      "Popular listings fetched successfully",
      listings
    );
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
      include: {
        category: true,
        media: true,
        seller: {
          include: {
            kycDocument: true,
            vendorApplication: {
              include: { location: true },
            },
            Session: true,
          },
        },
      },
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
      return errorResponse(
        res,
        "Access denied: not a verified buyer",
        "FORBIDDEN",
        403
      );
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
      q, // keyword
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

    // 📍 GEO Filter based on vendor location (optional)
    if (lat && lng) {
      const radius = Number(radiusKm);
      const earth = 6371; // Earth's radius in km
      const latNum = Number(lat);
      const lngNum = Number(lng);

      // Use parameterized query to avoid injection and use WHERE instead of HAVING.
      const nearbyListings = await prisma.$queryRaw`
        WITH nearby_vendors AS (
          SELECT
            va.id AS vendor_id,
            va."userId" AS vendor_user_id,
            (${earth} * acos(
              cos(radians(${latNum})) * cos(radians(l.lat)) *
              cos(radians(l.lng) - radians(${lngNum})) +
              sin(radians(${latNum})) * sin(radians(l.lat))
            )) AS distance_km
          FROM "Location" l
          JOIN "VendorApplication" va ON va.id = l."vendorId"
          WHERE va.status = 'APPROVED'
            AND (${earth} * acos(
              cos(radians(${latNum})) * cos(radians(l.lat)) *
              cos(radians(l.lng) - radians(${lngNum})) +
              sin(radians(${latNum})) * sin(radians(l.lat))
            )) <= ${radius}
        )
        SELECT listing.id
        FROM "Listing" listing
        JOIN nearby_vendors nv ON listing."sellerId" = nv.vendor_user_id
        WHERE listing.status = 'APPROVED'
        -- optional: order by proximity
        ORDER BY nv.distance_km ASC
        LIMIT 100;
      `;

      const listingIds = (nearbyListings as any[]).map((r) => r.id);
      if (listingIds.length > 0) {
        where.id = { in: listingIds };
      } else {
        // No nearby listings — return empty early
        return successResponse(res, "Listings fetched successfully", []);
      }
    }

    // 🧮 Sorting
    let orderBy: any = { createdAt: order as "asc" | "desc" };
    if (sortBy === "price") orderBy = { price: order as "asc" | "desc" };
    if (sortBy === "popularity")
      orderBy = { transactions: { _count: order as "asc" | "desc" } };

    // ✅ Fetch Listings
    const listings = await prisma.listing.findMany({
      where,
      include: {
        category: true,
        media: true,
        seller: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            kycDocument: true,
            Session: true,
            vendorApplication: {
              include: {
                location: true,
              },
            },
          },
        },
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

export const getListingsByCategory = async (req: Request, res: Response) => {
  try {
    const { categoryId, limit = "10", cursor } = req.query;

    if (!categoryId) return errorResponse(res, "categoryId is required");

    const pageSize = parseInt(limit as string, 10);

    const listings = await prisma.listing.findMany({
      where: { categoryId: categoryId as string, status: "APPROVED" },
      include: {
        media: true,
        seller: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            kycDocument: true,
            Session: true,
            vendorApplication: {
              include: { location: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: pageSize,
      skip: cursor ? 1 : 0, // Skip the cursor item itself
      cursor: cursor ? { id: cursor as string } : undefined,
    });

    const nextCursor =
      listings.length === pageSize ? listings[listings.length - 1].id : null;

    return successResponse(res, "Listings fetched successfully", {
      listings,
      nextCursor,
    });
  } catch (err) {
    console.error("getListingsByCategory error:", err);
    return errorResponse(res, "Failed to fetch listings by category");
  }
};
export const getUserOrders = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return errorResponse(res, "Unauthorized", "UNAUTHORIZED", 401);

    const orders = await prisma.order.findMany({
      where: { userId },
      include: {
        user: true,
        vendor: {
          include: {
            location: true,
            user: {
              include: { kycDocument: true },
            },
          },
        },
        listings: {
          include: {
            listing: {
              include: { media: true, category: true },
            },
          },
        },
        transaction: true,
        delivery: {
          include: {
            rider: {
              include: {
                kyc: true,
                vehicle: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!orders || orders.length === 0) {
      return successResponse(res, "No orders found", []);
    }

    const formatted = orders.map((order) => {
      let digitalFiles: any[] = [];

      if (order.isDigital) {
        // ✅ Get files directly from listing.media for digital listings
        digitalFiles = order.listings.flatMap((item) =>
          item.listing.media.map((file) => ({
            id: file.id,
            name: file.publicId || file.url.split("/").pop(),
            url: file.url,
          }))
        );
      } else if (order.delivery?.isDigital && order.delivery.digitalFiles) {
        // ✅ Fallback for legacy digital deliveries with stored JSON files
        try {
          const parsed =
            typeof order.delivery.digitalFiles === "string"
              ? JSON.parse(order.delivery.digitalFiles)
              : order.delivery.digitalFiles;
          if (Array.isArray(parsed)) {
            digitalFiles = parsed.map((f: any) => ({
              id: f.id,
              name: f.name,
              url: f.url,
            }));
          }
        } catch (err) {
          console.error("Error parsing digitalFiles JSON:", err);
        }
      }

      return {
        id: order.id,
        vendor: {
          id: order.vendor.id,
          name: order.vendor.user.name,
          email: order.vendor.user.email,
          image: order.vendor.user.kycDocument || null,
        },
        totalAmount: order.totalAmount,
        status: order.status,
        isDigital: order.isDigital,
        transaction: {
          id: order.transaction?.id,
          amountPaid: order.transaction?.amountPaid,
          status: order.transaction?.status,
          reference: order.transaction?.paystackRef,
        },
        delivery: order.delivery
          ? {
              id: order.delivery.id,
              status: order.delivery.status,
              fareAmount: order.delivery.fareAmount,
              isDigital: order.delivery.isDigital,
              digitalFiles,
              pickupLat: order.delivery.pickupLat,
              pickupLng: order.delivery.pickupLng,
              dropoffLat: order.delivery.dropoffLat,
              dropoffLng: order.delivery.dropoffLng,
              pickupAddress: order.delivery.pickupAddress,
              dropoffAddress: order.delivery.dropoffAddress,
              rider: order.delivery.rider,
              otp: order.delivery.OTP,
            }
          : null,
        listings: order.listings.map((item) => ({
          id: item.id,
          title: item.listing.title,
          price: item.unitPrice,
          quantity: item.quantity,
          image: item.listing.media?.[0]?.url || null,
          category: item.listing.category?.name || "Uncategorized",
        })),
        digitalFiles, // ✅ Include digital files directly for digital listings
        createdAt: order.createdAt,
      };
    });

    return successResponse(res, "User orders fetched successfully", formatted);
  } catch (error) {
    console.error("❌ getUserOrders error:", error);
    return errorResponse(res, "Failed to fetch user orders");
  }
};
export const getListingById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return errorResponse(res, "Listing ID is required", "ID_REQUIRED", 400);
    }

    const listing = await prisma.listing.findUnique({
      where: { id },
      include: {
        media: true,
        category: true,
        seller: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            vendorApplication: {
              include: { location: true },
            },
          },
        },
        _count: {
          select: { transactions: true },
        },
      },
    });

    if (!listing) {
      return errorResponse(res, "Listing not found", "LISTING_NOT_FOUND", 404);
    }

    return successResponse(res, "Listing fetched successfully", listing);
  } catch (err) {
    console.error("❌ getListingById error:", err);
    return errorResponse(res, "Failed to fetch listing", "SERVER_ERROR", 500);
  }
};
