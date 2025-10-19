// src/services/emailService.ts
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // SSL
  auth: {
    user: "ajayisegun2003@gmail.com",
    pass: "spudyopyvqaljvmy",
  },
  pool: true, // reuse connection
  maxConnections: 3,
  maxMessages: 50,
  connectionTimeout: 10000, // 10s
  greetingTimeout: 5000,
  socketTimeout: 10000,
});

export async function sendEmail(to: string, subject: string, html: string) {
  try {
    await transporter.sendMail({
      from: `"Proxy" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
    console.log(`✅ Email sent to ${to}`);
  } catch (error) {
    console.error("❌ Email failed:", error);
    throw new Error("Failed to send email");
  }
}
