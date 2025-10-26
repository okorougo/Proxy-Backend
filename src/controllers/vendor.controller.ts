import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { sendEmail } from "../services/emailService";
import { errorResponse, successResponse } from "../utils/response";
import { AuthRequest } from "../middleware/auth";



function haversineDistance(lat1:number, lon1:number, lat2:number, lon2:number) {
  const R = 6371; // Earth radius in km
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // distance in km
}




// User applies to become vendor
export const applyVendor = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { description } = req.body;


    const existing = await prisma.vendorApplication.findUnique({ where: { userId } });
    if (existing) {
        return errorResponse(res, "You have already applied to become a vendor");
      return;
    }
    const app = await prisma.vendorApplication.create({
      data: { userId: userId as string, description, status: "PENDING" },
    });

    return successResponse(res, "Vendor application submitted successfully", app);
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
        ${
          note ? `<p><b>Reason:</b> ${note}</p>` : ""
        }
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
        return successResponse(res, "Vendor applications fetched successfully", applications);
    } catch (err) {
        console.error(err);
        return errorResponse(res, "Failed to fetch vendor applications");
    }
}


export const createDelivery = async (req:AuthRequest, res:Response) => {
  try {
    const { transactionId, dropoffAddress, dropoffLat, dropoffLng } = req.body;
    const userId = req.user?.id; // from auth middleware



    // Fetch vendor info for pickup data
    const vendor = await prisma.location.findUnique({
      where: { vendorId: userId },
      select: { Address: true, lat: true, lng: true, city: true, country: true }
    });

    if (!vendor) return res.status(404).json({ message: "Vendor not found" });

    // Calculate distance and fare
    const distanceKm = haversineDistance(
      vendor.lat,
      vendor.lng,
      dropoffLat,
      dropoffLng
    );

    const BASE_FARE = 400;
    const RATE_PER_KM = 120;
    const SERVICE_FEE = 100;
    const fareAmount = BASE_FARE + distanceKm * RATE_PER_KM + SERVICE_FEE;

    // Create delivery record


    const delivery = await prisma.delivery.create({
      data: {
        transactionId,
        pickupAddress: vendor.Address,
        pickupLat: vendor.lat,
        pickupLng: vendor.lng,
        dropoffAddress,
        dropoffLat,
        dropoffLng,
        distanceKm,
        fareAmount,
      },
    });

    res.status(201).json({ message: "Delivery created", delivery });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error creating delivery" });
  }
};
