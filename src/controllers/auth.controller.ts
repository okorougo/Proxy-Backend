import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";
import { sendEmail } from "../services/emailService";
import { AuthRequest } from "../middleware/auth";
import dotEnv from "dotenv";
import { errorResponse, successResponse } from "../utils/response";
dotEnv.config();

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, name, phone } = req.body;
    if (!email || !password || !phone)
      return errorResponse(res, "Email, password, and phone are required", "Field_ERROR", 400);

    const userExists = await prisma.user.findUnique({ where: { email } });
    const userPhoneExists = await prisma.user.findUnique({ where: { phone } });

    if(userPhoneExists && userExists && !userExists.isEmailVerified ){
        return errorResponse(res, "Email hasn't been verified", "EMAIL_NOT_VERIFIED", 409, {
        email: userExists.email,
        phone: userExists.phone,
      });
    }
        if (userExists) return errorResponse(res, "Email already exists",  "EMAIL_EXISTS", 409);
    if (userPhoneExists) return errorResponse(res, "Phone number already exists", "PHONE_EXISTS", 409);

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hashed, name, phone },
    });
      return successResponse(res, "Registration successful", {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
    });
  } catch (err: any) {
    console.error(err);
    return errorResponse(res, "Internal server error", "SERVER_ERROR", 500);
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return errorResponse(res, "Invalid credentials", "INVALID_CREDENTIALS", 401);

     if (!user.isEmailVerified)
      return errorResponse(res, "Email hasn't been verified", "EMAIL_NOT_VERIFIED", 409, {
        email: user.email,
        phone: user.phone,
      });

    const match = await bcrypt.compare(password, user.password || "");
    if (!match) return errorResponse(res, "Invalid credentials", "INVALID_CREDENTIALS", 401);
    if (user.isBanned)
      return errorResponse(res, "User is banned", "USER_BANNED", 403);

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET as string,
      {
        expiresIn: "7d",
      }
    );

    return successResponse(res, "Login successful", {
      token,
      user: { id: user.id, email: user.email, name: user.name, phone: user.phone },
    });
  } catch (err) {
    console.error(err);
    return errorResponse(res, "Internal server error", "SERVER_ERROR", 500);
  }
};
export const sendOtp = async (req: AuthRequest, res: Response) => {
  const { email, phone, verifyOption } = req.body;
  if (!email && !phone)
    return errorResponse(res, "Email or phone required", "FIELD_ERROR", 400);

  const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 5 mins

  const user = await prisma.user.upsert({
    where: email ? { email } : { phone },
    update: { otpCode: otp, otpExpiresAt: expiresAt },
    create: { email, phone, otpCode: otp, otpExpiresAt: expiresAt },
  });

  const html = `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
    <div style="background: #0ea5a4; color: #fff; padding: 20px; text-align: center;">
      <h2>Proxy Account Verification</h2>
    </div>
    <div style="padding: 20px; color: #333;">
      <p>Hi ${user.name || "There"},</p>
      <p>Thanks for joining <strong>Proxy</strong> — your trusted marketplace for buying and selling safely. To finish setting up your account, please verify your email with the One-Time Password (OTP) below:</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <div style="display: inline-block; background: #f0fdfd; border: 1px solid #99f6e4; border-radius: 6px; padding: 18px 26px;">
          <p style="margin: 0; color: #0f766e; font-size: 16px;">Your verification code</p>
          <h1 style="margin: 10px 0 0; font-size: 32px; letter-spacing: 4px; color: #065f5b;">${otp}</h1>
        </div>
      </div>

      <p>This code will expire in <strong> 15 minutes</strong>. Please do not share this code with anyone — even Proxy support staff will never ask for it.</p>
      <p>If you didn’t create an account on Proxy, you can safely ignore this email.</p>
    </div>
    <div style="background: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #777;">
      <p>© ${new Date().getFullYear()} Proxy. All rights reserved.</p>
    </div>
  </div>
`;
  // TODO: integrate email (nodemailer) or SMS (Twilio) here
  if (verifyOption === "email") {
    sendEmail(email, "Verify your Proxy account - OTP Code", html).catch(
      (err) => {
        console.error("Email send error:", err);
      }
    );
    return successResponse(res, "OTP sent to email");
  } else if (verifyOption === "phone") {
    // Integrate SMS sending service here
    return successResponse(res, "OTP sent to phone");
  }
};

// Verify OTP (login)
export const verifyOtp = async (req: any, res: Response) => {
  const { email, phone, otp } = req.body;
  if (!otp) return res.status(400).json({ error: "OTP required" });

  const user = await prisma.user.findFirst({
    where: { OR: [{ email }, { phone }] },
  });
  if (!user)
    return errorResponse(res, "User not found", "USER_NOT_FOUND", 404);

  if (
    user.otpCode !== otp ||
    !user.otpExpiresAt ||
    user.otpExpiresAt < new Date()
  ) {
    return errorResponse(res, "Invalid or expired OTP", "INVALID_OTP", 400);
  }

  // clear OTP after success
  await prisma.user.update({
    where: { id: user.id },
    data: { otpCode: null, otpExpiresAt: null, isEmailVerified: true },
  });

  // issue JWT
  const token = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET!,
    {
      expiresIn: "7d",
    }
  );

  return successResponse(res, "OTP verified successfully", { token, user });
};
export const registerVendor = async (req: Request, res: Response) => {
  try {
    const { name, email, password, phone, description } = req.body;

    let user = await prisma.user.findUnique({ where: { email } });


    // If user doesn't exist, create one silently
    if (!user) {
      const hashed = await bcrypt.hash(password, 10);
      user = await prisma.user.create({
        data: {
          name,
          email,
          phone,
          password: hashed,
          role: "USER",
        },
      });

      // Optional: send email OTP verification

      const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 5 mins
      const html = `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color:#0ea5a4;">Proxy Account Verification</h2>
          <p>Hello ${name},</p>
          <p>Welcome to Proxy! Please verify your email with this code:</p>
          <h1 style="color:#065f5b;">${otp}</h1>
          <p>This code will expire in 15 minutes.</p>
        </div>
      `;
      await sendEmail(email, "Verify Your Email - Proxy", html);

      await prisma.user.upsert({
        where: email ? { email } : { phone },
        update: { otpCode: otp, otpExpiresAt: expiresAt },
        create: { email, phone, otpCode: otp, otpExpiresAt: expiresAt },
      });
    }

      // If vendor already applied
      const existingVendor = await prisma.vendorApplication.findUnique({
        where: { userId: user.id },
      });

      if(existingVendor && user?.isKycVerified !== true){
        return errorResponse(res, "KYC verification is pending. Please complete KYC to proceed.", "KYC_PENDING", 403, {
          email: user.email,
          phone: user.phone,
          vendorId: existingVendor.id,
          status: existingVendor.status,
        });
      }

      if (existingVendor?.status === "PENDING" && existingVendor) {
        return errorResponse(res, "Vendor application already submitted, but haven't been approved yet. Please continue checking your mail to know if your application is approved", "VENDOR_EXISTS", 409);
      }

      // Create vendor application
      const vendor = await prisma.vendorApplication.create({
        data: {
          userId: user.id,
          description,
        },
      });

    return successResponse(res, "Vendor application submitted", {
      vendorId: vendor.id,
      status: vendor.status,
    });
    
  } catch (err) {
    console.error("registerVendor error:", err);
    return errorResponse(res, "Internal server error", "SERVER_ERROR", 500);
  }
};
export const vendorLogin = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return errorResponse(res, "Email and password are required", "FIELD_ERROR", 400);

    // find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: { vendorApplication: true },
    });

    if (!user)
      return errorResponse(res, "Account not found", "INVALID_CREDENTIALS", 401);

    // verify password
    const isMatch = await bcrypt.compare(password, user.password || "");
    if (!isMatch)
      return errorResponse(res, "Invalid credentials", "INVALID_CREDENTIALS", 401);

    // check if user has a vendor record
    if (!user.vendorApplication)
      return errorResponse(res, "No vendor application found", "VENDOR_NOT_FOUND", 404);

    // check vendor approval status
    if (user.vendorApplication.status === "PENDING") {
     return errorResponse(res, "Vendor application is still pending", "VENDOR_PENDING", 403);
    }

    if (user.vendorApplication.status === "REJECTED") {
      return errorResponse(res, "Vendor application was rejected", "VENDOR_REJECTED", 403);
    }
    if (user.isBanned){
       return errorResponse(res, "User is banned", "USER_BANNED", 403);
    }
     

    // if approved → allow login
    const token = jwt.sign(
      { id: user.id, email: user.email, role: "VENDOR" },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" }
    );
    return successResponse(res, "Vendor login successful", {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone:user.phone,
        vendorApplicationId: user.vendorApplication.id,
        vendorStatus: user.vendorApplication.status,
      },
    });
  } catch (err) {
    console.error("vendorLogin error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return errorResponse(res, "Email is required", "FIELD_ERROR", 400);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return errorResponse(res, "No user found with this email", "USER_NOT_FOUND", 404);

    // generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    await prisma.user.update({
      where: { id: user.id },
      data: { otpCode: otp, otpExpiresAt: expiresAt },
    });

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
        <div style="background: #0ea5a4; color: #fff; padding: 20px; text-align: center;">
          <h2>Password Reset Request</h2>
        </div>
        <div style="padding: 20px;">
          <p>Hello ${user.name || "there"},</p>
          <p>We received a request to reset your <strong>Proxy</strong> account password.</p>
          <p>Use this One-Time Password (OTP) to reset your password:</p>
          <div style="text-align:center; margin: 20px 0;">
            <h1 style="letter-spacing: 4px; color: #065f5b;">${otp}</h1>
          </div>
          <p>This code will expire in <strong>15 minutes</strong>. If you didn’t request a password reset, you can ignore this email.</p>
        </div>
        <div style="background: #f9f9f9; text-align:center; padding: 15px; font-size: 12px; color: #777;">
          <p>© ${new Date().getFullYear()} Proxy. All rights reserved.</p>
        </div>
      </div>
    `;

    await sendEmail(user.email, "Proxy Password Reset Code", html);
    return successResponse(res, "OTP sent to your email for password reset");
  } catch (err) {
    console.error("forgotPassword error:", err);
    return errorResponse(res, "Internal server error", "SERVER_ERROR", 500);
  }
};
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword)
      return errorResponse(res, "Email, OTP, and new password are required", "FIELD_ERROR", 400);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user)
      return errorResponse(res, "User not found", "USER_NOT_FOUND", 404);

    if (
      user.otpCode !== otp ||
      !user.otpExpiresAt ||
      user.otpExpiresAt < new Date()
    ) {
      return errorResponse(res, "Invalid or expired OTP", "INVALID_OTP", 400);
    }

    // hash new password
    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, otpCode: null, otpExpiresAt: null },
    });

    // send confirmation email
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
        <div style="background: #0ea5a4; color: #fff; padding: 20px; text-align: center;">
          <h2>Password Changed Successfully</h2>
        </div>
        <div style="padding: 20px;">
          <p>Hello ${user.name || "there"},</p>
          <p>Your <strong>Proxy</strong> account password was successfully changed.</p>
          <p>If you did not perform this action, please reset your password immediately or contact our support team.</p>
        </div>
        <div style="background: #f9f9f9; text-align:center; padding: 15px; font-size: 12px; color: #777;">
          <p>© ${new Date().getFullYear()} Proxy. All rights reserved.</p>
        </div>
      </div>
    `;

    await sendEmail(user.email, "Proxy Password Changed Successfully", html);
    return successResponse(res, "Password reset successful and confirmation email sent.");
  } catch (err) {
    console.error("resetPassword error:", err);
    return errorResponse(res, "Internal server error", "SERVER_ERROR", 500);
  }
};
export const resendResetOtp = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return errorResponse(res, "No user found with this email", "USER_NOT_FOUND", 404);

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { otpCode: otp, otpExpiresAt: expiresAt },
    });

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
        <div style="background: #0ea5a4; color: #fff; padding: 20px; text-align: center;">
          <h2>Proxy Password Reset Code</h2>
        </div>
        <div style="padding: 20px;">
          <p>Hello ${user.name || "there"},</p>
          <p>Use this new OTP to reset your password:</p>
          <h1 style="text-align:center; letter-spacing:4px; color:#065f5b;">${otp}</h1>
        </div>
        <div style="background:#f9f9f9; text-align:center; padding:15px; font-size:12px; color:#777;">
          <p>© ${new Date().getFullYear()} Proxy. All rights reserved.</p>
        </div>
      </div>
    `;

    await sendEmail(user.email, "Proxy Password Reset Code", html);
    return successResponse(res, "New OTP sent to your email for password reset");
    
  } catch (err) {
    console.error("resendResetOtp error:", err);
    return errorResponse(res, "Internal server error", "SERVER_ERROR", 500);
  }
};
export const updateUser = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id; // assuming user is attached to req by auth middleware
    const { name, email, phone } = req.body;

    if (!userId) {
      return errorResponse(res, "Unauthorized", "UNAUTHORIZED", 401);
    }

    if (!name && !email && !phone) {
      return errorResponse(res, "No update fields provided", "NO_FIELDS", 400);
    }

    // ✅ Check if email exists for another user
    if (email) {
      const existingEmail = await prisma.user.findFirst({
        where: {
          email,
          NOT: { id: userId },
        },
      });
      if (existingEmail) {
        return errorResponse(res, "Email already exists", "EMAIL_EXISTS", 409);
      }
    }

    // ✅ Check if phone exists for another user
    if (phone) {
      const existingPhone = await prisma.user.findFirst({
        where: {
          phone,
          NOT: { id: userId },
        },
      });
      if (existingPhone) {
        return errorResponse(res, "Phone number already exists", "PHONE_EXISTS", 409);
      }
    }

    // ✅ Perform update
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(phone && { phone }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
      },
    });

    return successResponse(res, "Profile updated successfully", updatedUser);
  } catch (err) {
    console.error("❌ updateUser error:", err);
    return errorResponse(res, "Failed to update profile", "UPDATE_ERROR", 500);
  }
};


