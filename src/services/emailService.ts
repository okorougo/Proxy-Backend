// src/services/emailService.ts
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail(to: string, subject: string, html: string) {
  try {
    const { data, error } = await resend.emails.send({
      from: "Proxy <onboarding@resend.dev>", // use a verified domain or default
      to,
      subject,
      html,
    });

    if (error) {
      console.error("❌ Email failed:", error);
      throw new Error("Failed to send email");
    }

    console.log(`✅ Email sent to ${to}`);
    return data;
  } catch (error) {
    console.error("❌ Email send error:", error);
    throw new Error("Failed to send email");
  }
}
