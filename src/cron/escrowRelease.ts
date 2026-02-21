/**
 * Escrow Auto-Release Cron Job Setup
 * 
 * Add this to your server.ts or a separate cron configuration file
 * Install: npm install node-cron
 */

import cron from "node-cron";
import prisma from "../lib/prisma";
import { releaseTransactionEscrow } from "../utils/escrowHelper";

/**
 * Schedule automatic escrow release every hour
 * Releases funds that have been held for 3+ days
 */
export const scheduleEscrowRelease = () => {
  // Run every hour at minute 0
  cron.schedule("0 * * * *", async () => {
    try {
      const now = new Date();
      console.log(`[ESCROW CRON] Running escrow release check at ${now.toISOString()}`);

      // Find all transactions ready for release
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
        console.log("[ESCROW CRON] No transactions ready for release");
        return;
      }

      console.log(`[ESCROW CRON] Found ${transactionsToRelease.length} transactions to release`);

      let successCount = 0;
      let errorCount = 0;

      for (const transaction of transactionsToRelease) {
        try {
          await releaseTransactionEscrow(transaction.id);
          successCount++;
          console.log(`[ESCROW CRON] ✅ Released transaction ${transaction.id.slice(0, 6)} for order ${transaction.orderId.slice(0, 6)}`);
        } catch (err) {
          errorCount++;
          console.error(`[ESCROW CRON] ❌ Failed to release transaction ${transaction.id}:`, err);
        }
      }

      console.log(`[ESCROW CRON] Summary: ${successCount} released, ${errorCount} failed`);

    } catch (err) {
      console.error("[ESCROW CRON] Fatal error in escrow release job:", err);
    }
  });

  console.log("✅ Escrow auto-release cron job scheduled (runs every hour)");
};

/**
 * Alternative: Manual endpoint to trigger escrow release
 * Useful for testing or manual processing
 */
export const triggerEscrowReleaseManual = async () => {
  try {
    const now = new Date();
    
    const transactionsToRelease = await prisma.transaction.findMany({
      where: {
        escrowStatus: "HELD",
        releaseAt: { lte: now }
      }
    });

    console.log(`Manually releasing ${transactionsToRelease.length} transactions...`);

    for (const transaction of transactionsToRelease) {
      try {
        await releaseTransactionEscrow(transaction.id);
      } catch (err) {
        console.error(`Failed to release ${transaction.id}:`, err);
      }
    }

    return { released: transactionsToRelease.length };
  } catch (err) {
    console.error("Error in manual escrow release:", err);
    throw err;
  }
};

/**
 * Setup in your server.ts:
 * 
 * import { scheduleEscrowRelease } from "./cron/escrowRelease";
 * 
 * // After database connection established
 * scheduleEscrowRelease();
 */
