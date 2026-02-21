import { Response ,Request} from "express";
import prisma from "../lib/prisma";
import cloudinary from "../lib/cloudinary";
import { AuthRequest } from "../middleware/auth";
import { errorResponse, successResponse } from "../utils/response";
import Stripe from "stripe";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

// Upload receipt (buyer or seller)
export const uploadReceipt = async (req: AuthRequest, res: Response) => {
  try {
    const file = (req.files as any)?.file;
    const { transactionId } = req.body;

    if (!file) return errorResponse(res, "No file uploaded");

    const tx = await prisma.transaction.findUnique({
      where: { id: transactionId },
    });
    if (!tx)
      return errorResponse(
        res,
        "Transaction not found",
        "TRANSACTION_NOT_FOUND",
        404
      );

    if (![tx.buyerId, tx.sellerId].includes(req.user!.id)) {
      return errorResponse(
        res,
        "Not authorized to upload receipt for this transaction",
        "NOT_AUTHORIZED"
      );
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

    const tx = await prisma.transaction.findUnique({
      where: { id: transactionId },
    });
    if (!tx)
      return errorResponse(
        res,
        "Transaction not found",
        "TRANSACTION_NOT_FOUND",
        404
      );

    if (![tx.buyerId, tx.sellerId].includes(req.user!.id)) {
      return errorResponse(
        res,
        "Not authorized to complete this transaction",
        "NOT_AUTHORIZED"
      );
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
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export const stripePayment =  async (req: Request, res: Response) => {

  try {
    const { amount, currency = "usd", receipt_email  } = req.body;

    if (!amount || typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    // 1️⃣ Create or reuse a customer
    const customer = await stripe.customers.create();

      const ephemeralKey = await stripe.ephemeralKeys.create(
    { customer: customer.id },
    { apiVersion: '2024-09-30.acacia' }
  );

    // // 2️⃣ Create customer session (required for PaymentSheet on mobile)
    // const customerSession = await stripe.customerSessions.create({
    //   customer: customer.id,
    //   components: {
    //     mobile_payment_element: {
    //       enabled: true,
    //       features: {
    //         payment_method_save: "enabled",
    //         payment_method_remove: "enabled",
    //         payment_method_redisplay: "enabled",
    //       },
    //     },
    //   },
    // });
  
    // 3️⃣ Create Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency,
      receipt_email,
      customer: customer.id,
      automatic_payment_methods: { enabled: true },
    });

    return res.json({
      clientSecret: paymentIntent.client_secret,
      ephemeralKey: ephemeralKey.secret,
    customer: customer.id,
    });
   
  } catch (err: any) {
    console.error("create-payment-intent error", err);
    return res
      .status(500)
      .json({ error: err.message || "Internal server error" });
  }
};

// --- Optional: Webhook endpoint to listen for async events (3DS, succeeded, failed) ---
// To use webhooks securely, set STRIPE_WEBHOOK_SECRET and send raw body for verification
// Example config: use raw body only on this route

// ============================================
// 🎯 CUSTOMER WALLET FUNCTIONS
// ============================================
/**
 * Fund customer wallet via Paystack
 */
export const fundWalletPaystack = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { amount, reference } = req.body;

    if (!userId) return errorResponse(res, "Unauthorized", "UNAUTHORIZED", 401);
    if (!amount || amount <= 0) return errorResponse(res, "Invalid amount", "INVALID_AMOUNT", 400);
    if (!reference) return errorResponse(res, "Payment reference required", "MISSING_REFERENCE", 400);

    // Verify payment with Paystack
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    if (!response.data.status) {
      return errorResponse(res, "Payment verification failed", "PAYMENT_FAILED", 400);
    }

    const paymentData = response.data.data;
    if (paymentData.status !== "success") {
      return errorResponse(res, "Payment was not successful", "PAYMENT_NOT_SUCCESS", 400);
    }

    const amountInNaira = paymentData.amount / 100; // Paystack returns in kobo

    // Ensure customer wallet exists
    let wallet = await prisma.customerWallet.findUnique({ where: { userId } });
    if (!wallet) {
      wallet = await prisma.customerWallet.create({
        data: { userId, balance: 0 }
      });
    }

    // Update wallet and create transaction
    const updated = await prisma.$transaction(async (tx) => {
      // Credit wallet
      const updatedWallet = await tx.customerWallet.update({
        where: { userId },
        data: { balance: { increment: amountInNaira } }
      });

      // Log transaction
      await tx.customerWalletTransaction.create({
        data: {
          walletId: wallet!.id,
          amount: amountInNaira,
          type: "CREDIT",
          reference: paymentData.reference
        }
      });

      return updatedWallet;
    });

    return successResponse(res, "Wallet funded successfully", {
      walletId: updated.id,
      balance: updated.balance,
      amountAdded: amountInNaira,
      currency: updated.currency
    });
  } catch (err: any) {
    console.error("fundWalletPaystack error:", err);
    return errorResponse(res, err.message || "Failed to fund wallet", "FUND_WALLET_ERROR", 500);
  }
};

/**
 * Fund customer wallet via Stripe
 */
export const fundWalletStripe = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { amount, paymentIntentId } = req.body;

    if (!userId) return errorResponse(res, "Unauthorized", "UNAUTHORIZED", 401);
    if (!amount || amount <= 0) return errorResponse(res, "Invalid amount", "INVALID_AMOUNT", 400);
    if (!paymentIntentId) return errorResponse(res, "Payment Intent ID required", "MISSING_INTENT_ID", 400);

    // Verify payment with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== "succeeded") {
      return errorResponse(res, "Payment was not successful", "PAYMENT_NOT_SUCCESS", 400);
    }

    // Ensure amount matches (amount is in cents from Stripe)
    const stripeAmount = paymentIntent.amount / 100;
    if (Math.abs(stripeAmount - amount) > 0.01) {
      return errorResponse(res, "Amount mismatch", "AMOUNT_MISMATCH", 400);
    }

    // Ensure customer wallet exists
    let wallet = await prisma.customerWallet.findUnique({ where: { userId } });
    if (!wallet) {
      wallet = await prisma.customerWallet.create({
        data: { userId, balance: 0, currency: "USD" }
      });
    }

    // Update wallet and create transaction
    const updated = await prisma.$transaction(async (tx) => {
      // Credit wallet
      const updatedWallet = await tx.customerWallet.update({
        where: { userId },
        data: { balance: { increment: amount } }
      });

      // Log transaction
      await tx.customerWalletTransaction.create({
        data: {
          walletId: wallet!.id,
          amount: amount,
          type: "CREDIT",
          reference: paymentIntentId
        }
      });

      return updatedWallet;
    });

    return successResponse(res, "Wallet funded via Stripe successfully", {
      walletId: updated.id,
      balance: updated.balance,
      amountAdded: amount,
      currency: updated.currency,
      paymentMethod: "stripe"
    });
  } catch (err: any) {
    console.error("fundWalletStripe error:", err);
    return errorResponse(res, err.message || "Failed to fund wallet via Stripe", "FUND_WALLET_ERROR", 500);
  }
};

/**
 * Get customer wallet balance
 */
export const getWalletBalance = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return errorResponse(res, "Unauthorized", "UNAUTHORIZED", 401);

    let wallet = await prisma.customerWallet.findUnique({ where: { userId } });
    if (!wallet) {
      wallet = await prisma.customerWallet.create({
        data: { userId, balance: 0 }
      });
    }

    return successResponse(res, "Wallet balance fetched", {
      walletId: wallet.id,
      balance: wallet.balance,
      currency: wallet.currency,
      updatedAt: wallet.updatedAt
    });
  } catch (err) {
    console.error("getWalletBalance error:", err);
    return errorResponse(res, "Failed to fetch wallet balance");
  }
};

/**
 * Get wallet transaction history
 */
export const getWalletTransactionHistory = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { limit = 20, skip = 0 } = req.query;

    if (!userId) return errorResponse(res, "Unauthorized", "UNAUTHORIZED", 401);

    const wallet = await prisma.customerWallet.findUnique({ where: { userId } });
    if (!wallet) return errorResponse(res, "Wallet not found", "WALLET_NOT_FOUND", 404);

    const transactions = await prisma.customerWalletTransaction.findMany({
      where: { walletId: wallet.id },
      take: Number(limit),
      skip: Number(skip),
      orderBy: { createdAt: "desc" }
    });

    const total = await prisma.customerWalletTransaction.count({
      where: { walletId: wallet.id }
    });

    return successResponse(res, "Wallet transactions fetched", {
      transactions,
      total,
      limit: Number(limit),
      skip: Number(skip),
      walletBalance: wallet.balance
    });
  } catch (err) {
    console.error("getWalletTransactionHistory error:", err);
    return errorResponse(res, "Failed to fetch transaction history");
  }
};

// ============================================
// 💰 ESCROW & RELEASE FUNCTIONS
// ============================================

/**
 * Release funds from escrow after 3 days or manual trigger
 * Call this via cron job or manual endpoint
 */
export const releaseEscrowFunds = async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    
    // Find all transactions ready for release
    // releaseAt <= now AND escrowStatus = "HELD"
    const transactionsToRelease = await prisma.transaction.findMany({
      where: {
        escrowStatus: "HELD",
        releaseAt: { lte: now }
      },
      include: {
        order: true,
        seller: true
      }
    });

    if (transactionsToRelease.length === 0) {
      return successResponse(res, "No escrow funds to release", { count: 0 });
    }

    let releasedCount = 0;

    await prisma.$transaction(async (tx) => {
      for (const transaction of transactionsToRelease) {
        const vendorAmount = Number(transaction.vendorAmount || 0);
        const commissionAmount = Number(transaction.commissionAmount || 0);

        // Update transaction status
        await tx.transaction.update({
          where: { id: transaction.id },
          data: { escrowStatus: "RELEASED" }
        });

        // Find or create escrow and revenue wallets
        const escrowWallet = await tx.platformWallet.findFirst({
          where: { type: "ESCROW" }
        });
        const revenueWallet = await tx.platformWallet.findFirst({
          where: { type: "REVENUE" }
        });

        if (!escrowWallet || !revenueWallet) {
          throw new Error("Platform wallets not found");
        }

        // Move from ESCROW to REVENUE and Vendor
        await tx.platformWallet.update({
          where: { id: escrowWallet.id },
          data: {
            balance: { decrement: Number(transaction.amountCents) / 100 }
          }
        });

        // Credit platform revenue
        await tx.platformWallet.update({
          where: { id: revenueWallet.id },
          data: {
            balance: { increment: commissionAmount }
          }
        });

        // Credit vendor wallet
        await tx.vendorWallet.update({
          where: { vendorId: transaction.sellerId },
          data: {
            balance: { increment: vendorAmount },
            totalEarned: { increment: vendorAmount },
            walletTransaction: {
              create: {
                amount: vendorAmount,
                type: "CREDIT",
                remark: `Escrow released for order ${transaction.orderId.slice(0, 6)}`,
                vendorId: transaction.sellerId
              }
            }
          }
        });

        releasedCount++;
      }
    });

    return successResponse(res, `Escrow funds released for ${releasedCount} transactions`, {
      count: releasedCount,
      totalAmount: transactionsToRelease.reduce((sum, t) => sum + Number(t.vendorAmount || 0), 0)
    });
  } catch (err: any) {
    console.error("releaseEscrowFunds error:", err);
    return errorResponse(res, err.message || "Failed to release escrow funds");
  }
};

/**
 * Dispute order and initiate refund from escrow
 */
export const disputeOrder = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { orderId, reason } = req.body;

    if (!userId) return errorResponse(res, "Unauthorized", "UNAUTHORIZED", 401);
    if (!orderId || !reason) return errorResponse(res, "Order ID and reason required");

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { transaction: true }
    });

    if (!order) return errorResponse(res, "Order not found", "ORDER_NOT_FOUND", 404);
    if (order.userId !== userId) {
      return errorResponse(res, "Not authorized to dispute this order", "NOT_AUTHORIZED");
    }

    if (order.transaction?.escrowStatus !== "HELD") {
      return errorResponse(res, "Can only dispute orders with held escrow", "INVALID_STATE");
    }

    // Create dispute and process refund
    const result = await prisma.$transaction(async (tx) => {
      // Mark order as disputed
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { disputed: true }
      });

      // Update transaction to refunded
      const updatedTransaction = await tx.transaction.update({
        where: { id: order.transaction!.id },
        data: { escrowStatus: "REFUNDED" }
      });

      const totalAmount = Number(updatedTransaction.amountCents) / 100;

      // Refund to customer wallet
      let wallet = await tx.customerWallet.findUnique({ where: { userId } });
      if (!wallet) {
        wallet = await tx.customerWallet.create({
          data: { userId, balance: 0 }
        });
      }

      await tx.customerWallet.update({
        where: { userId },
        data: { balance: { increment: totalAmount } }
      });

      // Log refund transaction
      await tx.customerWalletTransaction.create({
        data: {
          walletId: wallet.id,
          amount: totalAmount,
          type: "CREDIT",
          reference: `REFUND_${orderId.slice(0, 6)}`
        }
      });

      // Deduct from escrow wallet
      const escrowWallet = await tx.platformWallet.findFirst({
        where: { type: "ESCROW" }
      });
      if (escrowWallet) {
        await tx.platformWallet.update({
          where: { id: escrowWallet.id },
          data: { balance: { decrement: totalAmount } }
        });
      }

      return { order: updatedOrder, transaction: updatedTransaction, refundedAmount: totalAmount };
    });

    return successResponse(res, "Order disputed and refund initiated", result);
  } catch (err: any) {
    console.error("disputeOrder error:", err);
    return errorResponse(res, err.message || "Failed to dispute order");
  }
};

/**
 * Get commission configuration
 */
export const getCommissionConfig = async (req: Request, res: Response) => {
  try {
    const config = await prisma.commissionConfig.findFirst({
      where: { isActive: true }
    });

    if (!config) {
      return errorResponse(res, "Commission config not found", "CONFIG_NOT_FOUND", 404);
    }

    return successResponse(res, "Commission config fetched", {
      percentage: config.percentage,
      isActive: config.isActive
    });
  } catch (err) {
    console.error("getCommissionConfig error:", err);
    return errorResponse(res, "Failed to fetch commission config");
  }
};

/**
 * Set commission configuration (Admin only)
 */
export const setCommissionConfig = async (req: AuthRequest, res: Response) => {
  try {
    const { percentage } = req.body;

    if (percentage == null || percentage < 0 || percentage > 100) {
      return errorResponse(res, "Invalid percentage (must be 0-100)", "INVALID_PERCENTAGE", 400);
    }

    // Deactivate existing configs
    await prisma.commissionConfig.updateMany({
      where: { isActive: true },
      data: { isActive: false }
    });

    // Create new active config
    const config = await prisma.commissionConfig.create({
      data: { percentage, isActive: true }
    });

    return successResponse(res, "Commission config updated", {
      percentage: config.percentage,
      isActive: config.isActive
    });
  } catch (err: any) {
    console.error("setCommissionConfig error:", err);
    return errorResponse(res, err.message || "Failed to set commission config");
  }
};

// ============================================
// 💳 VENDOR WITHDRAWAL FUNCTIONS
// ============================================

/**
 * Create withdrawal request
 */
export const requestWithdrawal = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { amount, bankName, accountName, accountNumber, bankCode } = req.body;

    if (!userId) return errorResponse(res, "Unauthorized", "UNAUTHORIZED", 401);
    if (!amount || amount <= 0) return errorResponse(res, "Invalid amount");
    if (!bankName || !accountName || !accountNumber || !bankCode) {
      return errorResponse(res, "Bank details required");
    }

    // Find vendor
    const vendor = await prisma.vendorApplication.findUnique({
      where: { userId }
    });
    if (!vendor) return errorResponse(res, "Vendor not found", "VENDOR_NOT_FOUND", 404);

    // Check wallet balance
    const wallet = await prisma.vendorWallet.findUnique({
      where: { vendorId: vendor.id }
    });
    if (!wallet || wallet.balance < amount) {
      return errorResponse(res, "Insufficient wallet balance", "INSUFFICIENT_BALANCE");
    }

    // Create withdrawal request
    const withdrawal = await prisma.withdrawalRequest.create({
      data: {
        vendorId: vendor.id,
        amount,
        bankName,
        accountName,
        accountNumber,
        bankCode,
        status: "PENDING"
      }
    });

    return successResponse(res, "Withdrawal request created", {
      withdrawalId: withdrawal.id,
      amount: withdrawal.amount,
      status: withdrawal.status,
      createdAt: withdrawal.createdAt
    });
  } catch (err: any) {
    console.error("requestWithdrawal error:", err);
    return errorResponse(res, err.message || "Failed to create withdrawal request");
  }
};

/**
 * Get withdrawal requests (vendor or admin)
 */
export const getWithdrawalRequests = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return errorResponse(res, "Unauthorized", "UNAUTHORIZED", 401);

    const vendor = await prisma.vendorApplication.findUnique({
      where: { userId }
    });
    if (!vendor) return errorResponse(res, "Vendor not found", "VENDOR_NOT_FOUND", 404);

    const withdrawals = await prisma.withdrawalRequest.findMany({
      where: { vendorId: vendor.id },
      orderBy: { createdAt: "desc" }
    });

    return successResponse(res, "Withdrawal requests fetched", withdrawals);
  } catch (err: any) {
    console.error("getWithdrawalRequests error:", err);
    return errorResponse(res, err.message || "Failed to fetch withdrawal requests");
  }
};

/**
 * Approve withdrawal (Admin only)
 */
export const approveWithdrawal = async (req: AuthRequest, res: Response) => {
  try {
    const { withdrawalId } = req.params;

    const withdrawal = await prisma.withdrawalRequest.findUnique({
      where: { id: withdrawalId }
    });
    if (!withdrawal) return errorResponse(res, "Withdrawal not found");

    // Deduct from vendor wallet
    const updated = await prisma.$transaction(async (tx) => {
      // Update withdrawal status
      const updatedWithdrawal = await tx.withdrawalRequest.update({
        where: { id: withdrawalId },
        data: { status: "APPROVED" }
      });

      // Deduct from vendor wallet
      await tx.vendorWallet.update({
        where: { vendorId: withdrawal.vendorId },
        data: {
          balance: { decrement: Number(withdrawal.amount) },
          withdrawn: { increment: Number(withdrawal.amount) },
          walletTransaction: {
            create: {
              amount: Number(withdrawal.amount),
              type: "DEBIT",
              remark: `Withdrawal approved: ${withdrawal.accountNumber}`,
              vendorId: withdrawal.vendorId
            }
          }
        }
      });

      return updatedWithdrawal;
    });

    return successResponse(res, "Withdrawal approved", updated);
  } catch (err: any) {
    console.error("approveWithdrawal error:", err);
    return errorResponse(res, err.message || "Failed to approve withdrawal");
  }
};

/**
 * Reject withdrawal (Admin only)
 */
export const rejectWithdrawal = async (req: AuthRequest, res: Response) => {
  try {
    const { withdrawalId } = req.params;
    const { reason } = req.body;

    const withdrawal = await prisma.withdrawalRequest.update({
      where: { id: withdrawalId },
      data: { status: "REJECTED" }
    });

    return successResponse(res, "Withdrawal rejected", withdrawal);
  } catch (err: any) {
    console.error("rejectWithdrawal error:", err);
    return errorResponse(res, err.message || "Failed to reject withdrawal");
  }
};

// Stripe webhook endpoint can be added later if needed
