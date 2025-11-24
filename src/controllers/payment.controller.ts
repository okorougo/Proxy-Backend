import { Response } from "express";
import prisma from "../lib/prisma";
import cloudinary from "../lib/cloudinary";
import { AuthRequest } from "../middleware/auth";
import { errorResponse, successResponse } from "../utils/response";
import Stripe from "stripe";

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

export const stripePayment = () => async (req: AuthRequest, res: Response) => {
  if (!process.env.STRIPE_SECRET_KEY) {
    errorResponse(
      res,
      "STRIPE_SECRET_KEY is not configured in environment variables"
    );

    process.exit(1);
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: null,
  });
  const { amount, currency } = req.body;
  try {
    if (!amount || typeof amount !== "number" || amount <= 0) {
      return res
        .status(400)
        .json({
          error:
            "Invalid amount. Amount must be an integer in the smallest currency unit (e.g., kobo for NGN).",
        });
    }

    // Optionally: create a Customer first, or attach metadata to PaymentIntent.
    // Example metadata: { orderId: 'abc123', userId: 'user_1' }
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      // You can optionally set payment_method_types, e.g. ['card']
      payment_method_types: ["card"],
    });

    return res.json({ clientSecret: paymentIntent.client_secret });
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
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// // Important: Stripe requires the raw body to validate signature.
// // Use a body parser that gives you raw body; here we manually parse the raw body for the webhook.
// app.post('/payments/webhook', bodyParser.raw({ type: 'application/json' }), (req, res) => {
//   if (!endpointSecret) {
//     console.warn('No STRIPE_WEBHOOK_SECRET configured; webhook signature validation skipped (not recommended).');
//     // If not validating signature, you can still parse the event JSON, but it's insecure.
//     try {
//       const event = JSON.parse(req.body.toString());
//       // handle event.type as needed
//       console.log('Webhook event (insecure parse):', event.type);
//       res.json({ received: true });
//     } catch (e) {
//       console.error('Webhook parse error', e);
//       res.status(400).send(`Webhook Error: ${e.message}`);
//     }
//     return;
//   }

//   const sig = req.headers['stripe-signature'];

//   let event;
//   try {
//     event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
//   } catch (err) {
//     console.error('Webhook signature verification failed.', err.message);
//     return res.status(400).send(`Webhook Error: ${err.message}`);
//   }

//   // Handle the event
//   switch (event.type) {
//     case 'payment_intent.succeeded':
//       const pi = event.data.object;
//       console.log(`PaymentIntent succeeded: ${pi.id} — amount: ${pi.amount}`);
//       // TODO: mark order/Payment as paid in your DB, notify fulfillment, etc.
//       break;
//     case 'payment_intent.payment_failed':
//       const failedPI = event.data.object;
//       console.log(`PaymentIntent failed: ${failedPI.id}`, failedPI.last_payment_error);
//       break;
//     // ... handle other event types
//     default:
//       console.log(`Unhandled event type ${event.type}`);
//   }

//   res.json({ received: true });
// });

// app.listen(port, () => {
//   console.log(`Stripe payment service listening on port ${port}`);
// });
