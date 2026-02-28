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


// create payment intent for funding wallet
export const createWalletStripeIntent = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { amountNgn, receipt_email } = req.body;

    if (!userId) return errorResponse(res, "Unauthorized", "UNAUTHORIZED", 401);
    if (!amountNgn || typeof amountNgn !== "number" || amountNgn <= 0) {
      return errorResponse(res, "Invalid amount", "INVALID_AMOUNT", 400);
    }

    // convert NGN to USD cents using the same rate logic used when crediting wallet
    const usdToNgn = await getUsdToNgnRate();
    const usdAmount = amountNgn / usdToNgn;
    const usdCents = Math.round(usdAmount * 100);
    if (usdCents <= 0) {
      return errorResponse(res, "Amount too small after currency conversion", "INVALID_AMOUNT", 400);
    }

    // create a fresh Stripe customer
    const customer = await stripe.customers.create();
    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customer.id },
      { apiVersion: '2024-09-30.acacia' }
    );

    // store the original NGN amount and rate so we can verify later with the
    // exact same numbers instead of re‑fetching a possibly changed rate
    const paymentIntent = await stripe.paymentIntents.create({
      amount: usdCents,
      currency: 'usd',
      receipt_email,
      customer: customer.id,
      automatic_payment_methods: { enabled: true },
      metadata: {
        amountNgn: amountNgn.toString(),
        usdToNgn: usdToNgn.toString(),
      },
    });

    return res.json({
      clientSecret: paymentIntent.client_secret,
      ephemeralKey: ephemeralKey.secret,
      customer: customer.id,
      usdCents,
    });
  } catch (err: any) {
    console.error("createWalletStripeIntent error", err);
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

// helper used by fundWalletStripe
async function getUsdToNgnRate(): Promise<number> {
  // prefer explicit environment variable so you can lock a rate during testing/deployment
  const configured = parseFloat(process.env.USD_TO_NGN_RATE || "");
  if (configured && configured > 0) {
    return configured;
  }

  // fall back to a simple public API if env var is missing or invalid
  try {
    const resp = await axios.get("https://api.exchangerate-api.com/v4/latest/USD");
    const rate = resp.data?.rates?.NGN;
    if (rate && typeof rate === "number" && rate > 0) {
      return rate;
    }
  } catch (e) {
    console.warn("failed to fetch live USD/NGN rate, using fallback", e);
  }

  // final fallback hard‑coded value
  return 1100;
}

export const fundWalletStripe = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    // frontend should include the NGN amount they intended to add (for logging)
    const { amountNgn, paymentIntentId } = req.body;

    if (!userId) return errorResponse(res, "Unauthorized", "UNAUTHORIZED", 401);
    if (!paymentIntentId) return errorResponse(res, "Payment Intent ID required", "MISSING_INTENT_ID", 400);

    // Verify payment with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== "succeeded") {
      return errorResponse(res, "Payment was not successful", "PAYMENT_NOT_SUCCESS", 400);
    }

    // convert Stripe USD cents to NGN naira using either the rate/amount
    // recorded in metadata (preferred) or fall back to a fresh lookup if for
    // some reason metadata is missing.
    const stripeAmountCents = paymentIntent.amount;
    const amountUsd = stripeAmountCents / 100;

    // try to read stored values from metadata first
    let nairaAmount: number;
    if (paymentIntent.metadata && paymentIntent.metadata.amountNgn) {
      nairaAmount = parseFloat(paymentIntent.metadata.amountNgn);
      console.log("Using NGN amount from metadata", nairaAmount);
    } else {
      const usdToNgn = await getUsdToNgnRate();
      nairaAmount = Number((amountUsd * usdToNgn).toFixed(2));
      console.warn("Metadata missing, recalculated nairaAmount", nairaAmount);
    }


    // optional sanity check with provided amount (still keep small tolerance)
    if (amountNgn && Math.abs(amountNgn - nairaAmount) > 0.5) {
      return errorResponse(res, "NGN amount mismatch", "AMOUNT_MISMATCH", 400);
    }

    // Ensure customer wallet exists (always NGN currency)
    let wallet = await prisma.customerWallet.findUnique({ where: { userId } });
    if (!wallet) {
      wallet = await prisma.customerWallet.create({
        data: { userId, balance: 0 } // currency defaults to NGN
      });
    }

    // Update wallet and create transaction with NGN value
    const updated = await prisma.$transaction(async (tx) => {
      // Credit wallet
      const updatedWallet = await tx.customerWallet.update({
        where: { userId },
        data: { balance: { increment: nairaAmount } }
      });

      // Log transaction in Naira
      await tx.customerWalletTransaction.create({
        data: {
          walletId: wallet!.id,
          amount: nairaAmount,
          type: "CREDIT",
          reference: paymentIntentId
        }
      });

      return updatedWallet;
    });

    return successResponse(res, "Wallet funded via Stripe successfully", {
      walletId: updated.id,
      balance: updated.balance,
      amountAdded: nairaAmount,
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
        order: {
          include: {
            delivery: true
          }
        },
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
        const deliveryFee = Number(transaction.deliveryFee || 0);
        const delivery = transaction.order?.delivery;

        // Determine how to split delivery fee
        let riderEarnings = 0;
        let vendorSelfDeliveryBonus = 0;

        if (deliveryFee > 0) {
          if (delivery?.riderId) {
            // Rider picked it up → rider gets 90%, platform gets 10%
            riderEarnings = deliveryFee * 0.9;
          } else if (delivery?.isSelfDelivery) {
            // Vendor self-delivered → vendor gets full fee
            vendorSelfDeliveryBonus = deliveryFee;
          }
        }

        const totalVendorRelease = vendorAmount + vendorSelfDeliveryBonus;

        // Update transaction
        await tx.transaction.update({
          where: { id: transaction.id },
          data: {
            escrowStatus: "RELEASED",
            riderEarnings: riderEarnings > 0 ? riderEarnings : null
          }
        });

        // Find wallets
        const escrowWallet = await tx.platformWallet.findFirst({
          where: { type: "ESCROW" }
        });
        const revenueWallet = await tx.platformWallet.findFirst({
          where: { type: "REVENUE" }
        });

        if (!escrowWallet || !revenueWallet) {
          throw new Error("Platform wallets not found");
        }

        // Debit escrow
        await tx.platformWallet.update({
          where: { id: escrowWallet.id },
          data: {
            balance: { decrement: Number(transaction.amountCents) / 100 }
          }
        });

        // Credit platform (commission + 10% delivery fee if rider)
        const platformDeliveryFee = deliveryFee > 0 && delivery?.riderId ? deliveryFee * 0.1 : 0;
        await tx.platformWallet.update({
          where: { id: revenueWallet.id },
          data: {
            balance: { increment: commissionAmount + platformDeliveryFee }
          }
        });

        // Credit vendor
        await tx.vendorWallet.update({
          where: { vendorId: transaction.sellerId },
          data: {
            balance: { increment: totalVendorRelease },
            totalEarned: { increment: totalVendorRelease },
            walletTransaction: {
              create: {
                amount: totalVendorRelease,
                type: "CREDIT",
                remark: `Escrow released for order ${transaction.orderId.slice(0, 6)}${vendorSelfDeliveryBonus > 0 ? ' (self-delivery)' : ''}`,
                vendorId: transaction.sellerId
              }
            }
          }
        });

        // Credit rider if applicable
        if (riderEarnings > 0 && delivery?.riderId) {
          const rider = await tx.rider.findUnique({
            where: { id: delivery.riderId },
            include: { wallet: true }
          });

          if (rider) {
            let riderWallet = rider.wallet;
            if (!riderWallet) {
              riderWallet = await tx.riderWallet.create({
                data: { riderId: rider.id, balance: 0, totalEarned: 0 }
              });
            }

            await tx.riderWallet.update({
              where: { id: riderWallet.id },
              data: {
                balance: { increment: riderEarnings },
                totalEarned: { increment: riderEarnings },
                walletTransactions: {
                  create: {
                    amount: riderEarnings,
                    type: "CREDIT",
                    reference: delivery.id,
                    remark: `Delivery for order ${transaction.orderId.slice(0, 6)}`
                  }
                }
              }
            });
          }
        }

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

// ============================================
// 📊 PAYMENT HISTORY & TRANSACTION REPORTS
// ============================================

/**
 * Get vendor payment history with commission breakdown
 * Shows all transactions from buyers to this vendor
 */
export const getVendorPaymentHistory = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { limit = 20, skip = 0, status, startDate, endDate } = req.query;

    if (!userId) return errorResponse(res, "Unauthorized", "UNAUTHORIZED", 401);

    // Find vendor by user ID
    const vendor = await prisma.vendorApplication.findUnique({
      where: { userId }
    });
    if (!vendor) return errorResponse(res, "Vendor not found", "VENDOR_NOT_FOUND", 404);

    // Build where clause for filtering
    const whereClause: any = {
      sellerId: vendor.id
    };

    if (status) {
      whereClause.status = status;
    }

    // Date filtering
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) {
        whereClause.createdAt.gte = new Date(startDate as string);
      }
      if (endDate) {
        whereClause.createdAt.lte = new Date(endDate as string);
      }
    }

    // Fetch transactions
    const transactions = await prisma.transaction.findMany({
      where: whereClause,
      include: {
        buyer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        },
        order: {
          include: {
            listings: {
              include: {
                listing: {
                  select: {
                    id: true,
                    title: true,
                    price: true
                  }
                }
              }
            },
            delivery: {
              select: {
                fareAmount: true,
                status: true,
                etaMinutes: true,
                pickupAddress: true,
                dropoffAddress: true,
                startedAt: true,
                completedAt: true
              }
            }
          }
        }
      },
      take: Number(limit),
      skip: Number(skip),
      orderBy: { createdAt: "desc" }
    });

    // Calculate totals and format data
    const paymentHistory = transactions.map((tx) => {
      const totalAmount = Number(tx.amountCents) / 100;
      const commission = tx.commissionAmount ? Number(tx.commissionAmount) : 0;
      const netAmount = tx.vendorAmount ? Number(tx.vendorAmount) : totalAmount - commission;
      const shippingFee = tx.order?.delivery?.fareAmount ? Number(tx.order.delivery.fareAmount) : 0;

      return {
        transactionId: tx.id,
        orderId: tx.orderId,
        buyerInfo: tx.buyer,
        totalAmount,
        shippingFee,
        subtotal: totalAmount - shippingFee,
        commission,
        commissionRate: tx.commissionRate ? Number(tx.commissionRate) : 0,
        netAmount,
        currency: tx.currency,
        paymentMethod: tx.method,
        status: tx.status,
        escrowStatus: tx.escrowStatus,
        items: tx.order?.listings?.map((item) => ({
          id: item.listing?.id,
          title: item.listing?.title,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.unitPrice * item.quantity
        })) || [],
        delivery: {
          shippingFee: shippingFee,
          status: tx.order?.delivery?.status,
          etaMinutes: tx.order?.delivery?.etaMinutes,
          pickupAddress: tx.order?.delivery?.pickupAddress,
          dropoffAddress: tx.order?.delivery?.dropoffAddress,
          startedAt: tx.order?.delivery?.startedAt,
          completedAt: tx.order?.delivery?.completedAt
        },
        receiptUrl: tx.receiptUrl,
        createdAt: tx.createdAt,
        updatedAt: tx.updatedAt,
        releaseDate: tx.releaseAt
      };
    });

    // Calculate summary stats
    const totalCount = await prisma.transaction.count({ where: whereClause });
    const totalRevenue = transactions.reduce((sum, tx) => sum + Number(tx.vendorAmount || 0), 0);
    const totalCommission = transactions.reduce((sum, tx) => sum + Number(tx.commissionAmount || 0), 0);
    const totalShipping = transactions.reduce((sum, tx) => sum + (tx.order?.delivery?.fareAmount ? Number(tx.order.delivery.fareAmount) : 0), 0);

    return successResponse(res, "Vendor payment history fetched", {
      payments: paymentHistory,
      summary: {
        totalTransactions: totalCount,
        totalRevenue,
        totalCommission,
        totalShipping,
        averageTransactionValue: totalCount > 0 ? totalRevenue / totalCount : 0
      },
      pagination: {
        limit: Number(limit),
        skip: Number(skip),
        total: totalCount,
        hasMore: Number(skip) + Number(limit) < totalCount
      }
    });
  } catch (err: any) {
    console.error("getVendorPaymentHistory error:", err);
    return errorResponse(res, err.message || "Failed to fetch payment history");
  }
};

/**
 * Get vendor payment details - single transaction breakdown
 */
export const getVendorPaymentDetail = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { transactionId } = req.params;

    if (!userId) return errorResponse(res, "Unauthorized", "UNAUTHORIZED", 401);

    const vendor = await prisma.vendorApplication.findUnique({
      where: { userId }
    });
    if (!vendor) return errorResponse(res, "Vendor not found", "VENDOR_NOT_FOUND", 404);

    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        buyer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        },
        order: {
          include: {
            listings: {
              include: {
                listing: true
              }
            },
            delivery: true
          }
        },
        review: true
      }
    });

    if (!transaction) {
      return errorResponse(res, "Transaction not found", "TRANSACTION_NOT_FOUND", 404);
    }

    // Verify authorization
    if (transaction.sellerId !== vendor.id) {
      return errorResponse(res, "Not authorized to view this transaction", "NOT_AUTHORIZED", 403);
    }

    const totalAmount = Number(transaction.amountCents) / 100;
    const commission = transaction.commissionAmount ? Number(transaction.commissionAmount) : 0;
    const netAmount = transaction.vendorAmount ? Number(transaction.vendorAmount) : totalAmount - commission;
    const shippingFee = transaction.order?.delivery?.fareAmount ? Number(transaction.order.delivery.fareAmount) : 0;

    return successResponse(res, "Transaction details fetched", {
      transactionId: transaction.id,
      orderId: transaction.orderId,
      buyerInfo: transaction.buyer,
      paymentBreakdown: {
        subtotal: totalAmount - shippingFee,
        shippingFee,
        grossAmount: totalAmount,
        platformCommission: {
          amount: commission,
          percentage: transaction.commissionRate ? Number(transaction.commissionRate) : 0
        },
        netEarnings: netAmount
      },
      items: transaction.order?.listings?.map((item) => ({
        id: item.listing?.id,
        title: item.listing?.title,
        description: item.listing?.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.unitPrice * item.quantity
      })) || [],
      delivery: {
        status: transaction.order?.delivery?.status,
        shippingFee: shippingFee,
        etaMinutes: transaction.order?.delivery?.etaMinutes,
        pickupAddress: transaction.order?.delivery?.pickupAddress,
        dropoffAddress: transaction.order?.delivery?.dropoffAddress,
        startedAt: transaction.order?.delivery?.startedAt,
        completedAt: transaction.order?.delivery?.completedAt
      },
      paymentDetails: {
        method: transaction.method,
        status: transaction.status,
        currency: transaction.currency,
        receiptUrl: transaction.receiptUrl
      },
      escrowDetails: {
        status: transaction.escrowStatus,
        releaseDate: transaction.releaseAt
      },
      review: transaction.review && transaction.review.length > 0 ? transaction.review[0] : null,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt
    });
  } catch (err: any) {
    console.error("getVendorPaymentDetail error:", err);
    return errorResponse(res, err.message || "Failed to fetch transaction details");
  }
};

/**
 * Rider wallet balance/summary
 */
export const getRiderWalletBalance = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return errorResponse(res, "Unauthorized", "UNAUTHORIZED", 401);

    // find rider record
    const rider = await prisma.rider.findUnique({ where: { userId } });
    if (!rider) return errorResponse(res, "Rider not found", "NOT_FOUND", 404);

    let wallet = await prisma.riderWallet.findUnique({ where: { riderId: rider.id } });
    if (!wallet) {
      wallet = await prisma.riderWallet.create({
        data: { riderId: rider.id, balance: 0, totalEarned: 0 }
      });
    }

    return successResponse(res, "Rider wallet fetched", {
      walletId: wallet.id,
      balance: wallet.balance,
      totalEarned: wallet.totalEarned,
      currency: wallet.currency,
      updatedAt: wallet.updatedAt
    });
  } catch (err) {
    console.error("getRiderWalletBalance error:", err);
    return errorResponse(res, "Failed to fetch rider wallet balance");
  }
};

/**
 * Rider wallet transaction history
 */
export const getRiderWalletHistory = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { limit = 20, skip = 0 } = req.query;

    if (!userId) return errorResponse(res, "Unauthorized", "UNAUTHORIZED", 401);

    const rider = await prisma.rider.findUnique({ where: { userId } });
    if (!rider) return errorResponse(res, "Rider not found", "NOT_FOUND", 404);

    const wallet = await prisma.riderWallet.findUnique({ where: { riderId: rider.id } });
    if (!wallet) return errorResponse(res, "Wallet not found", "WALLET_NOT_FOUND", 404);

    const transactions = await prisma.riderWalletTransaction.findMany({
      where: { riderId: rider.id },
      take: Number(limit),
      skip: Number(skip),
      orderBy: { createdAt: "desc" }
    });

    const total = await prisma.riderWalletTransaction.count({ where: { riderId: rider.id } });

    return successResponse(res, "Rider wallet history fetched", {
      transactions,
      pagination: {
        limit: Number(limit),
        skip: Number(skip),
        total,
        hasMore: Number(skip) + Number(limit) < total
      }
    });
  } catch (err) {
    console.error("getRiderWalletHistory error:", err);
    return errorResponse(res, "Failed to fetch rider wallet history");
  }
};

/**
 * Rider wallet transaction detail
 */
export const getRiderWalletTransactionDetail = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { transactionId } = req.params;

    if (!userId) return errorResponse(res, "Unauthorized", "UNAUTHORIZED", 401);

    const rider = await prisma.rider.findUnique({ where: { userId } });
    if (!rider) return errorResponse(res, "Rider not found", "NOT_FOUND", 404);

    const tx = await prisma.riderWalletTransaction.findUnique({ where: { id: transactionId } });
    if (!tx) return errorResponse(res, "Transaction not found", "TX_NOT_FOUND", 404);
    if (tx.riderId !== rider.id) return errorResponse(res, "Not authorized", "NOT_AUTHORIZED", 403);

    return successResponse(res, "Transaction detail fetched", tx);
  } catch (err) {
    console.error("getRiderWalletTransactionDetail error:", err);
    return errorResponse(res, "Failed to fetch rider transaction detail");
  }
};

/**
 * Get customer complete transaction history
 * Shows all orders, wallet transactions, payments in one unified view
 */
export const getCustomerTransactionHistory = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { limit = 20, skip = 0, type, status, startDate, endDate } = req.query;

    if (!userId) return errorResponse(res, "Unauthorized", "UNAUTHORIZED", 401);

    // Fetch orders
    const ordersWhere: any = { userId };
    if (status) ordersWhere.status = status;
    if (startDate || endDate) {
      ordersWhere.createdAt = {};
      if (startDate) ordersWhere.createdAt.gte = new Date(startDate as string);
      if (endDate) ordersWhere.createdAt.lte = new Date(endDate as string);
    }

    const orders = await prisma.order.findMany({
      where: ordersWhere,
      include: {
        transaction: {
          include: {
            seller: {
              select: {
                id: true,
                user: {
                  select: {
                    name: true,
                    email: true
                  }
                }
              }
            }
          }
        },
        listings: {
          include: {
            listing: true
          }
        },
        delivery: true,
        vendor: {
          select: {
            id: true,
            user: {
              select: {
                name: true,
                email: true,
                phone: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    // Fetch wallet transactions
    let wallet = await prisma.customerWallet.findUnique({ where: { userId } });
    if (!wallet) {
      wallet = await prisma.customerWallet.create({
        data: { userId, balance: 0 }
      });
    }

    const walletTxWhere: any = { walletId: wallet.id };
    if (startDate || endDate) {
      walletTxWhere.createdAt = {};
      if (startDate) walletTxWhere.createdAt.gte = new Date(startDate as string);
      if (endDate) walletTxWhere.createdAt.lte = new Date(endDate as string);
    }

    const walletTransactions = await prisma.customerWalletTransaction.findMany({
      where: walletTxWhere,
      orderBy: { createdAt: "desc" }
    });

    // Combine and format all transactions
    const allTransactions: any[] = [];

    // Add orders as transactions
    orders.forEach((order) => {
      const totalAmount = Number(order.totalAmount);
      const shippingFee = order.delivery?.fareAmount ? Number(order.delivery.fareAmount) : 0;
      const commission = order.transaction?.commissionAmount ? Number(order.transaction.commissionAmount) : 0;

      allTransactions.push({
        id: order.id,
        type: "ORDER",
        direction: "DEBIT",
        amount: totalAmount,
        description: `Order #${order.id.slice(0, 8)}`,
        vendor: order.vendor?.user ? {
          name: order.vendor.user.name,
          email: order.vendor.user.email,
          phone: order.vendor.user.phone
        } : null,
        items: order.listings?.map((item) => ({
          id: item.listing?.id,
          title: item.listing?.title,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.unitPrice * item.quantity
        })) || [],
        breakdown: {
          subtotal: totalAmount - shippingFee,
          shippingFee,
          commission,
          total: totalAmount
        },
        status: order.status,
        payment: {
          method: order.transaction?.method,
          status: order.transaction?.status,
          escrowStatus: order.transaction?.escrowStatus
        },
        delivery: order.delivery ? {
          status: order.delivery.status,
          shippingFee: shippingFee,
          etaMinutes: order.delivery.etaMinutes,
          pickupAddress: order.delivery.pickupAddress,
          dropoffAddress: order.delivery.dropoffAddress,
          startedAt: order.delivery.startedAt,
          completedAt: order.delivery.completedAt
        } : null,
        createdAt: order.createdAt
      });
    });

    // Add wallet transactions
    walletTransactions.forEach((wtx) => {
      allTransactions.push({
        id: wtx.id,
        type: "WALLET",
        direction: wtx.type,
        amount: Number(wtx.amount),
        description: wtx.type === "CREDIT" ? "Wallet Top-up" : "Wallet Debit",
        reference: wtx.reference,
        createdAt: wtx.createdAt
      });
    });

    // Filter by type if requested
    let filtered = allTransactions;
    if (type) {
      filtered = allTransactions.filter((tx) => tx.type === type);
    }

    // Sort by date descending
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Apply pagination
    const paginatedTransactions = filtered.slice(Number(skip), Number(skip) + Number(limit));

    // Calculate summary
    const totalDebits = filtered.filter((tx) => tx.direction === "DEBIT").reduce((sum, tx) => sum + tx.amount, 0);
    const totalCredits = filtered.filter((tx) => tx.direction === "CREDIT").reduce((sum, tx) => sum + tx.amount, 0);

    return successResponse(res, "Customer transaction history fetched", {
      transactions: paginatedTransactions,
      wallet: {
        balance: Number(wallet.balance),
        currency: wallet.currency,
        totalTransactions: walletTransactions.length
      },
      summary: {
        totalTransactions: filtered.length,
        totalOrders: orders.length,
        totalDebits,
        totalCredits,
        netBalance: totalCredits - totalDebits
      },
      pagination: {
        limit: Number(limit),
        skip: Number(skip),
        total: filtered.length,
        hasMore: Number(skip) + Number(limit) < filtered.length
      }
    });
  } catch (err: any) {
    console.error("getCustomerTransactionHistory error:", err);
    return errorResponse(res, err.message || "Failed to fetch transaction history");
  }
};

/**
 * Get customer order detail with payment breakdown
 */
export const getCustomerOrderDetail = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { orderId } = req.params;

    if (!userId) return errorResponse(res, "Unauthorized", "UNAUTHORIZED", 401);

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        transaction: {
          include: {
            seller: {
              select: {
                id: true,
                user: {
                  select: {
                    name: true,
                    email: true,
                    phone: true
                  }
                }
              }
            }
          }
        },
        listings: {
          include: {
            listing: true
          }
        },
        delivery: true,
        vendor: {
          select: {
            id: true,
            user: {
              select: {
                name: true,
                email: true
              }
            }
          }
        }
      }
    });

    if (!order) {
      return errorResponse(res, "Order not found", "ORDER_NOT_FOUND", 404);
    }

    // Verify authorization
    if (order.userId !== userId) {
      return errorResponse(res, "Not authorized to view this order", "NOT_AUTHORIZED", 403);
    }

    const totalAmount = Number(order.totalAmount);
    const shippingFee = order.delivery?.fareAmount ? Number(order.delivery.fareAmount) : 0;
    const commission = order.transaction?.commissionAmount ? Number(order.transaction.commissionAmount) : 0;

    return successResponse(res, "Order details fetched", {
      orderId: order.id,
      vendorInfo: order.vendor?.user ? {
        name: order.vendor.user.name,
        email: order.vendor.user.email
      } : null,
      items: order.listings?.map((item) => ({
        id: item.listing?.id,
        title: item.listing?.title,
        description: item.listing?.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.unitPrice * item.quantity
      })) || [],
      pricing: {
        subtotal: totalAmount - shippingFee,
        shippingFee,
        platformFee: commission,
        total: totalAmount
      },
      payment: {
        method: order.transaction?.method,
        status: order.transaction?.status,
        escrowStatus: order.transaction?.escrowStatus,
        receiptUrl: order.transaction?.receiptUrl
      },
      delivery: order.delivery ? {
        status: order.delivery.status,
        shippingFee: shippingFee,
        etaMinutes: order.delivery.etaMinutes,
        pickupAddress: order.delivery.pickupAddress,
        dropoffAddress: order.delivery.dropoffAddress,
        startedAt: order.delivery.startedAt,
        completedAt: order.delivery.completedAt
      } : null,
      orderStatus: order.status,
      serviceStatus: order.serviceStatus,
      isDigital: order.isDigital,
      disputed: order.disputed,
      createdAt: order.createdAt,
      completedAt: order.completedAt,
      confirmedAt: order.confirmedAt
    });
  } catch (err: any) {
    console.error("getCustomerOrderDetail error:", err);
    return errorResponse(res, err.message || "Failed to fetch order details");
  }
};

// Stripe webhook endpoint can be added later if needed
