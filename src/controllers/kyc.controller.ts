import { Response } from "express";
import prisma from "../lib/prisma";
import cloudinary, { uploadToCloudinary } from "../lib/cloudinary";
import { AuthRequest } from "../middleware/auth";
import { errorResponse, successResponse } from "../utils/response";
import { ninBvnService } from "../services/ninVerificationService";

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

    if (!userId) {
      return errorResponse(res, "Unauthorized");
    }

    if (!nin) {
      return errorResponse(res, "NIN is required");
    }

    let selfieUrl: string | undefined;
    let idCardUrl: string | undefined;

    const files = req.files as
      | { [fieldname: string]: Express.Multer.File[] }
      | undefined;

    if (files?.selfie?.[0]) {
      const uploaded = await uploadToCloudinary(
        files.selfie[0].buffer,
        "kyc/selfies"
      );
      selfieUrl = uploaded.secure_url;
    }

    if (files?.idCard?.[0]) {
      const uploaded = await uploadToCloudinary(
        files.idCard[0].buffer,
        "kyc/idcards"
      );
      idCardUrl = uploaded.secure_url;
    }

    const kyc = await prisma.kycVerification.upsert({
      where: { userId },
      update: { nin, selfieUrl, idCardUrl, status: "PENDING" },
      create: { userId: userId as string, nin, selfieUrl, idCardUrl },
    });

    return successResponse(res, "KYC submitted successfully", kyc);
  } catch (err) {
    console.error("submitKyc error:", err);
    return errorResponse(res, "KYC submission failed");
  }
};

export const verifyKyc = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { userId, approve, rejectionNote } = req.body;

    if (approve === "APPROVED") {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { isKycVerified: true },
      });

      const updateKycStatus = await prisma.kycVerification.update({
        where: { userId: userId },
        data: {
          status: "APPROVED",
        },
      });

      return successResponse(res, "KYC verified successfully", updated);
    } else if (approve === "REJECTED") {
      const updateKycStatus = await prisma.kycVerification.update({
        where: { userId: userId },
        data: {
          status: "REJECTED",
          rejectionNote,
        },
      });
      errorResponse(res, "Successfully rejected kyc");
    }
  } catch (err) {
    console.error(err);
    return errorResponse(res, "KYC verification failed");
  }
};

/**
 * Verify NIN number via checkmyninbvn.com.ng API
 * Endpoint: POST /kyc/verify-nin
 */
export const verifyNinNumber = async (req: AuthRequest, res: Response) => {
  try {
    const { nin } = req.body;

    if (!nin) {
      return errorResponse(res, "NIN is required");
    }

    // Call NIN verification service
    const verificationResult = await ninBvnService.verifyNin(nin);

    // If verification failed, return error
    if (verificationResult.status === "error") {
      return errorResponse(
        res,
        verificationResult.message,
        null,
        verificationResult.code
      );
    }

    // Return successful verification with personal data
    return successResponse(res, "NIN verified successfully", {
      verificationData: verificationResult.data,
      reportID: verificationResult.reportID,
    });
  } catch (err) {
    console.error("verifyNinNumber error:", err);
    return errorResponse(res, "NIN verification failed", null, 500);
  }
};

/**
 * Search NIN by phone number
 * Endpoint: POST /kyc/search-nin-phone
 */
export const searchNinByPhone = async (req: AuthRequest, res: Response) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return errorResponse(res, "Phone number is required");
    }

    // Call NIN phone search service
    const verificationResult = await ninBvnService.searchNinByPhone(phone);

    // If verification failed, return error
    if (verificationResult.status === "error") {
      return errorResponse(
        res,
        verificationResult.message,
        null,
        verificationResult.code
      );
    }

    return successResponse(res, "NIN found successfully", {
      verificationData: verificationResult.data,
      reportID: verificationResult.reportID,
    });
  } catch (err) {
    console.error("searchNinByPhone error:", err);
    return errorResponse(res, "NIN phone search failed", null, 500);
  }
};

/**
 * Search NIN by demographic data
 * Endpoint: POST /kyc/search-nin-demography
 */
export const searchNinByDemography = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { firstname, lastname, gender, dob } = req.body;

    if (!firstname || !lastname || !gender || !dob) {
      return errorResponse(
        res,
        "Missing required fields: firstname, lastname, gender, dob"
      );
    }

    // Call NIN demography search service
    const verificationResult = await ninBvnService.searchNinByDemography(
      firstname,
      lastname,
      gender,
      dob
    );

    // If verification failed, return error
    if (verificationResult.status === "error") {
      return errorResponse(
        res,
        verificationResult.message,
        null,
        verificationResult.code
      );
    }

    return successResponse(res, "NIN found successfully", {
      verificationData: verificationResult.data,
      reportID: verificationResult.reportID,
    });
  } catch (err) {
    console.error("searchNinByDemography error:", err);
    return errorResponse(res, "NIN demography search failed", null, 500);
  }
};



/**
 * Check API account balance
 * Endpoint: GET /kyc/verify-balance
 */
export const checkVerificationBalance = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (req.user?.role !== "ADMIN") {
      return errorResponse(res, "Only admins can check balance", null, 403);
    }

    const balanceResult = await ninBvnService.checkBalance();

    if (balanceResult.status === "error") {
      return errorResponse(
        res,
        balanceResult.message,
        null,
        balanceResult.code
      );
    }

    return successResponse(res, "Balance retrieved successfully", {
      balance: balanceResult.data,
    });
  } catch (err) {
    console.error("checkVerificationBalance error:", err);
    return errorResponse(res, "Failed to check balance", null, 500);
  }
};
