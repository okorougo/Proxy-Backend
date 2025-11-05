import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { sendEmail } from "../services/emailService";
import { errorResponse, successResponse } from "../utils/response";
import { AuthRequest } from "../middleware/auth";
import geohash from "ngeohash";
import { generateSignedDownloadUrl } from "../lib/cloudinary";
import axios from "axios";
import {io} from "../server"

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

export const getVendorDashboardStats = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return errorResponse(res, "Unauthorized", "UNAUTHORIZED", 401);

    // ✅ Find vendor for logged-in user
    const vendor = await prisma.vendorApplication.findUnique({ where: { userId } });
    if (!vendor) return errorResponse(res, "Vendor not found", "NO_VENDOR", 404);

    const vendorId = vendor.id;

    // 1️⃣ Running Orders (active, not completed or cancelled)
    const runningOrders = await prisma.order.count({
      where: {
        vendorId,
        NOT: { status: { in: ["COMPLETED", "CANCELLED", "REJECTED"] } },
      },
    });

    // 2️⃣ Order Requests (pending confirmation)
    const orderRequests = await prisma.order.count({
      where: { vendorId, status: "PENDING" },
    });

    // 3️⃣ Total Revenue (sum of COMPLETED transactions)
    const revenueAgg = await prisma.transaction.aggregate({
      where: { sellerId: vendorId, status: "COMPLETED" },
      _sum: { amountCents: true },
    });
    const totalRevenue = (revenueAgg._sum.amountCents ?? 0) / 100;

    // 4️⃣ Daily Stats
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const todayRevenueAgg = await prisma.transaction.aggregate({
      where: {
        sellerId: vendorId,
        status: "COMPLETED",
        createdAt: { gte: startOfToday, lte: endOfToday },
      },
      _sum: { amountCents: true },
    });
    const todayRevenue = (todayRevenueAgg._sum.amountCents ?? 0) / 100;

    const todayNewOrders = await prisma.order.count({
      where: { vendorId, createdAt: { gte: startOfToday, lte: endOfToday } },
    });

    // 5️⃣ Monthly Revenue (last 6 months)
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const transactions = await prisma.transaction.findMany({
      where: {
        sellerId: vendorId,
        status: "COMPLETED",
        createdAt: { gte: sixMonthsAgo },
      },
      select: { amountCents: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    const monthlyTotals: Record<string, number> = {};

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString("default", { month: "short" });
      monthlyTotals[label] = 0;
    }

    transactions.forEach((t) => {
      const label = t.createdAt.toLocaleString("default", { month: "short" });
      monthlyTotals[label] += (t.amountCents ?? 0) / 100;
    });

    const labels = Object.keys(monthlyTotals);
    const values = Object.values(monthlyTotals);

    // 6️⃣ Popular Listings (Top 5 best-sellers)
    const soldItems = await prisma.orderItem.findMany({
      where: {
        order: {
          vendorId,
          transaction: { status: "COMPLETED" },
        },
      },
      select: {
        listingId: true,
        quantity: true,
        listing: {
          select: {
            id: true,
            title: true,
            price: true,
            media: { take: 1, select: { url: true } },
          },
        },
      },
    });

    const listingMap = new Map<
      string,
      { id: string; title: string; price: number; image: string | null; totalSold: number }
    >();

    for (const item of soldItems) {
      const id = item.listing.id;
      const existing = listingMap.get(id);
      const qty = item.quantity ?? 0;
      if (existing) {
        existing.totalSold += qty;
      } else {
        listingMap.set(id, {
          id,
          title: item.listing.title,
          price: item.listing.price,
          image: item.listing.media?.[0]?.url ?? null,
          totalSold: qty,
        });
      }
    }

    const popularListings = Array.from(listingMap.values())
      .sort((a, b) => b.totalSold - a.totalSold)
      .slice(0, 5);

    // ✅ Final Response
    return successResponse(res, "Vendor dashboard stats", {
      runningOrders,
      orderRequests,
      totalRevenue,
      todayRevenue,
      todayNewOrders,
      monthlyRevenue: { labels, values },
      popularListings,
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
    const vendorUserId = req.user?.id; // the logged-in vendor user
    if (!vendorUserId)
      return errorResponse(res, "Unauthorized", "UNAUTHORIZED", 401);

    // ✅ find the vendor application associated with this user
    const vendor = await prisma.vendorApplication.findFirst({
      where: { userId: vendorUserId },
    });

    if (!vendor)
      return errorResponse(res, "Vendor profile not found", "NOT_FOUND", 404);

    // ✅ fetch all orders belonging to this vendor
    const orders = await prisma.order.findMany({
      where: { vendorId: vendor.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        listings: {
          include: {
            listing: {
              include: {
                media: true,
                category: true,
              },
            },
          },
        },
        transaction: true,
        delivery: true,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!orders || orders.length === 0)
      return successResponse(res, "No orders found", []);

    // ✅ format the result for clean frontend consumption
    const formatted = orders.map((order) => {
      let digitalFiles: any[] = [];

      // For digital orders, use stored digitalFiles directly
      if (
        order.isDigital &&
        order.delivery?.isDigital &&
        order.delivery.digitalFiles
      ) {
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
        buyer: order.user,
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
              pickupAddress: order.delivery.pickupAddress,
              dropoffAddress: order.delivery.dropoffAddress,
              pickupLat: order.delivery.pickupLat,
              pickupLng: order.delivery.pickupLng,
              dropoffLat: order.delivery.dropoffLat,
              dropoffLng: order.delivery.dropoffLng,
            }
          : null,
        listings: order.listings.map((item) => ({
          id: item.id,
          title: item.listing.title,
          price: item.unitPrice,
          quantity: item.quantity,
          image: item.listing.media?.[0]?.url || null,
        })),
        createdAt: order.createdAt,
      };
    });

    return successResponse(res, "Vendor orders fetched successfully", formatted);
  } catch (error) {
    console.error("❌ getVendorOrders error:", error);
    return errorResponse(res, "Failed to fetch vendor orders");
  }
};

type CartItem = { id: string; quantity: number };

export const createMultiVendorOrder = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { reference } = req.query;
    const userId = req.user?.id;
    const { items, dropoffAddress, dropoffLat, dropoffLng } = req.body;
    if (!reference) return errorResponse(res, "Missing payment reference");

    // 1️⃣ Verify payment from Paystack
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
      }
    );

    const paystackData = response.data;
    if (paystackData.status !== true)
      return errorResponse(res, "Invalid payment verification");

    const payment = paystackData.data;
    if (payment.status !== "success")
      return errorResponse(res, "Payment not successful");

    const amountPaid = payment.amount / 100;
    const paystackRef = payment.reference;

    if (!userId) return errorResponse(res, "Unauthorized", "UNAUTHORIZED", 401);
    if (!Array.isArray(items) || items.length === 0)
      return errorResponse(res, "Cart items required");

    // Fetch all listings referenced by the cart (authoritative)
    const listingIds = Array.from(
      new Set((items as CartItem[]).map((i) => i.id))
    );
    const listings = await prisma.listing.findMany({
      where: { id: { in: listingIds } },
      include: {
        seller: {
          include: {
            vendorApplication: {
              include: {
                user: true,
              },
            },
          },
        },
        media: true,
      },
    });

    if (listings.length === 0) return errorResponse(res, "Listings not found");

    // Map listingId -> listing
    const listingMap = new Map(listings.map((l) => [l.id, l]));

    // Group items by seller (use listing.sellerId — do NOT trust client-provided vendorId)
    const grouped: Record<string, { listing: any; quantity: number }[]> = {};
    for (const it of items as CartItem[]) {
      const listing = listingMap.get(it.id);
      if (!listing) return errorResponse(res, `Listing ${it.id} not found`);

      const vendorId = listing.seller?.vendorApplication?.id as string;

      if (!grouped[vendorId]) grouped[vendorId] = [];
      grouped[vendorId].push({ listing, quantity: Number(it.quantity || 1) });
    }

    const results: any[] = [];

    // perform each vendor order creation inside the same prisma transaction batch per vendor (but we can batch all writes too)
    for (const [vendorId, vendorItems] of Object.entries(grouped)) {
      // calculate totals and prepare order items
      let totalAmount = 0;
      const orderItemsCreate = vendorItems.map((v) => {
        const unitPrice = Number(v.listing.price ?? 0);
        const qty = Number(v.quantity ?? 1);
        totalAmount += unitPrice * qty;
        return {
          listingId: v.listing.id,
          quantity: qty,
          unitPrice,
        };
      });

      // create order + orderItems + transaction atomically
      const [order, transaction] = await prisma
        .$transaction([
          // create order
          prisma.order.create({
            data: {
              userId,
              vendorId,
              totalAmount,
              status: "PENDING",
              isDigital: vendorItems.every((i) => i.listing.isDigital === true),
              listings: { create: orderItemsCreate },
            },
            include: {
              listings: { include: { listing: { include: { media: true } } } },
              vendor: true,
              user: true,
            },
          }),
          // create transaction associated to the order
          // we'll create this after the order in a second query so we can reference order.id; using $transaction above is fine, but to keep ordering clearer:
        ])
        .then(async ([createdOrder]) => {
          const txn = await prisma.transaction.create({
            data: {
              orderId: createdOrder.id,
              buyerId: userId,
              sellerId: vendorId,
              amountCents: Math.round(totalAmount * 100),
              status: "COMPLETED", // payment pending by default
              method: "PAYSTACK", // or from req.body
              amountPaid: amountPaid,
              paystackRef,
            },
          });
          return [createdOrder, txn];
        })
        .then((arr) => arr as any[]);

      // optionally auto create delivery for physical items (you might rather create delivery after payment success)
      let delivery = null;
      if (order.isDigital) {
        const digitalFiles = vendorItems.flatMap((i) =>
          i.listing.media.map((file: any) => ({
            id: file.id,
            name: file.publicId,
            url: file.url, // direct accessible file URL
          }))
        );

        delivery = await prisma.delivery.create({
          data: {
            orderId: order.id,
            transactionId: transaction.id,
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
            digitalFiles: JSON.stringify(digitalFiles),
          },
        });

        // mark order as delivered since digital
        await prisma.order.update({
          where: { id: order.id },
          data: { status: "DELIVERED" },
        });
      }

      // ✅ PHYSICAL ORDERS — create delivery record
      if (!order.isDigital && dropoffLat && dropoffLng && dropoffAddress) {
        const vendorLocation = await prisma.location.findFirst({
          where: { vendorId },
        });

        if (vendorLocation) {
          const distanceKm = haversineDistance(
            vendorLocation.lat,
            vendorLocation.lng,
            Number(dropoffLat),
            Number(dropoffLng)
          );
          const BASE_FARE = 400,
            RATE_PER_KM = 120,
            SERVICE_FEE = 100;
          const fareAmount = Math.round(
            BASE_FARE + distanceKm * RATE_PER_KM + SERVICE_FEE
          );

          delivery = await prisma.delivery.create({
            data: {
              orderId: order.id,
              transactionId: transaction.id,
              pickupAddress: vendorLocation.Address ?? "Vendor address",
              pickupLat: vendorLocation.lat,
              pickupLng: vendorLocation.lng,
              dropoffAddress,
              dropoffLat: Number(dropoffLat),
              dropoffLng: Number(dropoffLng),
              distanceKm,
              fareAmount,
              status: "PENDING",
              isDigital: false,
            },
          });

          // Update order total
          await prisma.order.update({
            where: { id: order.id },
            data: { totalAmount: { increment: fareAmount } },
          });
        }
      }

      results.push({ order, transaction, delivery });
    }

    return successResponse(res, "Orders created (per vendor)", results);
  } catch (err) {
    console.error("createMultiVendorOrder error:", err);
    return errorResponse(res, "Failed to create orders");
  }
};
export const pushOrderToRiders = async (req: Request, res: Response) => {
  try {
    const { deliveryId } = req.params;
    const delivery = await prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: {
        order: {
          include: {
            vendor: { include: { user: true } },
          },
        },
      },
    });

    if (!delivery) return errorResponse(res, "Delivery not found", "NOT_FOUND", 404);
    
    if (delivery.status !== "PENDING")
      return errorResponse(res, "Cannot push a non-pending delivery");

    // mark as searching
    await prisma.delivery.update({
      where: { id: deliveryId },
      data: { status: "SEARCH_OF_RIDER" },
    });

    // Fetch nearby riders (within 10km)
    const riders = await prisma.rider.findMany({
      where: {
        isOnline: true,
        currentLat: { not: null },
        currentLng: { not: null },
      },
    });

    const nearbyRiders = riders.filter((r) => {
      const R = 6371; // km
      const dLat = ((r.currentLat as number - delivery.pickupLat) * Math.PI) / 180;
      const dLon = ((r.currentLng as number - delivery.pickupLng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(delivery.pickupLat * (Math.PI / 180)) *
          Math.cos(r.currentLat as number * (Math.PI / 180)) *
          Math.sin(dLon / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c <= 10; // within 10km
    });

    // Broadcast to nearby riders
    nearbyRiders.forEach((r) => {
      io.to(r.id).emit("new_delivery_offer", {
        deliveryId: delivery.id,
        pickupAddress: delivery.pickupAddress,
        dropoffAddress: delivery.dropoffAddress,
        fareAmount: delivery.fareAmount,
        vendorName: delivery.order.vendor.user.name,
      });
    });

    return successResponse(res, "Order pushed to nearby riders", {
      ridersFound: nearbyRiders.length,
    });
  } catch (error) {
    console.error("pushOrderToRiders error:", error);
    return errorResponse(res, "Failed to push order to riders");
  }
};

