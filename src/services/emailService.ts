// src/services/emailService.ts
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465, // use SSL port
  secure: true, // must be true for port 465
  auth: {
    user: "ajayisegun2003@gmail.com",
    pass: "spudyopyvqaljvmy",
  },
   pool: true, // reuses connection
  maxConnections: 2,
  maxMessages: 30,
  connectionTimeout: 20000, // 20 seconds
  socketTimeout: 20000,
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
