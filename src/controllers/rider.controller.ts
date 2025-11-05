import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import { uploadToCloudinary } from "../lib/cloudinary";
import { errorResponse, successResponse } from "../utils/response";
import {io} from "../server"

/** 🧍 Rider Registration */
export const registerRider = async (req: AuthRequest, res: Response) => {
  try {
    const { phone, address, vehicleType } = req.body;
    const userId = req.user?.id;

    if (!phone || !vehicleType)
      return errorResponse(res, "Phone and vehicle type are required");

    const user = await prisma.user.findUnique({
        where:{id: userId}
    })

    if(!user){
        errorResponse(res, "User not found")
    }

    const rider = await prisma.rider.upsert({
      where: { userId },
      update: { phone, address, vehicleType },
      create: {
        userId: user?.id as string,
        phone,
        address,
        vehicleType,
        status: "PENDING",
      },
    });

    return successResponse(res, "Rider registered successfully", rider);
  } catch (err) {
    console.error("registerRider error:", err);
    return errorResponse(res, "Failed to register rider");
  }
};

/** 🚘 Upload Vehicle Info */
export const uploadRiderVehicle = async (req: AuthRequest, res: Response) => {
  try {
    const { brand, model, plateNumber } = req.body;
    const userId = req.user?.id;
    const rider = await prisma.rider.findUnique({ where: { userId } });

    if (!rider) return errorResponse(res, "Rider not found");

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

    const uploadFile = async (f: Express.Multer.File, folder: string) => {
      const uploaded = await uploadToCloudinary(f.buffer, folder);
      return uploaded.secure_url;
    };

    const frontViewUrl = files?.frontView ? await uploadFile(files.frontView[0], "riders/vehicles/front") : undefined;
    const backViewUrl = files?.backView ? await uploadFile(files.backView[0], "riders/vehicles/back") : undefined;
    const documentUrl = files?.document ? await uploadFile(files.document[0], "riders/vehicles/docs") : undefined;

    const vehicle = await prisma.riderVehicle.upsert({
      where: { riderId: rider.id },
      update: { brand, model, plateNumber, frontViewUrl, backViewUrl, documentUrl },
      create: { riderId: rider.id, brand, model, plateNumber, frontViewUrl, backViewUrl, documentUrl },
    });

    return successResponse(res, "Vehicle details uploaded", vehicle);
  } catch (err) {
    console.error("uploadRiderVehicle error:", err);
    return errorResponse(res, "Failed to upload vehicle details");
  }
};

/** 🪪 Upload Rider KYC */
export const uploadRiderKyc = async (req: AuthRequest, res: Response) => {
  try {
    const { ninNumber, idType } = req.body;
    const userId = req.user?.id;
    const rider = await prisma.rider.findUnique({ where: { userId } });

    if (!rider) return errorResponse(res, "Rider not found");

    const files = req.files as { [key: string]: Express.Multer.File[] } | undefined;

    const uploadFile = async (f: Express.Multer.File, folder: string) => {
      const uploaded = await uploadToCloudinary(f.buffer, folder);
      return uploaded.secure_url;
    };

    const selfieUrl = files?.selfie ? await uploadFile(files.selfie[0], "riders/kyc/selfies") : undefined;
    const idCardUrl = files?.idCard ? await uploadFile(files.idCard[0], "riders/kyc/idcards") : undefined;
    const licenseUrl = files?.license ? await uploadFile(files.license[0], "riders/kyc/license") : undefined;
    const roadWorthinessUrl = files?.roadWorthiness
      ? await uploadFile(files.roadWorthiness[0], "riders/kyc/roadworthiness")
      : undefined;

    const kyc = await prisma.riderKyc.upsert({
      where: { riderId: rider.id },
      update: { ninNumber, idType, selfieUrl, idCardUrl, licenseUrl, roadWorthinessUrl },
      create: { riderId: rider.id, ninNumber, idType, selfieUrl, idCardUrl, licenseUrl, roadWorthinessUrl },
    });

    return successResponse(res, "KYC uploaded successfully", kyc);
  } catch (err) {
    console.error("uploadRiderKyc error:", err);
    return errorResponse(res, "Failed to upload KYC");
  }
};

/** 👤 Get My Rider Profile */
export const getMyRiderProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const rider = await prisma.rider.findUnique({
      where: { userId },
      include: { vehicle: true, kyc: true },
    });

    if (!rider) return errorResponse(res, "Rider profile not found");
    return successResponse(res, "Rider profile retrieved", rider);
  } catch (err) {
    console.error("getMyRiderProfile error:", err);
    return errorResponse(res, "Failed to fetch rider profile");
  }
};

/** 🔒 Admin: Update Rider Status */
export const updateRiderStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["PENDING", "APPROVED", "REJECTED"].includes(status))
      return errorResponse(res, "Invalid status value");

    const rider = await prisma.rider.update({
      where: { id },
      data: { status },
    });

    return successResponse(res, "Rider status updated", rider);
  } catch (err) {
    console.error("updateRiderStatus error:", err);
    return errorResponse(res, "Failed to update rider status");
  }
};
export const updateRiderLocation = async (req: AuthRequest, res: Response) => {
  try {
    const riderId = req.user?.id;
    const { lat, lng } = req.body;

    if (!lat || !lng) return errorResponse(res, "Latitude and longitude required");

    await prisma.rider.update({
      where: { userId: riderId },
      data: {
        currentLat: parseFloat(lat),
        currentLng: parseFloat(lng),
        isOnline: true,
      },
    });

    // 🔊 Emit to socket room so vendors/admins can see updates
    const io = req.app.get("io");
    io.emit("rider_location_update", {
      riderId,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
    });

    return successResponse(res, "Location updated");
  } catch (err) {
    console.error("updateRiderLocation error:", err);
    return errorResponse(res, "Failed to update rider location");
  }
};

/** 🔌 Toggle rider online/offline */
export const toggleRiderOnline = async (req: AuthRequest, res: Response) => {
  try {
    const riderId = req.user?.id;
    const { isOnline } = req.body;

    const rider = await prisma.rider.update({
      where: { userId: riderId },
      data: { isOnline: Boolean(isOnline) },
    });

    return successResponse(res, "Rider status updated", rider);
  } catch (err) {
    console.error(err);
    return errorResponse(res, "Failed to update rider status");
  }
};

/** 🗺️ Get all nearby riders for vendor/admin */
export const getNearbyRiders = async (req: AuthRequest, res: Response) => {
  try {
    const { lat, lng, radiusKm = 10 } = req.query;

    if (!lat || !lng)
      return errorResponse(res, "Latitude and longitude required");

    const allRiders = await prisma.rider.findMany({
      where: { isOnline: true },
      select: { id: true, currentLat: true, currentLng: true, user: { select: { name: true } } },
    });

    const nearby = allRiders.filter((r) => {
      if (!r.currentLat || !r.currentLng) return false;
      const dist = haversineDistance(
        Number(lat),
        Number(lng),
        r.currentLat,
        r.currentLng
      );
      return dist <= Number(radiusKm);
    });

    return successResponse(res, "Nearby riders", nearby);
  } catch (err) {
    console.error("getNearbyRiders error:", err);
    return errorResponse(res, "Failed to fetch nearby riders");
  }
};

// 🧮 Haversine utility
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const acceptDelivery = async (req: Request, res: Response) => {
  try {
    const riderId = req.user?.id; // from auth middleware
    const { deliveryId } = req.params;

    const delivery = await prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: { order: true },
    });

    if (!delivery) return errorResponse(res, "Delivery not found", "NOT_FOUND", 404);

    if (delivery.status !== "SEARCH_OF_RIDER") {
      return errorResponse(res, "This delivery has already been taken");
    }

    // assign the first rider atomically
    const updated = await prisma.delivery.update({
      where: { id: deliveryId },
      data: {
        status: "ACCEPTED",
        riderId,
        startedAt: new Date(),
      },
    });

    // broadcast to vendor + user
    io.to(delivery.order.userId).emit("rider_assigned", {
      deliveryId,
      rider: {
        id: riderId,
      },
    });

    io.to(delivery.order.vendorId).emit("rider_assigned", {
      deliveryId,
      rider: {
        id: riderId,
      },
    });

    return successResponse(res, "Rider assigned successfully", updated);
  } catch (error) {
    console.error("acceptDelivery error:", error);
    return errorResponse(res, "Failed to accept delivery");
  }
};
