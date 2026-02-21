import { Router } from "express";
import fileUpload from "express-fileupload";
import {  
  uploadReceipt, 
  completeTransaction, 
  stripePayment,
  fundWalletPaystack,
  fundWalletStripe,
  getWalletBalance,
  getWalletTransactionHistory,
  releaseEscrowFunds,
  disputeOrder,
  getCommissionConfig,
  setCommissionConfig,
  requestWithdrawal,
  getWithdrawalRequests,
  approveWithdrawal,
  rejectWithdrawal
} from "../controllers/payment.controller";
import { authMiddleware } from "../middleware/auth";

const router = Router();

router.use(fileUpload({ useTempFiles: true }));

// Buyer creates a transaction
// router.post("/", authMiddleware, createTransaction);

// Buyer/Seller uploads receipt
router.post("/receipt", authMiddleware, uploadReceipt);

// Buyer or Seller marks transaction complete
router.post("/complete", authMiddleware, completeTransaction);
router.post("/create-payment-intent", authMiddleware, stripePayment);

// ========== WALLET ENDPOINTS ==========

// Fund wallet via Paystack
router.post("/wallet/fund-paystack", authMiddleware, fundWalletPaystack);

// Fund wallet via Stripe
router.post("/wallet/fund-stripe", authMiddleware, fundWalletStripe);

// Get wallet balance
router.get("/wallet/balance", authMiddleware, getWalletBalance);

// Get wallet transaction history
router.get("/wallet/history", authMiddleware, getWalletTransactionHistory);

// ========== ESCROW ENDPOINTS ==========

// Release escrow funds (cron or admin triggered)
router.post("/escrow/release", authMiddleware, releaseEscrowFunds);

// Dispute order and initiate refund
router.post("/orders/dispute", authMiddleware, disputeOrder);

// ========== COMMISSION CONFIG ENDPOINTS ==========

// Get current commission configuration
router.get("/commission/config", getCommissionConfig);

// Set commission configuration (Admin only)
router.post("/commission/config", authMiddleware, setCommissionConfig);

// ========== VENDOR WITHDRAWAL ENDPOINTS ==========

// Request withdrawal
router.post("/withdrawals/request", authMiddleware, requestWithdrawal);

// Get withdrawal requests
router.get("/withdrawals/requests", authMiddleware, getWithdrawalRequests);

// Approve withdrawal (Admin only)
router.post("/withdrawals/:withdrawalId/approve", authMiddleware, approveWithdrawal);

// Reject withdrawal (Admin only)
router.post("/withdrawals/:withdrawalId/reject", authMiddleware, rejectWithdrawal);

export default router;
