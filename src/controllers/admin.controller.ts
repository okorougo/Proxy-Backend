import { Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";

// Dashboard overview (counts, stats)
export const getDashboardStats = async (req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.count();
    const listings = await prisma.listing.count();
    const kycPending = await prisma.kycVerification.count({ where: { status: "PENDING" } });
    const reports = await prisma.report.count({ where: { resolved: false } });

    res.json({
      users,
      listings,
      kycPending,
      reports,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load dashboard stats" });
  }
};

// List all KYC requests
export const listKycRequests = async (req: AuthRequest, res: Response) => {
  const kycs = await prisma.kycVerification.findMany({ include: { user: true } });
  res.json(kycs);
};

// Approve/Reject KYC
export const updateKycStatus = async (req: AuthRequest, res: Response) => {
  const { kycId, status } = req.body; // status = "APPROVED" | "REJECTED"
  const updated = await prisma.kycVerification.update({
    where: { id: kycId },
    data: { status },
  });
  res.json(updated);
};

// List reports
export const listReports = async (req: AuthRequest, res: Response) => {
  const reports = await prisma.report.findMany({
    include: { reviewedBy: true, reporter: true },
  });
  res.json(reports);
};

// Resolve report
export const resolveReport = async (req: AuthRequest, res: Response) => {
  const { reportId } = req.body;
  const updated = await prisma.report.update({
    where: { id: reportId },
    data: { resolved: true },
  });
  res.json(updated);
};
export const listUsers = async (req: AuthRequest, res: Response) => {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, isBanned: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(users);
};

// Ban user
export const banUser = async (req: AuthRequest, res: Response) => {
  const { userId } = req.body;
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { isBanned: true },
  });
  res.json({ message: "User banned", user: updated });
};

// Unban user
export const unbanUser = async (req: AuthRequest, res: Response) => {
  const { userId } = req.body;
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { isBanned: false },
  });
  res.json({ message: "User unbanned", user: updated });
};

// Promote to Moderator or Admin
export const updateUserRole = async (req: AuthRequest, res: Response) => {
  const { userId, role } = req.body; // role = "USER" | "MODERATOR" | "ADMIN"
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { role },
  });
  res.json({ message: `User role updated to ${role}`, user: updated });
};

export const listAllListings = async (req: AuthRequest, res: Response) => {
  const listings = await prisma.listing.findMany({
    include: { seller: { select: { id: true, email: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(listings);
};

// Approve listing
export const approveListing = async (req: AuthRequest, res: Response) => {
  const { listingId } = req.body;
  const updated = await prisma.listing.update({
    where: { id: listingId },
    data: { status: "APPROVED" },
  });
  res.json({ message: "Listing approved", listing: updated });
};

// Reject listing
export const rejectListing = async (req: AuthRequest, res: Response) => {
  const { listingId } = req.body;
  const updated = await prisma.listing.update({
    where: { id: listingId },
    data: { status: "REJECTED" },
  });
  res.json({ message: "Listing rejected", listing: updated });
};

// Remove listing (admin action)
export const removeListing = async (req: AuthRequest, res: Response) => {
  const { listingId } = req.body;
  const updated = await prisma.listing.update({
    where: { id: listingId },
    data: { status: "REMOVED" },
  });
  res.json({ message: "Listing removed by admin", listing: updated });
};