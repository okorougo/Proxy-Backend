import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
  secure: true,
});

export const uploadToCloudinary = async (
  filePath: string,
  folder?: string
): Promise<{ secure_url: string }> => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: folder || "uploads",
      resource_type: "auto", // handles image, video, pdf, etc.
    });

    // remove temp file
    fs.unlinkSync(filePath);

    return { secure_url: result.secure_url };
  } catch (err) {
    console.error("❌ Cloudinary upload failed:", err);
    // try to delete the temp file if upload fails
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    throw err;
  }
};

export default cloudinary;
