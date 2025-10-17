import { Response } from "express";
import prisma from "../lib/prisma";
import cloudinary, { uploadToCloudinary } from "../lib/cloudinary";
import { AuthRequest } from "../middleware/auth";

export const uploadKycDocument = async (req: AuthRequest, res: Response) => {
  try {
    const file = (req.files as any)?.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const result = await cloudinary.uploader.upload(file.tempFilePath, {
      resource_type: "auto",
      folder: `kyc/${req.user!.id}`,
    });

    const media = await prisma.media.create({
      data: {
        url: result.secure_url,
        publicId: result.public_id,
        mimeType: `${result.resource_type}/${result.format}`,
        size: result.bytes,
        user: { connect: { id: req.user!.id } },
      },
    });

    // Link KYC doc to user
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { kycDocumentId: media.id },
    });

    res.json({ message: "KYC document uploaded successfully", media });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "KYC upload failed" });
  }
};

export const submitKyc = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { nin } = req.body;

    if (!nin) {
      res.status(400).json({ error: "NIN is required" });
      return;
    }

    let selfieUrl: string | undefined;
    let idCardUrl: string | undefined;

    if (req.files && "selfie" in req.files) {
      const uploaded = await uploadToCloudinary((req.files as any).selfie[0].path, "kyc/selfies");
      selfieUrl = uploaded.secure_url;
    }

    if (req.files && "idCard" in req.files) {
      const uploaded = await uploadToCloudinary((req.files as any).idCard[0].path, "kyc/idcards");
      idCardUrl = uploaded.secure_url;
    }

    const kyc = await prisma.kycVerification.upsert({
      where: { userId },
      update: { nin, selfieUrl, idCardUrl, status: "PENDING" },
      create: { userId: userId as string, nin, selfieUrl, idCardUrl },
    });

    res.json({ message: "KYC submitted successfully", kyc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "KYC submission failed" });
  }
};


export const verifyKyc = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { userId, approve } = req.body;

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isKycVerified: Boolean(approve) },
    });

    res.json({ message: approve ? "KYC verified" : "KYC rejected", user: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "KYC verification failed" });
  }
};
