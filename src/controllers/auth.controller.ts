import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";
import { sendEmail } from "../services/emailService";
import { AuthRequest } from "../middleware/auth";
import dotEnv from "dotenv"

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, name, phone } = req.body;
    if (!email || !password || !phone) return res.status(400).json({ error: "Email, password, and phone required" });

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hashed, name,phone },
    });

    res.json({ id: user.id, email: user.email, name: user.name, });
  } catch (err: any) {
    if (err.code === "P2002") return res.status(409).json({ error: "Email already exists" });
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

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET as string,
      {
        expiresIn:  "7d",
      }
    );

    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};
export const sendOtp = async (req: AuthRequest, res: Response) => {
  const { email, phone,verifyOption } = req.body;
  if (!email && !phone) return res.status(400).json({ error: "Email or phone required" });

  const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

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

      <p>This code will expire in <strong> 5 minutes</strong>. Please do not share this code with anyone — even Proxy support staff will never ask for it.</p>
      <p>If you didn’t create an account on Proxy, you can safely ignore this email.</p>
    </div>
    <div style="background: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #777;">
      <p>© ${new Date().getFullYear()} Proxy. All rights reserved.</p>
    </div>
  </div>
`;

  // TODO: integrate email (nodemailer) or SMS (Twilio) here
  if(verifyOption==="email"){
    sendEmail(
      email!,
      "Verify your Proxy account - OTP Code", 
      html
    ).catch((err) => {
      console.error("Email send error:", err);
    });
  }else if(verifyOption==="phone"){
    // Integrate SMS sending service here
  }


  res.json({ message: "OTP sent" });
};

// Verify OTP (login)
export const verifyOtp = async (req: any, res: Response) => {
  const { email, phone, otp } = req.body;
  if (!otp) return res.status(400).json({ error: "OTP required" });

  const user = await prisma.user.findFirst({
    where: { OR: [{ email }, { phone }] },
  });

  if (!user || user.otpCode !== otp || !user.otpExpiresAt || user.otpExpiresAt < new Date()) {
    return res.status(400).json({ error: "Invalid or expired OTP" });
  }

  // clear OTP after success
  await prisma.user.update({
    where: { id: user.id },
    data: { otpCode: null, otpExpiresAt: null },
  });

  // issue JWT
  const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET!, {
    expiresIn: "7d",
  });

  res.json({ token, user });
};
