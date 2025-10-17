import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { sendEmail } from "../services/emailService";

// User applies to become vendor
export const applyVendor = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { description } = req.body;


    const existing = await prisma.vendorApplication.findUnique({ where: { userId } });
    if (existing) {
        res.status(400).json({ error: "You have already applied" });
      return;
    }
    const app = await prisma.vendorApplication.create({
      data: { userId: userId as string, description, status: "PENDING" },
    });

    res.status(201).json({ message: "Vendor application submitted", application: app });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to submit vendor application" });
  }
};

// Admin approves vendor
export const approveVendor = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const app = await prisma.vendorApplication.update({
      where: { id },
      data: { status: "APPROVED" },
      include: { user: true },
    });

    // Upgrade user role to VENDOR
    await prisma.user.update({
      where: { id: app.userId },
      data: { role: "VENDOR" },
    });

    // Notify user
    const html = `
      <div style="font-family:sans-serif">
        <h2>🎉 Vendor Access Granted!</h2>
        <p>Hello ${app.user.name || ""},</p>
        <p>Your request to become a vendor has been approved.</p>
        <p>You can now post your own listings and start selling.</p>
      </div>
    `;
    await sendEmail(app.user.email, "Vendor Access Granted", html);

    res.json({ message: "Vendor approved successfully", app });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to approve vendor" });
  }
};

// Admin rejects vendor
export const rejectVendor = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    const app = await prisma.vendorApplication.update({
      where: { id },
      data: { status: "REJECTED", rejectionNote: note },
      include: { user: true },
    });

    const html = `
      <div style="font-family:sans-serif">
        <h2>⚠️ Vendor Request Rejected</h2>
        <p>Hello ${app.user.name || ""},</p>
        <p>Unfortunately, your vendor request has been rejected at this time.</p>
        ${
          note ? `<p><b>Reason:</b> ${note}</p>` : ""
        }
        <p>You can try again after updating your profile or KYC details.</p>
      </div>
    `;
    await sendEmail(app.user.email, "Vendor Application Rejected", html);

    res.json({ message: "Vendor rejected", app });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to reject vendor" });
  }
};

export const getAllVendorApplications = async (req: Request, res: Response) => {
    try {
        const applications = await prisma.vendorApplication.findMany({
            include: { user: true },
            orderBy: { createdAt: "desc" },
        });
        res.json({ applications });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch vendor applications" });
    }
}
