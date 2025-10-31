import { Response } from "express";
import prisma from "../lib/prisma";
import cloudinary from "../lib/cloudinary";
import { AuthRequest } from "../middleware/auth";
import { errorResponse, successResponse } from "../utils/response";


// Upload receipt (buyer or seller)
export const uploadReceipt = async (req: AuthRequest, res: Response) => {
  try {
    const file = (req.files as any)?.file;
    const { transactionId } = req.body;

    if (!file) return errorResponse(res, "No file uploaded");

    const tx = await prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!tx) return errorResponse(res, "Transaction not found", "TRANSACTION_NOT_FOUND", 404);

    if (![tx.buyerId, tx.sellerId].includes(req.user!.id)) {
      return errorResponse(res, "Not authorized to upload receipt for this transaction", "NOT_AUTHORIZED");
    }

    const result = await cloudinary.uploader.upload(file.tempFilePath, {
      resource_type: "auto",
      folder: `transactions/${transactionId}`,
    });

    const updated = await prisma.transaction.update({
      where: { id: transactionId },
      data: { receiptUrl: result.secure_url },
    });

    return successResponse(res, "Receipt uploaded successfully", updated);
  } catch (err) {
    console.error(err);
    return errorResponse(res, "Receipt upload failed");
  }
};

// Mark transaction completed (manual for MVP)
export const completeTransaction = async (req: AuthRequest, res: Response) => {
  try {
    const { transactionId } = req.body;

    const tx = await prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!tx) return errorResponse(res, "Transaction not found", "TRANSACTION_NOT_FOUND", 404);

    if (![tx.buyerId, tx.sellerId].includes(req.user!.id)) {
      return errorResponse(res, "Not authorized to complete this transaction", "NOT_AUTHORIZED");
    }

    const updated = await prisma.transaction.update({
      where: { id: transactionId },
      data: { status: "COMPLETED" },
    });

    return successResponse(res, "Transaction completed successfully", updated);
  } catch (err) {
    console.error(err);
    return errorResponse(res, "Failed to complete transaction");
  }
};
