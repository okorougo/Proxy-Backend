import prisma from "./prisma";

/**
 * Initialize platform wallets (ESCROW and REVENUE)
 * Call this once during app startup or setup
 */
export const initializePlatformWallets = async () => {
  try {
    // Check if wallets already exist
    const escrowWallet = await prisma.platformWallet.findFirst({
      where: { type: "ESCROW" }
    });

    const revenueWallet = await prisma.platformWallet.findFirst({
      where: { type: "REVENUE" }
    });

    let escrowCreated = false;
    let revenueCreated = false;
    let commissionCreated = false;

    if (!escrowWallet) {
      await prisma.platformWallet.create({
        data: {
          type: "ESCROW",
          balance: 0
        }
      });
      escrowCreated = true;
      console.log("✅ ESCROW wallet created");
    } else {
      console.log("✅ ESCROW wallet already exists");
    }

    if (!revenueWallet) {
      await prisma.platformWallet.create({
        data: {
          type: "REVENUE",
          balance: 0
        }
      });
      revenueCreated = true;
      console.log("✅ REVENUE wallet created");
    } else {
      console.log("✅ REVENUE wallet already exists");
    }

    // Also ensure default commission config exists
    const commissionConfig = await prisma.commissionConfig.findFirst({
      where: { isActive: true }
    });

    if (!commissionConfig) {
      await prisma.commissionConfig.create({
        data: {
          percentage: 10, // Default 10% commission
          isActive: true
        }
      });
      commissionCreated = true;
      console.log("✅ Commission config (10%) created");
    } else {
      console.log("✅ Commission config already exists");
    }

    console.log("✅ Platform wallets initialized successfully");

    return {
      escrowCreated,
      revenueCreated,
      commissionCreated,
      message: "Platform wallets initialization complete"
    };
  } catch (err) {
    console.error("❌ Failed to initialize platform wallets:", err);
    throw err;
  }
};
