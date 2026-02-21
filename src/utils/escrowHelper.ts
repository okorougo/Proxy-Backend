import prisma from "../lib/prisma";

/**
 * Get current commission percentage
 */
export const getCommissionPercentage = async (): Promise<number> => {
  const config = await prisma.commissionConfig.findFirst({
    where: { isActive: true }
  });
  return config ? Number(config.percentage) : 10; // default 10%
};

/**
 * Calculate vendor amount after commission
 */
export const calculateVendorAmount = (
  totalAmount: number,
  commissionPercentage: number
): { vendorAmount: number; commissionAmount: number } => {
  const commissionAmount = totalAmount * (commissionPercentage / 100);
  const vendorAmount = totalAmount - commissionAmount;
  return { vendorAmount, commissionAmount };
};

/**
 * Get or create platform wallet by type
 */
export const getPlatformWallet = async (type: "ESCROW" | "REVENUE") => {
  let wallet = await prisma.platformWallet.findFirst({
    where: { type }
  });

  if (!wallet) {
    wallet = await prisma.platformWallet.create({
      data: { type, balance: 0 }
    });
  }

  return wallet;
};

/**
 * Release escrow for a specific transaction
 * Can be called by scheduled job or manually
 */
export const releaseTransactionEscrow = async (transactionId: string) => {
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: {
      seller: true,
      order: true
    }
  });

  if (!transaction) {
    throw new Error("Transaction not found");
  }

  if (transaction.escrowStatus !== "HELD") {
    throw new Error("Transaction escrow is not in HELD status");
  }

  const vendorAmount = Number(transaction.vendorAmount || 0);
  const commissionAmount = Number(transaction.commissionAmount || 0);
  const totalAmount = Number(transaction.amountCents) / 100;

  // Begin transaction
  await prisma.$transaction(async (tx) => {
    // Update transaction status
    await tx.transaction.update({
      where: { id: transactionId },
      data: { escrowStatus: "RELEASED" }
    });

    // Get escrow and revenue wallets
    const escrowWallet = await tx.platformWallet.findFirst({
      where: { type: "ESCROW" }
    });
    const revenueWallet = await tx.platformWallet.findFirst({
      where: { type: "REVENUE" }
    });

    if (!escrowWallet || !revenueWallet) {
      throw new Error("Platform wallets not found");
    }

    // Deduct from escrow
    await tx.platformWallet.update({
      where: { id: escrowWallet.id },
      data: {
        balance: { decrement: totalAmount }
      }
    });

    // Credit revenue
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
  });

  return { vendorAmount, commissionAmount, status: "RELEASED" };
};

/**
 * Refund escrow to customer
 * Used when order is disputed
 */
export const refundTransactionEscrow = async (
  transactionId: string,
  userId: string
) => {
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId }
  });

  if (!transaction) {
    throw new Error("Transaction not found");
  }

  if (transaction.escrowStatus !== "HELD") {
    throw new Error("Transaction escrow is not in HELD status");
  }

  const refundAmount = Number(transaction.amountCents) / 100;

  // Begin transaction
  await prisma.$transaction(async (tx) => {
    // Update transaction to refunded
    await tx.transaction.update({
      where: { id: transactionId },
      data: { escrowStatus: "REFUNDED" }
    });

    // Get or create customer wallet
    let wallet = await tx.customerWallet.findUnique({
      where: { userId }
    });

    if (!wallet) {
      wallet = await tx.customerWallet.create({
        data: { userId, balance: 0 }
      });
    }

    // Refund to customer wallet
    await tx.customerWallet.update({
      where: { userId },
      data: { balance: { increment: refundAmount } }
    });

    // Log refund transaction
    await tx.customerWalletTransaction.create({
      data: {
        walletId: wallet.id,
        amount: refundAmount,
        type: "CREDIT",
        reference: `REFUND_${transactionId.slice(0, 6)}`
      }
    });

    // Deduct from escrow wallet
    const escrowWallet = await tx.platformWallet.findFirst({
      where: { type: "ESCROW" }
    });
    if (escrowWallet) {
      await tx.platformWallet.update({
        where: { id: escrowWallet.id },
        data: {
          balance: { decrement: refundAmount }
        }
      });
    }
  });

  return { refundedAmount: refundAmount, status: "REFUNDED" };
};

/**
 * Check if transaction is ready for automatic release
 * (3 days have passed OR manually confirmed)
 */
export const isTransactionReadyForRelease = (transaction: any): boolean => {
  if (transaction.escrowStatus !== "HELD") {
    return false;
  }

  if (transaction.releaseAt && transaction.releaseAt <= new Date()) {
    return true;
  }

  // Could also check if order status is confirmed
  return false;
};

/**
 * Get wallet balance summary for user
 */
export const getWalletSummary = async (userId: string) => {
  let wallet = await prisma.customerWallet.findUnique({
    where: { userId }
  });

  if (!wallet) {
    wallet = await prisma.customerWallet.create({
      data: { userId, balance: 0 }
    });
  }

  const transactionCount = await prisma.customerWalletTransaction.count({
    where: { walletId: wallet.id }
  });

  const credits = await prisma.customerWalletTransaction.aggregate({
    where: {
      walletId: wallet.id,
      type: "CREDIT"
    },
    _sum: { amount: true }
  });

  const debits = await prisma.customerWalletTransaction.aggregate({
    where: {
      walletId: wallet.id,
      type: "DEBIT"
    },
    _sum: { amount: true }
  });

  return {
    balance: wallet.balance,
    currency: wallet.currency,
    totalCredits: credits._sum.amount || 0,
    totalDebits: debits._sum.amount || 0,
    transactionCount,
    updatedAt: wallet.updatedAt
  };
};

/**
 * Get vendor wallet summary
 */
export const getVendorWalletSummary = async (vendorId: string) => {
  let wallet = await prisma.vendorWallet.findUnique({
    where: { vendorId }
  });

  if (!wallet) {
    wallet = await prisma.vendorWallet.create({
      data: { vendorId, balance: 0, totalEarned: 0 }
    });
  }

  const pendingWithdrawals = await prisma.withdrawalRequest.aggregate({
    where: {
      vendorId,
      status: "PENDING"
    },
    _sum: { amount: true }
  });

  const completedWithdrawals = await prisma.withdrawalRequest.aggregate({
    where: {
      vendorId,
      status: "COMPLETED"
    },
    _sum: { amount: true }
  });

  return {
    balance: wallet.balance,
    totalEarned: wallet.totalEarned,
    withdrawn: wallet.withdrawn,
    currency: wallet.currency,
    availableForWithdrawal: wallet.balance,
    pendingWithdrawal: pendingWithdrawals._sum.amount || 0,
    completedWithdrawals: completedWithdrawals._sum.amount || 0,
    updatedAt: wallet.updatedAt
  };
};
