import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";
import { sendEmail } from "../services/emailService";
import { AuthRequest } from "../middleware/auth";
import dotEnv from "dotenv";
dotEnv.config();

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, name, phone } = req.body;
    if (!email || !password || !phone)
      return res
        .status(400)
        .json({ error: "Email, password, and phone required" });

    const userExists = await prisma.user.findUnique({ where: { email } });
    const userPhoneExists = await prisma.user.findUnique({ where: { phone } });
    if (userPhoneExists)
      return res.status(409).json({ error: "Phone number already exists" });
    if (userExists)
      return res.status(409).json({ error: "Email already exists" });

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hashed, name, phone },
    });
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.password || "");
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    if (!user.otpCode)
      return res.status(400).json({ message: "User not verified" });

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET as string,
      {
        expiresIn: "7d",
      }
    );

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};
export const sendOtp = async (req: AuthRequest, res: Response) => {
  const { email, phone, verifyOption } = req.body;
  if (!email && !phone)
    return res.status(400).json({ error: "Email or phone required" });

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
  console.log(email, phone, verifyOption, otp, expiresAt);
  // TODO: integrate email (nodemailer) or SMS (Twilio) here
  if (verifyOption === "email") {
    sendEmail(email, "Verify your Proxy account - OTP Code", html).catch(
      (err) => {
        console.error("Email send error:", err);
      }
    );
    res.json({ message: "OTP sent to email" });
  } else if (verifyOption === "phone") {
    // Integrate SMS sending service here
    res.json({ message: "OTP sent to phone" });
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
    return res
      .status(400)
      .json({ error: "User not found", message: "Email or phone not correct" });

  if (
    user.otpCode !== otp ||
    !user.otpExpiresAt ||
    user.otpExpiresAt < new Date()
  ) {
    return res.status(400).json({ error: "Invalid or expired OTP" });
  }

  // clear OTP after success
  await prisma.user.update({
    where: { id: user.id },
    data: { otpCode: null, otpExpiresAt: null },
  });

  // issue JWT
  const token = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET!,
    {
      expiresIn: "7d",
    }
  );

  res.json({ token, user });
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

      if (existingVendor) {
        return res
          .status(400)
          .json({ message: "You already have a vendor application." });
      }

      // Create vendor application
      const vendor = await prisma.vendorApplication.create({
        data: {
          userId: user.id,
          description,
        },
      });

      return res.status(201).json({
        message: "Vendor registration submitted successfully.",
        vendor,
      });
    
  } catch (err) {
    console.error("registerVendor error:", err);
    return res.status(500).json({ message: "Internal server error." });
  }
};
export const vendorLogin = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: "Email and password are required" });

    // find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: { vendorApplication: true },
    });

    if (!user)
      return res.status(404).json({ error: "No account found for this email" });

    // verify password
    const isMatch = await bcrypt.compare(password, user.password || "");
    if (!isMatch)
      return res.status(401).json({ error: "Invalid credentials" });

    // check if user has a vendor record
    if (!user.vendorApplication)
      return res.status(403).json({
        message:
          "You are not registered as a vendor. Please apply first.",
      });

    // check vendor approval status
    if (user.vendorApplication.status === "PENDING") {
      return res.status(403).json({
        message: "Your vendor application is still under review.",
      });
    }

    if (user.vendorApplication.status === "REJECTED") {
      return res.status(403).json({
        message: "Your vendor application was rejected. Please contact support.",
      });
    }

    // if approved → allow login
    const token = jwt.sign(
      { id: user.id, email: user.email, role: "VENDOR" },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      message: "Vendor login successful",
      token,
      vendor: {
        id: user.vendorApplication.id,
        email: user.email,
        name: user.name,
        status: user.vendorApplication.status,
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
    if (!email) return res.status(400).json({ error: "Email is required" });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: "No user found with this email" });

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
    res.json({ message: "OTP sent to your email for password reset" });
  } catch (err) {
    console.error("forgotPassword error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword)
      return res.status(400).json({ error: "Email, OTP and new password are required" });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user)
      return res.status(404).json({ error: "No user found with this email" });

    if (
      user.otpCode !== otp ||
      !user.otpExpiresAt ||
      user.otpExpiresAt < new Date()
    ) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
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
    res.json({ message: "Password reset successful and confirmation email sent." });
  } catch (err) {
    console.error("resetPassword error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};
export const resendResetOtp = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: "User not found" });

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
    res.json({ message: "New OTP sent to your email." });
  } catch (err) {
    console.error("resendResetOtp error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

