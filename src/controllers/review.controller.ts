import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import { errorResponse, successResponse } from "../utils/response";

// Buyer leaves review for seller
export const createReview = async (req: AuthRequest, res: Response) => {
  try {
    const { transactionId, rating, comment } = req.body;

    const tx = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { listing: true },
    });
    if (!tx) return errorResponse(res, "Transaction not found", "TRANSACTION_NOT_FOUND", 404);
    if (tx.status !== "COMPLETED") {
      return errorResponse(res, "Cannot review incomplete transaction", "INVALID_TRANSACTION");
    }

    if (tx.buyerId !== req.user!.id) {
      return errorResponse(res, "Not authorized to review this transaction", "NOT_AUTHORIZED");
    }

    const existing = await prisma.review.findFirst({ where: { transactionId } });
    if (existing) return errorResponse(res, "Review already exists for this transaction", "REVIEW_EXISTS");

    const review = await prisma.review.create({
      data: {
        transactionId,
        reviewerId: req.user!.id,
        revieweeId: tx.sellerId,
        rating: Math.max(1, Math.min(5, Number(rating))),
        comment,
      },
    });

    return successResponse(res, "Review created successfully", review);
  } catch (err) {
    console.error(err);
    return errorResponse(res, "Failed to create review");
  }
};

// Fetch reviews for a seller
export const getUserReviews = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const reviews = await prisma.review.findMany({
      where: { revieweeId: userId },
      include: {
        reviewer: { select: { id: true, name: true, email: true } },
        transaction: { include: { listing: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const avg = await prisma.review.aggregate({
      where: { revieweeId: userId },
      _avg: { rating: true },
      _count: { rating: true },
    });

    return successResponse(res, "Reviews fetched successfully", {
      reviews,
      averageRating: avg._avg.rating || 0,
      totalReviews: avg._count.rating,
    });
    
  } catch (err) {
    console.error(err);
    return errorResponse(res, "Failed to fetch reviews");
  }
};
