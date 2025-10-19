// src/services/emailService.ts
import SibApiV3Sdk from "@sendinblue/client";

const brevo = new SibApiV3Sdk.TransactionalEmailsApi();
brevo.setApiKey(SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY!);
// 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
export async function sendEmail(to: string, subject: string, html: string) {
  try {
    const response = await brevo.sendTransacEmail({
      sender: { name: "Proxy App", email: "ajayisegun2003@gmail.com" },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    });

    console.log(`✅ Email sent to ${to}`, response);
  } catch (error) {
    console.error("❌ Email failed:", error);
    throw new Error("Failed to send email");
  }
}
