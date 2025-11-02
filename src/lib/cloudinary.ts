import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
import fs from "fs";
import streamifier from "streamifier";
dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
  secure: true,
});

export const uploadToCloudinary = (buffer: Buffer, folder: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};
export const generateSignedDownloadUrl = (publicId: string) => {
  const url = cloudinary.url(publicId, {
    resource_type: "auto",
    type: "upload",
    sign_url: true,
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour expiry
  });
  return url;
};
export const deleteFromCloudinary = async (publicId: string) => {
  if (!publicId) throw new Error("Missing publicId for Cloudinary deletion");
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      invalidate: true, // optional: ensures cached versions are also removed
      resource_type: "auto", // auto-detect (image, video, etc.)
    });

    if (result.result !== "ok" && result.result !== "not found") {
      console.warn("⚠️ Cloudinary delete warning:", result);
    }

    return result;
  } catch (error: any) {
    console.error("❌ Cloudinary deletion error:", error.message || error);
    throw new Error("Failed to delete from Cloudinary");
  }
};

export default cloudinary;
