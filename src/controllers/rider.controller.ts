import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import { uploadToCloudinary } from "../lib/cloudinary";
import { errorResponse, successResponse } from "../utils/response";
import {io} from "../server"
import { sendExpo, sendFcm } from "../lib/notifications";

/** 🧍 Rider Registration */
export const registerRider = async (req: AuthRequest, res: Response) => {
  try {
    const { phone, fullName, dateOfBirth, vehicleType } = req.body;
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
      update: {fullName, vehicleType,dateOfBirth },
      create: {
        userId: user?.id as string,
        phone: user?.phone as string,
        fullName,
        dateOfBirth,
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
        const user = await prisma.user.findUnique({
      where:{id: userId},
      include:{
        rider: true
      }
    })

    if(!user) return errorResponse(res, "User not found")

    const rider = await prisma.rider.findUnique({ where: { id: user.rider?.id } });

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
    const user = await prisma.user.findUnique({
      where:{id: userId},
      include:{
        rider: true
      }
    })

    if(!user) return errorResponse(res, "User not found")

    const rider = await prisma.rider.findUnique({ where: { id: user.rider?.id } });

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
    const user = await prisma.user.findUnique({
      where:{id:userId},
      include:{
        rider:true
      }
    })
    if (!user) return errorResponse(res, "User profile not found");

    const rider = await prisma.rider.findUnique({
      where: { userId },
      include: { vehicle: true, kyc: true, },
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
    const userId = req.user?.id;
    const { lat, lng } = req.body;

    if (!lat || !lng) return errorResponse(res, "Latitude and longitude required");
    const rider = await prisma.rider.findUnique({ where: { userId } });
    if (!rider) return errorResponse(res, "Rider profile not found");
    const riderId = rider.id;

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
    const userId = req.user?.id; // from auth middleware
    const { deliveryId } = req.params;


    const rider = await prisma.rider.findUnique({ where: { userId } });
    if (!rider) return errorResponse(res, "Rider profile not found");
    const riderId = rider.id;

    const delivery = await prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: { order: {
        include:{
          user: true, 
          vendor: {
            include:{
              user:true
            }
          }
        }
      }, rider:true },
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

    const order = await prisma.order.update({
      where: {id: updated.orderId},
      data:{
        status: ""
      }
    })

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

      const sessions = await prisma.session.findMany({ where: { userId: delivery.order.userId, deviceToken: { not: null } } });
    for (const s of sessions) {
      if (s.devicePlatform === "expo") await sendExpo(s.deviceToken!, "Delivery Update", `Your delivery is now Accepted and it will be out for Transit`, { type: "delivery_status", status: "Accepted" });
    }

    return successResponse(res, "Rider assigned successfully", updated);
  } catch (error) {
    console.error("acceptDelivery error:", error);
    return errorResponse(res, "Failed to accept delivery");
  }
};
export const approveRiderKyc = async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    if (!userId) return errorResponse(res, "userId is required");

    const kyc = await prisma.riderKyc.findUnique({ where: { riderId:userId }, include:{
      rider:{
        include:{
          user:true
        }
      }
    } });
    if (!kyc) return errorResponse(res, "KYC record not found", "NOT_FOUND", 404);

    // update KYC status
    const updated = await prisma.riderKyc.update({
      where: { riderId:userId },
      data: { status: "APPROVED" },
    });

    // set user.isKycVerified true
    await prisma.user.update({
      where: { id: kyc.rider.userId },
      data: { isKycVerified: true },
    });

    // notify via socket + push
    // socket: send to sessions of that user
    const sessions = await prisma.session.findMany({ where: { userId, deviceToken: { not: null } } });
    for (const s of sessions) {
      if (s.devicePlatform === "expo") await sendExpo(s.deviceToken!, "KYC Approved", "Your KYC has been approved", { type: "kyc", status: "APPROVED" });
      else await sendFcm(s.deviceToken!, "KYC Approved", "Your KYC has been approved", { type: "kyc", status: "APPROVED" });
    }

    return successResponse(res, "KYC approved", updated);
  } catch (err) {
    console.error("approveRiderKyc error:", err);
    return errorResponse(res, "Failed to approve KYC");
  }
};

export const rejectRiderKyc = async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    if (!userId) return errorResponse(res, "userId is required");

        const kyc = await prisma.riderKyc.findUnique({ where: { riderId:userId }, include:{
      rider:{
        include:{
          user:true
        }
      }
    } });
    if (!kyc) return errorResponse(res, "KYC record not found", "NOT_FOUND", 404);

    const updated = await prisma.riderKyc.update({
      where: { riderId:userId },
      data: { status: "REJECTED", rejectionNote: reason ?? "Rejected by admin" },
    });

    // set user.isKycVerified false
    await prisma.user.update({
      where: { id: kyc.rider.userId },
      data: { isKycVerified: false },
    });

    // notify sessions
    const sessions = await prisma.session.findMany({ where: { userId, deviceToken: { not: null } } });
    for (const s of sessions) {
      if (s.devicePlatform === "expo") await sendExpo(s.deviceToken!, "KYC Rejected", reason ?? "KYC was rejected", { type: "kyc", status: "REJECTED" });
      else await sendFcm(s.deviceToken!, "KYC Rejected", reason ?? "KYC was rejected", { type: "kyc", status: "REJECTED" });
    }

    return successResponse(res, "KYC rejected", updated);
  } catch (err) {
    console.error("rejectRiderKyc error:", err);
    return errorResponse(res, "Failed to reject KYC");
  }
};

export const approveRiderAccount = async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    if (!userId) return errorResponse(res, "userId required");

    // ensure KYC is approved (optional rule)
        const kyc = await prisma.riderKyc.findUnique({ where: { riderId:userId }, include:{
      rider:{
        include:{
          user:true
        }
      }
    } });
    if (kyc && kyc.status !== "APPROVED") {
      // You may only want to allow created rider if KYC approved; adjust per your policy
      return errorResponse(res, "KYC must be approved before approving rider account");
    }

    // upsert Rider profile
    const rider = await prisma.rider.update({
      where: { id: kyc?.riderId },
      data:{
        status: "APPROVED",
        updatedAt: new Date()
      }
    });

    // set the user's role to RIDER

    // notify rider via socket/push
    const sessions = await prisma.session.findMany({ where: { userId, deviceToken: { not: null } } });
    for (const s of sessions) {
      if (s.devicePlatform === "expo") await sendExpo(s.deviceToken!, "Rider Approved", "Your rider account has been approved", { type: "rider", status: "APPROVED" });
      else await sendFcm(s.deviceToken!, "Rider Approved", "Your rider account has been approved", { type: "rider", status: "APPROVED" });
    }

    return successResponse(res, "Rider approved", rider);
  } catch (err) {
    console.error("approveRiderAccount error:", err);
    return errorResponse(res, "Failed to approve rider account");
  }
};


export const rejectRiderAccount = async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    if (!userId) return errorResponse(res, "userId required");

    // set Rider.isApproved = false (if exists), else create with false
    const rider = await prisma.rider.update({
      where: { userId },
      data: { status: "REJECTED", updatedAt: new Date(), rejectionNote: reason || "" },
    });


    const sessions = await prisma.session.findMany({ where: { userId, deviceToken: { not: null } } });
    for (const s of sessions) {
      if (s.devicePlatform === "expo") await sendExpo(s.deviceToken!, "Rider Rejected", reason ?? "Your rider application was rejected", { type: "rider", status: "REJECTED" });
      else await sendFcm(s.deviceToken!, "Rider Rejected", reason ?? "Your rider application was rejected", { type: "rider", status: "REJECTED" });
    }

    return successResponse(res, "Rider rejected", rider);
  } catch (err) {
    console.error("rejectRiderAccount error:", err);
    return errorResponse(res, "Failed to reject rider account");
  }
};
export const updateDeliveryStatus = async (req: AuthRequest, res: Response) => {
  try {
    const riderId = req.user?.id;
    const { deliveryId, status } = req.body;

    if (!["PICKED_UP", "IN_TRANSIT", "DELIVERED", "CANCELLED"].includes(status)) {
      return errorResponse(res, "Invalid status");
    }

    const delivery = await prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: { order: {
        include:{
          user:true,
          vendor:{
            include:{
              user: true
            }
          }
        }
      } },
    });

    if (!delivery) return errorResponse(res, "Delivery not found");
    if (delivery.riderId !== riderId) return errorResponse(res, "Unauthorized");

    const updated = await prisma.delivery.update({
      where: { id: deliveryId },
      data: { status },
    });

    // 📡 Notify vendor + user via socket
    io.to(delivery.order.userId).emit("delivery_status_update", {
      deliveryId,
      status,
    });
    io.to(delivery.order.vendorId).emit("delivery_status_update", {
      deliveryId,
      status,
    });

    // 📨 Optionally send push notification

    const sessions = await prisma.session.findMany({ where: { userId: delivery.order.userId, deviceToken: { not: null } } });
    for (const s of sessions) {
      if (s.devicePlatform === "expo") await sendExpo(s.deviceToken!, "Delivery Update", `Your delivery is now: ${status}`, { type: "delivery_status", status });
    }
    const vendorSessions = await prisma.session.findMany({ where: { userId: delivery.order.vendor.user.id, deviceToken: { not: null } } });
    for (const s of vendorSessions) {
      if (s.devicePlatform === "expo") await sendExpo(s.deviceToken!, `Delivery Update for order # ${(delivery.order.id).slice(0, 6) }`, `This order is now: ${status}`, { type: "delivery_status", status });
    }
    // sendFcm() or sendExpo() here...

    return successResponse(res, "Delivery status updated", updated);
  } catch (err) {
    console.error("updateDeliveryStatus error:", err);
    return errorResponse(res, "Failed to update delivery status");
  }
};
export const markArrivalAtPickup = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { deliveryId } = req.params;

    const rider = await prisma.rider.findUnique({ where: { userId } });
    if (!rider) return errorResponse(res, "Rider not found");

    const delivery = await prisma.delivery.update({
      where: { id: deliveryId, riderId: rider.id },
      data: { status: "PICKED_UP", startedAt: new Date() },
      include:{order: true}
    });

    io.to(delivery.order.userId).emit("delivery_update", {
      deliveryId,
      status: "Picked Up",
      message: "Rider has arrived at pickup location",
    });

    const sessions = await prisma.session.findMany({
      where: { userId: delivery.order.userId , deviceToken: { not: null } }
    })
     for (const s of sessions) {
      if (s.devicePlatform === "expo") {
        await sendExpo(s.deviceToken!, "Delivery Update", `Your delivery has been picked up and is on the way`, { type: "delivery_status", status: "PICKED_UP" });
      }
    }


    return successResponse(res, "Marked as arrived", delivery);
  } catch (err) {
    console.error("markArrivalAtPickup error:", err);
    return errorResponse(res, "Failed to update delivery");
  }
};
export const startDelivery = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { deliveryId } = req.params;

    const rider = await prisma.rider.findUnique({ where: { userId } });
    if (!rider) return errorResponse(res, "Rider not found");

    const delivery = await prisma.delivery.update({
      where: { id: deliveryId, riderId: rider.id },
      data: { status: "IN_TRANSIT", startedAt: new Date(),
       },
       include:{
        order:true
       }
    });

    io.to(delivery.order.userId).emit("delivery_update", {
      deliveryId,
      status: "IN_TRANSIT",
      message: "Delivery is now in transit",
    });
        io.to(delivery.order.userId).emit("delivery_in_transit", { deliveryId });
    io.to(delivery.order.vendorId).emit("delivery_in_transit", { deliveryId });

    return successResponse(res, "Delivery started", delivery);
  } catch (err) {
    console.error("startDelivery error:", err);
    return errorResponse(res, "Failed to start delivery");
  }
};
export const completeDelivery = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { deliveryId } = req.params;

    const rider = await prisma.rider.findUnique({ where: { userId } });
    if (!rider) return errorResponse(res, "Rider not found");

    const delivery = await prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: { order: true },
    });
    if (!delivery) return errorResponse(res, "Delivery not found");
    if (delivery.status !== "IN_TRANSIT")
      return errorResponse(res, "Cannot complete this delivery");

    const updated = await prisma.delivery.update({
      where: { id: deliveryId },
      data: { status: "DELIVERED", completedAt: new Date() },
      include: { order: true },
    });

    // Notify user and vendor
    io.to(updated.order.userId).emit("delivery_completed", { deliveryId });
    io.to(updated.order.vendorId).emit("delivery_completed", { deliveryId });

       const sessions = await prisma.session.findMany({ where: { userId, deviceToken: { not: null } } });
    for (const s of sessions) {
      if (s.devicePlatform === "expo") await sendExpo(s.deviceToken!, "Order Delivered", ` your order #${(updated.orderId).toString().slice(0,6)} has been delivered to you`, { type: "Order", status: "DELIVERED" });
    }



    return successResponse(res, "Delivery completed successfully", updated);
  } catch (error) {
    console.error("completeDelivery error:", error);
    return errorResponse(res, "Failed to complete delivery");
  }
};
export const getActiveDeliveries = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const rider = await prisma.rider.findUnique({ where: { userId } });
    if (!rider) return errorResponse(res, "Rider not found", "NOT_FOUND", 404);

    const deliveries = await prisma.delivery.findMany({
      where: {
        riderId: rider.id,
        status: { in: ["ACCEPTED", "IN_TRANSIT", "PICKED_UP"] },
      },
      include: { 
        rider:{
          include:{
            kyc:true,
            vehicle:true,
            user:true
          }
        },
        order: {
          include: {
            vendor: { include: { user: true } },
            user: true,

          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return successResponse(res, "Active deliveries fetched", deliveries);
  } catch (error) {
    console.error("getActiveDeliveries error:", error);
    return errorResponse(res, "Failed to fetch active deliveries");
  }
};
export const getRiderDeliveryHistory = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    const rider = await prisma.rider.findUnique({ where: { userId } });
    if (!rider) return errorResponse(res, "Rider not found", "NOT_FOUND", 404);

    const deliveries = await prisma.delivery.findMany({
      where: {
        riderId: rider.id,
        status: { in: ["DELIVERED", "CANCELLED"] },
      },
      include: {
        order: {
          include: {
            vendor: { include: { user: true } },
            user: true,
          },
        },
      },
      orderBy: { completedAt: "desc" },
    });

    return successResponse(res, "Delivery history fetched successfully", deliveries);
  } catch (error) {
    console.error("getRiderDeliveryHistory error:", error);
    return errorResponse(res, "Failed to fetch rider delivery history");
  }
};
export const getSingleRiderDelivery = async(req:Request, res:Response) =>{
  try {
    const {deliveryId}= req.params;
    if(!deliveryId) return errorResponse(res, "Delivery id not found");
    
    const delivery = await prisma.delivery.findUnique({
      where:{id:deliveryId},
      include:{
        order:{
          include:{
            user: true,
            vendor:{
              include:{
                user:{
                  include:{
                    kycDocument:true,
                    vendorApplication: true
                  }
                }
              }
            }
          }
        }
      }
    });
    
    if (!delivery) return errorResponse(res, "Delivery not found")

    return successResponse(res, "Delivery fetched succesfully", delivery)
 
    
  } catch (error) {
        return errorResponse(res, "Failed to fetch delivery");
  }

}