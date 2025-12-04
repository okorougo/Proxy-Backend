import { Response , Request} from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import { successResponse, errorResponse } from "../utils/response";
import { uploadToCloudinary } from "../lib/cloudinary"; 
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import axios from "axios";

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
      select: { id: true, email: true, name: true, role: true, isBanned: true, createdAt: true, vendorApplication: true, kycDocument:true, Session:true, order:true, rider:true,  },
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
    const { userId } = req.params;
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
        const { userId } = req.params;
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
      include: { media: true, seller: { select: { id: true, email: true, name: true, kycDocument:true, vendorApplication:true } } },
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
    const { listingId, rejectionNote } = req.body;
    const updated = await prisma.listing.update({
      where: { id: listingId },
      data: { status: "REJECTED",rejectionNote },
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
      include: { subCategories: true }, // optional: include sub-categories
    });
    res.json({ categories });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
};

export const updateSubCategory = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== "ADMIN") {
      return res.status(403).json({ error: "Only admin can update sub-categories" });
    }

    const { id } = req.params;
    const { name, description, categoryId } = req.body;

    const subCategory = await prisma.subCategory.findUnique({ where: { id } });
    if (!subCategory) return res.status(404).json({ error: "Sub-category not found" });


    const updated = await prisma.subCategory.update({
      where: { id },
      data: {
        name: name || subCategory.name,
        description: description || subCategory.description,
        categoryId: categoryId || subCategory.categoryId,
      },
    });

    res.json({ message: "Sub-category updated successfully", subCategory: updated });
  } catch (err) {
    console.error("updateSubCategory error:", err);
    res.status(500).json({ error: "Failed to update sub-category" });
  }
};

// Delete Sub-Category
export const deleteSubCategory = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== "ADMIN") {
      return res.status(403).json({ error: "Only admin can delete sub-categories" });
    }

    const { id } = req.params;

    const subCategory = await prisma.subCategory.findUnique({ where: { id } });
    if (!subCategory) return res.status(404).json({ error: "Sub-category not found" });

    const listingCount = await prisma.listing.count({ where: { subCategoryId: id } });
    if (listingCount > 0) {
      return res.status(400).json({ error: "Cannot delete sub-category with existing listings" });
    }

    await prisma.subCategory.delete({ where: { id } });

    res.json({ message: "Sub-category deleted successfully" });
  } catch (err) {
    console.error("deleteSubCategory error:", err);
    res.status(500).json({ error: "Failed to delete sub-category" });
  }
};

// Get Sub-Categories
export const getSubCategories = async (req: AuthRequest, res: Response) => {
  try {
    const subCategories = await prisma.subCategory.findMany({
      include: { category: true }, // optional: include parent category
      orderBy: { createdAt: "desc" },
    });
    res.json({ subCategories });
  } catch (err) {
    console.error("getSubCategories error:", err);
    res.status(500).json({ error: "Failed to fetch sub-categories" });
  }
};
export const createSubCategory = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== "ADMIN") {
      return res.status(403).json({ error: "Only admin can create sub-categories" });
    }

    const { name, description, categoryId } = req.body;
    if (!name) return res.status(400).json({ error: "Sub-category name is required" });
    if (!categoryId) return res.status(400).json({ error: "Parent categoryId is required" });

    // Check if parent category exists
    const parentCategory = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!parentCategory) return res.status(404).json({ error: "Parent category not found" });

    // Check if sub-category already exists under this category
    const exists = await prisma.subCategory.findFirst({ 
      where: { name, categoryId }
    });
    if (exists) return res.status(409).json({ error: "Sub-category already exists under this category" });

    const subCategory = await prisma.subCategory.create({
      data: { name, description, categoryId },
    });

    res.status(201).json({ message: "Sub-category created successfully", subCategory });
  } catch (err) {
    console.error("createSubCategory error:", err);
    res.status(500).json({ error: "Failed to create sub-category" });
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

export const getRiderDashboardStats = async (req: AuthRequest, res: Response) => {
  try {
    const [pending, approved, rejected, totalDeliveries] = await Promise.all([
      prisma.rider.count({ where: { status: "PENDING" } }),
      prisma.rider.count({ where: { status: "APPROVED" } }),
      prisma.rider.count({ where: { status: "REJECTED" } }),
      prisma.delivery.count({}),
    ]);

    const totalRiders = pending + approved + rejected;

    // Get top 5 riders by number of deliveries
    const topRiders = await prisma.rider.findMany({
      where: { status: "APPROVED" },
      include: {
        user: { select: { name: true, email: true, phone: true } },
        _count: { select: { deliveries: true } },
      },
      orderBy: {
        deliveries: { _count: "desc" },
      },
      take: 5,
    });

    return successResponse(res, "Rider dashboard stats", {
      totalRiders,
      pending,
      approved,
      rejected,
      totalDeliveries,
      topRiders,
    });
  } catch (err) {
    console.error("getRiderDashboardStats error:", err);
    return errorResponse(res, "Failed to get rider dashboard stats");
  }
};

/** 📋 Paginated Riders List */
export const getAllRiders = async (req: AuthRequest, res: Response) => {
  try {
    // Accept optional status and search params. By default (no status provided)
    // fetch riders of any status.
    const { status, search, page = "1", limit = "10" } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    // status remains optional; if provided we filter by it, otherwise all statuses
    if (status) where.status = status;

    // Search across rider.fullName, linked user name/email, and rider phone
    if (search) {
      const q = String(search);
      where.OR = [
        { fullName: { contains: q, mode: "insensitive" } },
        { user: { name: { contains: q, mode: "insensitive" } } },
        { user: { email: { contains: q, mode: "insensitive" } } },
        { phone: { contains: q, mode: "insensitive" } },
      ];
    }

    const [riders, total] = await Promise.all([
      prisma.rider.findMany({
        where,
        include: {
          user: { select: { name: true, email: true, rider: true } },
          deliveries:true,
          vehicle: true,
          kyc: true,
          _count: { select: { deliveries: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: Number(limit),
      }),
      prisma.rider.count({ where }),
    ]);

    return successResponse(res, "Riders fetched successfully", {
      total,
      page: Number(page),
      limit: Number(limit),
      riders,
    });
  } catch (err) {
    console.error("getAllRiders error:", err);
    return errorResponse(res, "Failed to fetch riders");
  }
};

/** 👤 Get Single Rider Details */
export const getSingleRider = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const rider = await prisma.rider.findUnique({
      where: { id },
      include: {
        user: { select: { name: true, email: true, phone: true, } },
        vehicle: true,
        kyc: true,
        deliveries: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!rider) return errorResponse(res, "Rider not found", "RIDER_NOT_FOUND", 404);

    return successResponse(res, "Rider details retrieved", rider);
  } catch (err) {
    console.error("getSingleRider error:", err);
    return errorResponse(res, "Failed to get rider details");
  }
};
export const getSingleUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        kycDocument: true,
        Session: true,
        order: true,
        
      },
    });

    if (!user) return errorResponse(res, "User not found", "RIDER_NOT_FOUND", 404);

    return successResponse(res, "Rider details retrieved", user);
  } catch (err) {
    console.error("getSingleRider error:", err);
    return errorResponse(res, "Failed to get rider details");
  }
};

/** 🧾 Rider Analytics per Month (Optional chart data) */
export const getRiderMonthlyStats = async (req: AuthRequest, res: Response) => {
  try {
    const monthlyStats = await prisma.delivery.groupBy({
      by: ["createdAt"],
      _count: { id: true },
      orderBy: { createdAt: "asc" },
    });

    const stats = monthlyStats.reduce((acc: any, d) => {
      const month = new Date(d.createdAt).toLocaleString("default", { month: "short" });
      acc[month] = (acc[month] || 0) + d._count.id;
      return acc;
    }, {});

    return successResponse(res, "Monthly delivery stats", stats);
  } catch (err) {
    console.error("getRiderMonthlyStats error:", err);
    return errorResponse(res, "Failed to get monthly stats");
  }
};
export const approveWithdrawal = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const withdrawal = await prisma.withdrawalRequest.findUnique({ where: { id }});
    if (!withdrawal) return errorResponse(res, "Withdrawal not found");

    if (withdrawal.status !== "PENDING")
      return errorResponse(res, "Already processed");

    // Deduct balance instantly
    await prisma.vendorWallet.update({
      where: { vendorId: withdrawal.vendorId },
      data: {
        balance: { decrement: withdrawal.amount },
        withdrawn: { increment: withdrawal.amount },
        walletTransaction: {
          create: {
            amount: withdrawal.amount,
            type: "DEBIT",
            vendorId: withdrawal.vendorId,
            remark: "Withdrawal approved"
          }
        }
      }
    });

    // Now call Paystack
    const transfer = await axios.post(
      "https://api.paystack.co/transfer",
      {
        source: "balance",
        amount: withdrawal.amount * 100,
        recipient: {
          type: "nuban",
          name: withdrawal.accountName,
          account_number: withdrawal.accountNumber,
          bank_code: withdrawal.bankCode,
          currency: "NGN",
        }
      },
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET}` } }
    );

    await prisma.withdrawalRequest.update({
      where: { id },
      data: { status: "COMPLETED" }
    });

    return successResponse(res, "Withdrawal approved & transferred", transfer.data);

  } catch (err) {
    console.log(err);
    return errorResponse(res, "Withdrawal approval failed");
  }
};
export const rejectWithdrawal = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const withdrawal = await prisma.withdrawalRequest.update({
    where: { id },
    data: { status: "REJECTED" }
  });

  return successResponse(res, "Withdrawal rejected", withdrawal);
};
