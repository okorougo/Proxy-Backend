import { Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import { successResponse, errorResponse } from "../utils/response";
import { uploadToCloudinary } from "../lib/cloudinary"; 
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

// Dashboard overview (counts, stats)
export const adminLogin = async (req: any, res: Response) => {
  try {
    const { email, password }:any = req.body;

    if (!email || !password) {
      return errorResponse(res, "Email and password are required", "MISSING_FIELDS", 400);
    }

    const admin = await prisma.user.findUnique({
      where: { email },
    });

    if (!admin) {
      return errorResponse(res, "Invalid email or password", "INVALID_CREDENTIALS", 401);
    }

    if (admin.role !== "ADMIN") {
      return errorResponse(res, "Access denied — not an admin account", "FORBIDDEN", 403);
    }

    const validPassword = await bcrypt.compare(password, admin.password || "");
    if (!validPassword) {
      return errorResponse(res, "Invalid email or password", "INVALID_CREDENTIALS", 401);
    }

    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" }
    );

    return successResponse(res, "Admin login successful", {
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
    });
  } catch (err) {
    console.error("adminLogin error:", err);
    return errorResponse(res, "Internal server error", "SERVER_ERROR", 500);
  }
};
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
export const createCategory = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== "ADMIN") {
      return res.status(403).json({ error: "Only admin can create categories" });
    }

    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: "Category name is required" });

    const exists = await prisma.category.findUnique({ where: { name } });
    if (exists) return res.status(409).json({ error: "Category already exists" });

    let imageUrl: string | undefined;

    // Use buffer from multer (memoryStorage)
    if (req.file && req.file.buffer) {
      const uploaded = await uploadToCloudinary(req.file.buffer, "categories");
      imageUrl = uploaded.secure_url;
    }

    const category = await prisma.category.create({
      data: { name, description, imageUrl },
    });

    res.status(201).json({ message: "Category created successfully", category });
  } catch (err) {
    console.error("createCategory error:", err);
    res.status(500).json({ error: "Failed to create category" });
  }
};

export const getCategories = async (req: AuthRequest, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json({ categories });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
};
export const updateCategory = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== "ADMIN") {
      return res.status(403).json({ error: "Only admin can update categories" });
    }

    const { id } = req.params;
    const { name, description } = req.body;

    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) return res.status(404).json({ error: "Category not found" });

    let imageUrl = category.imageUrl;

    // If a new image is uploaded, replace the old one
    if (req.file && req.file.buffer) {
      const uploaded = await uploadToCloudinary(req.file.buffer, "categories");
      imageUrl = uploaded.secure_url;
    }

    const updated = await prisma.category.update({
      where: { id },
      data: {
        name: name || category.name,
        description: description || category.description,
        imageUrl,
      },
    });

    res.json({ message: "Category updated successfully", category: updated });
  } catch (err) {
    console.error("updateCategory error:", err);
    res.status(500).json({ error: "Failed to update category" });
  }
};
export const deleteCategory = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== "ADMIN") {
      return res.status(403).json({ error: "Only admin can delete categories" });
    }

    const { id } = req.params;

    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) return res.status(404).json({ error: "Category not found" });

    // Optional: check if any listings are under this category
    const listingCount = await prisma.listing.count({ where: { categoryId: id } });
    if (listingCount > 0) {
      return res.status(400).json({
        error: "Cannot delete category with existing listings",
      });
    }

    await prisma.category.delete({ where: { id } });

    res.json({ message: "Category deleted successfully" });
  } catch (err) {
    console.error("deleteCategory error:", err);
    res.status(500).json({ error: "Failed to delete category" });
  }
};