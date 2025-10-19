import { Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import { successResponse, errorResponse } from "../utils/response";

// Dashboard overview (counts, stats)
export const getDashboardStats = async (req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.count();
    const listings = await prisma.listing.count();
    const kycPending = await prisma.kycVerification.count({ where: { status: "PENDING" } });
    const reports = await prisma.report.count({ where: { resolved: false } });

    return successResponse(res, "Dashboard stats retrieved", {
      users,
      listings,
      kycPending,
      reports,
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    return errorResponse(res, "Failed to load dashboard stats");
  }
};

// List all KYC requests
export const listKycRequests = async (req: AuthRequest, res: Response) => {
  try {
    const kycs = await prisma.kycVerification.findMany({ include: { user: true } });
    return successResponse(res, "KYC requests fetched", kycs);
  } catch (err) {
    return errorResponse(res, "Failed to load KYC requests");
  }
};

// Approve/Reject KYC
export const updateKycStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { kycId, status } = req.body;
    const updated = await prisma.kycVerification.update({
      where: { id: kycId },
      data: { status },
    });
    return successResponse(res, `KYC ${status.toLowerCase()}`, updated);
  } catch (err: any) {
    if (typeof err === "object" && err !== null && "code" in err && (err as any).code === "P2025") {
      // Prisma not found
      return errorResponse(res, "KYC record not found", "KYC_NOT_FOUND", 404);
    }
    return errorResponse(res, "Failed to update KYC status");
  }
};

// List reports
export const listReports = async (req: AuthRequest, res: Response) => {
  try {
    const reports = await prisma.report.findMany({
      include: { reviewedBy: true, reporter: true },
    });
    return successResponse(res, "Reports retrieved", reports);
  } catch (err) {
    return errorResponse(res, "Failed to load reports");
  }
};

// Resolve report
export const resolveReport = async (req: AuthRequest, res: Response) => {
  try {
    const { reportId } = req.body;
    const updated = await prisma.report.update({
      where: { id: reportId },
      data: { resolved: true },
    });
    return successResponse(res, "Report resolved", updated);
  } catch (err:any) {
    if (err.code === "P2025") {
      return errorResponse(res, "Report not found", "REPORT_NOT_FOUND", 404);
    }
    return errorResponse(res, "Failed to resolve report");
  }
};

// List users
export const listUsers = async (req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, isBanned: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return successResponse(res, "Users retrieved", users);
  } catch (err) {
    return errorResponse(res, "Failed to fetch users");
  }
};

// Ban user
export const banUser = async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.body;
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isBanned: true },
    });
    return successResponse(res, "User banned successfully", updated);
  } catch (err) {
    if (typeof err === "object" && err !== null && "code" in err && (err as any).code === "P2025") {
      return errorResponse(res, "User not found", "USER_NOT_FOUND", 404);
    }
    return errorResponse(res, "Failed to ban user");
  }
};

// Unban user
export const unbanUser = async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.body;
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isBanned: false },
    });
    return successResponse(res, "User unbanned successfully", updated);
  } catch (err:any) {
    if (err.code === "P2025") return errorResponse(res, "User not found", "USER_NOT_FOUND", 404);
    return errorResponse(res, "Failed to unban user");
  }
};

// Promote user role
export const updateUserRole = async (req: AuthRequest, res: Response) => {
  try {
    const { userId, role } = req.body;
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role },
    });
    return successResponse(res, `User role updated to ${role}`, updated);
  } catch (err:any) {
    if (err.code === "P2025") return errorResponse(res, "User not found", "USER_NOT_FOUND", 404);
    return errorResponse(res, "Failed to update user role");
  }
};

// List all listings
export const listAllListings = async (req: AuthRequest, res: Response) => {
  try {
    const listings = await prisma.listing.findMany({
      include: { seller: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
    return successResponse(res, "Listings retrieved", listings);
  } catch (err) {
    return errorResponse(res, "Failed to load listings");
  }
};

// Approve listing
export const approveListing = async (req: AuthRequest, res: Response) => {
  try {
    const { listingId } = req.body;
    const updated = await prisma.listing.update({
      where: { id: listingId },
      data: { status: "APPROVED" },
    });
    return successResponse(res, "Listing approved", updated);
  } catch (err:any) {
    if (err.code === "P2025")
      return errorResponse(res, "Listing not found", "LISTING_NOT_FOUND", 404);
    return errorResponse(res, "Failed to approve listing");
  }
};

// Reject listing
export const rejectListing = async (req: AuthRequest, res: Response) => {
  try {
    const { listingId } = req.body;
    const updated = await prisma.listing.update({
      where: { id: listingId },
      data: { status: "REJECTED" },
    });
    return successResponse(res, "Listing rejected", updated);
  } catch (err:any) {
    if (err.code === "P2025")
      return errorResponse(res, "Listing not found", "LISTING_NOT_FOUND", 404);
    return errorResponse(res, "Failed to reject listing");
  }
};

// Remove listing (admin)
export const removeListing = async (req: AuthRequest, res: Response) => {
  try {
    const { listingId } = req.body;
    const updated = await prisma.listing.update({
      where: { id: listingId },
      data: { status: "REMOVED" },
    });
    return successResponse(res, "Listing removed by admin", updated);
  } catch (err:any) {
    if (err.code === "P2025")
      return errorResponse(res, "Listing not found", "LISTING_NOT_FOUND", 404);
    return errorResponse(res, "Failed to remove listing");
  }
};
