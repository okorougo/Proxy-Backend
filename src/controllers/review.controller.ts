import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";

// Buyer leaves review for seller
export const createReview = async (req: AuthRequest, res: Response) => {
  try {
    const { transactionId, rating, comment } = req.body;

    const tx = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { listing: true },
    });
    if (!tx) return res.status(404).json({ error: "Transaction not found" });
    if (tx.status !== "COMPLETED") {
      return res.status(400).json({ error: "Cannot review incomplete transaction" });
    }

    if (tx.buyerId !== req.user!.id) {
      return res.status(403).json({ error: "Only buyer can leave review" });
    }

    const existing = await prisma.review.findFirst({ where: { transactionId } });
    if (existing) return res.status(400).json({ error: "Review already exists for this transaction" });

    const review = await prisma.review.create({
      data: {
        transactionId,
        reviewerId: req.user!.id,
        revieweeId: tx.sellerId,
        rating: Math.max(1, Math.min(5, Number(rating))),
        comment,
      },
    });

    res.json({ message: "Review created", review });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Create review failed" });
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

    res.json({
      reviews,
      averageRating: avg._avg.rating,
      totalReviews: avg._count.rating,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Fetch reviews failed" });
  }
};
