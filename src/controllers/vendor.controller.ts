import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { sendEmail } from "../services/emailService";
import { errorResponse, successResponse } from "../utils/response";
import { AuthRequest } from "../middleware/auth";
import geohash from "ngeohash";
import { generateSignedDownloadUrl } from "../lib/cloudinary";

function generateGeohash(
  latitude: number,
  longitude: number,
  precision: number = 9
): string {
  // Validate coordinates
  if (latitude < -90 || latitude > 90) {
    throw new Error("Invalid latitude");
  }
  if (longitude < -180 || longitude > 180) {
    throw new Error("Invalid longitude");
  }
  return geohash.encode(latitude, longitude, precision);
}

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const R = 6371; // Earth radius in km
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // distance in km
}

// User applies to become vendor
export const applyVendor = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { description } = req.body;

    const existing = await prisma.vendorApplication.findUnique({
      where: { userId },
    });
    if (existing) {
      return errorResponse(res, "You have already applied to become a vendor");
      return;
    }
    const app = await prisma.vendorApplication.create({
      data: { userId: userId as string, description, status: "PENDING" },
    });

    return successResponse(
      res,
      "Vendor application submitted successfully",
      app
    );
  } catch (err) {
    console.error(err);
    return errorResponse(res, "Failed to submit vendor application");
  }
};

// Admin approves vendor
export const approveVendor = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const app = await prisma.vendorApplication.update({
      where: { id },
      data: { status: "APPROVED" },
      include: { user: true },
    });

    // Upgrade user role to VENDOR
    await prisma.user.update({
      where: { id: app.userId },
      data: { role: "VENDOR" },
    });

    // Notify user
    const html = `
      <div style="font-family:sans-serif">
        <h2>🎉 Vendor Access Granted!</h2>
        <p>Hello ${app.user.name || ""},</p>
        <p>Your request to become a vendor has been approved.</p>
        <p>You can now post your own listings and start selling.</p>
      </div>
    `;
    await sendEmail(app.user.email, "Vendor Access Granted", html);

    return successResponse(res, "Vendor approved successfully", app);
  } catch (err) {
    console.error(err);
    return errorResponse(res, "Failed to approve vendor");
  }
};

// Admin rejects vendor
export const rejectVendor = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    const app = await prisma.vendorApplication.update({
      where: { id },
      data: { status: "REJECTED", rejectionNote: note },
      include: { user: true },
    });

    const html = `
      <div style="font-family:sans-serif">
        <h2>⚠️ Vendor Request Rejected</h2>
        <p>Hello ${app.user.name || ""},</p>
        <p>Unfortunately, your vendor request has been rejected at this time.</p>
        ${note ? `<p><b>Reason:</b> ${note}</p>` : ""}
        <p>You can try again after updating your profile or KYC details.</p>
      </div>
    `;
    await sendEmail(app.user.email, "Vendor Application Rejected", html);

    return successResponse(res, "Vendor rejected successfully", app);
  } catch (err) {
    console.error(err);
    return errorResponse(res, "Failed to reject vendor");
  }
};

export const getAllVendorApplications = async (req: Request, res: Response) => {
  try {
    const applications = await prisma.vendorApplication.findMany({
      include: { user: true },
      orderBy: { createdAt: "desc" },
    });
    return successResponse(
      res,
      "Vendor applications fetched successfully",
      applications
    );
  } catch (err) {
    console.error(err);
    return errorResponse(res, "Failed to fetch vendor applications");
  }
};

export const addeVendorLocation = async (req: Request, res: Response) => {
  try {
    const { address, lat, lng, city, country, userId } = req.body;
    if (!userId) {
      return errorResponse(res, "Unauthorized");
    }
    // convert to numbers
    const latitude = Number(lat);
    const longitude = Number(lng);
    const geohash = generateGeohash(latitude, longitude);

    const location = await prisma.location.create({
      data: {
        Address: address,
        lat: latitude,
        lng: longitude,
        city,
        country,
        geohash,
        vendorId: userId,
      },
    });
    return successResponse(res, "Vendor location added successfully", location);
  } catch (error) {
    console.error(error);
    return errorResponse(res, "Failed to add vendor location");
  }
};

export const createDelivery = async (req: AuthRequest, res: Response) => {
  try {
    const { transactionId, dropoffAddress, dropoffLat, dropoffLng } = req.body;

    if (!transactionId) {
      return res.status(400).json({ message: "Transaction ID is required" });
    }

    // ✅ Fetch transaction and related listing + seller (vendor)
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        listing: {
          include: {
            seller: {
              include: {
                vendorApplication: true,
              },
            },
            media: true,
          },
        },
      },
    });

    if (!transaction)
      return res.status(404).json({ message: "Transaction not found" });

    const listing = transaction.listing;
    if (!listing) return res.status(404).json({ message: "Listing not found" });

    // ✅ If digital listing, skip physical delivery
    if (listing.isDigital) {
      // Generate signed download URLs for the buyer (for each digital media)
      const signedDownloads = await Promise.all(
        listing.media.map(async (file) => {
          return {
            id: file.id,
            name: file.publicId,
            url: await generateSignedDownloadUrl(file.publicId),
          };
        })
      );

      // Mark digital delivery as "COMPLETED" immediately
      const digitalDelivery = await prisma.delivery.create({
        data: {
          transactionId,
          pickupAddress: "Digital Delivery",
          pickupLat: 0,
          pickupLng: 0,
          dropoffAddress: "Digital File",
          dropoffLat: 0,
          dropoffLng: 0,
          distanceKm: 0,
          fareAmount: 0,
          status: "DELIVERED",
          isDigital: true,
          digitalFiles: JSON.stringify(signedDownloads),
        },
      });

      return res.status(200).json({
        message: "Digital delivery completed successfully",
        digitalDelivery,
      });
    }

    // ✅ If physical listing, calculate fare based on vendor → buyer distance
    if (!dropoffAddress || !dropoffLat || !dropoffLng) {
      return res
        .status(400)
        .json({ message: "Dropoff details required for physical delivery" });
    }

    const vendor = listing.seller;
    if (!vendor || !vendor.vendorApplication) {
      return res.status(404).json({ message: "Vendor location not found" });
    }

    // Replace with your vendor address/lat/lng storage source

    const vendorLocation = await prisma.location.findUnique({
      where: { vendorId: vendor.id },
    });

    if (!vendorLocation) {
      return res.status(404).json({ message: "Vendor location not found" });
    }

    const pickupAddress = vendorLocation.Address || "Vendor Address";
    const pickupLat = vendorLocation.lat; // vendor location latitude
    const pickupLng = vendorLocation.lng;

    // 🧮 Compute distance and fare
    const distanceKm = haversineDistance(
      pickupLat,
      pickupLng,
      dropoffLat,
      dropoffLng
    );

    const BASE_FARE = 400;
    const RATE_PER_KM = 120;
    const SERVICE_FEE = 100;
    const fareAmount = Math.round(
      BASE_FARE + distanceKm * RATE_PER_KM + SERVICE_FEE
    );

    // 🚚 Create delivery
    const delivery = await prisma.delivery.create({
      data: {
        transactionId,
        pickupAddress,
        pickupLat,
        pickupLng,
        dropoffAddress,
        dropoffLat,
        dropoffLng,
        distanceKm,
        fareAmount,
        status: "PENDING",
        isDigital: false,
      },
    });

    return res.status(201).json({
      message: "Physical delivery created successfully",
      delivery,
    });
  } catch (error) {
    console.error("❌ createDelivery error:", error);
    return res.status(500).json({ message: "Error creating delivery" });
  }
};

export const getVendorDashboardStats = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const vendorId = req.user?.id;
    if (!vendorId)
      return errorResponse(res, "Unauthorized", "UNAUTHORIZED", 401);

    // 1️⃣ Running Orders (active deliveries)
    const runningOrders = await prisma.transaction.count({
      where: {
        sellerId: vendorId,
        status: "PENDING",
      },
    });

    // 2️⃣ Order Requests (awaiting confirmation or not yet processed)
    const orderRequests = await prisma.transaction.count({
      where: {
        sellerId: vendorId,
        status: "PENDING",
      },
    });

    // 3️⃣ Revenue Made (sum of all COMPLETED transactions)
    const revenue = await prisma.transaction.aggregate({
      where: {
        sellerId: vendorId,
        status: "COMPLETED",
      },
      _sum: { amountCents: true },
    });

    const totalRevenue = (revenue._sum.amountCents ?? 0) / 100;

    // 4️⃣ Monthly Revenue (past 6 months)
    const now = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(now.getMonth() - 5);

    const monthlyStats = await prisma.transaction.findMany({
      where: {
        sellerId: vendorId,
        status: "COMPLETED",
        createdAt: { gte: sixMonthsAgo },
      },
      select: {
        amountCents: true,
        createdAt: true,
      },
    });

    // Group by month
    const monthlyTotals: Record<string, number> = {};
    for (const t of monthlyStats) {
      const month = t.createdAt.toLocaleString("default", { month: "short" });
      monthlyTotals[month] =
        (monthlyTotals[month] ?? 0) + (t.amountCents ?? 0) / 100;
    }

    // 5️⃣ Popular Listings (Top 5 listings sold most by this vendor)
    const popularListings = await prisma.listing.findMany({
      where: { sellerId: vendorId },
      select: {
        id: true,
        title: true,
        price: true,
        media: {
          take: 1,
          select: { url: true },
        },
        transactions: {
          where: { status: "COMPLETED" },
          select: { id: true },
        },
      },
    });

    const rankedListings = popularListings
      .map((l) => ({
        id: l.id,
        title: l.title,
        price: l.price,
        totalSold: l.transactions.length,
        media: l.media[0]?.url ?? null,
      }))
      .filter((l) => l.totalSold > 0)
      .sort((a, b) => b.totalSold - a.totalSold)
      .slice(0, 5);

    return successResponse(res, "Vendor dashboard stats", {
      runningOrders,
      orderRequests,
      totalRevenue,
      monthlyRevenue: monthlyTotals,
      popularListings: rankedListings,
    });
  } catch (err) {
    console.error("getVendorDashboardStats error:", err);
    return errorResponse(res, "Failed to fetch vendor dashboard stats");
  }
};

export const getVendorById = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const vendor = await prisma.vendorApplication.findUnique({
      where: { id },
      include: {
        user: {
          include: {
            kycDocument: true,
          },
        },
        location: true,
      },
    });
    return successResponse(res, "Vendor fetched successfully", vendor);
  } catch (err) {
    console.error(err);
    return errorResponse(res, "Failed to fetch vendor");
  }
};

export const getVendorOrders = async (req: AuthRequest, res: Response) => {
  try {
    const vendorId = req.user?.id;
    if (!vendorId) {
      return errorResponse(res, "Unauthorized", "UNAUTHORIZED", 401);
    }

    // ✅ Optional filters and pagination from query
    const { status, page = "1", limit = "10" } = req.query;

    const pageNum = parseInt(page as string, 10);
    const pageSize = parseInt(limit as string, 10);

    const whereClause: any = {
      sellerId: vendorId,
    };

    // If a filter status is passed (e.g. ?status=COMPLETED)
    if (status) {
      whereClause.status = status;
    }

    // ✅ Count total
    const totalOrders = await prisma.transaction.count({ where: whereClause });

    // ✅ Fetch paginated orders
    const orders = await prisma.transaction.findMany({
      where: whereClause,
      include: {
        buyer: {
          select: { id: true, name: true, email: true },
        },
        listing: {
          select: {
            id: true,
            title: true,
            price: true,
            media: true,
            transactions: true,
          },
        },
        Delivery: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      skip: (pageNum - 1) * pageSize,
      take: pageSize,
    });

    const totalPages = Math.ceil(totalOrders / pageSize);

    return successResponse(res, "Vendor orders fetched successfully", {
      totalOrders,
      totalPages,
      currentPage: pageNum,
      orders,
    });
  } catch (error) {
    console.error("getVendorOrders error:", error);
    return errorResponse(res, "Failed to fetch vendor orders");
  }
};
