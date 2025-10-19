import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import { errorResponse, successResponse } from "../utils/response";

// User submits report
export const createReport = async (req: AuthRequest, res: Response) => {
  try {
    const { targetType, targetId, reason } = req.body;

    const report = await prisma.report.create({
      data: {
        reporterId: req.user!.id,
        targetType,
        targetId,
        reason,
      },
    });

    return successResponse(res, "Report submitted successfully", report);
  } catch (err) {
    console.error(err);
    return errorResponse(res, "Failed to submit report");
  }
};

// Admin fetch reports
export const getReports = async (req: Request, res: Response) => {
  try {
    const reports = await prisma.report.findMany({
      where: { status: "PENDING" },
      include: { reporter: { select: { id: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });

    
    return  successResponse(res, "Reports fetched successfully", reports);
  } catch (err) {
    console.error(err);
    return errorResponse(res, "Failed to fetch reports");
  }
};

// Admin resolve report
export const resolveReport = async (req: AuthRequest, res: Response) => {
  try {
    const { reportId, action, note } = req.body;

    const report = await prisma.report.update({
      where: { id: reportId },
      data: {
        status: action === "approve" ? "ACTIONED" : "REJECTED",
        adminNote: note,
        reviewedById: req.user!.id,
        reviewedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: req.user!.id,
        action: "REPORT_" + action.toUpperCase(),
        meta: { reportId, note },
      },
    });

    return successResponse(res, "Report resolved successfully", report);
  } catch (err) {
    console.error(err);
    return errorResponse(res, "Failed to resolve report");
  }
};
