import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const TERMII_API_KEY = process.env.TERMII_API_KEY;
const TERMII_SENDER_ID = process.env.TERMII_SENDER_ID || "Proxy";
const TERMII_BASE_URL = "https://api.ng.termii.com/api";

export const sendOtpViaTermii = async (phone: string, otp: string): Promise<boolean> => {
  try {
    if (!TERMII_API_KEY) {
      console.error("❌ TERMII_API_KEY is not configured in environment variables");
      return false;
    }

    // Ensure phone number is in the correct format (e.g., +234... for Nigeria)
    const formattedPhone = phone.startsWith("+") ? phone : `+234${phone.slice(-10)}`;

    const message = `Your Proxy verification code is: ${otp}. This code will expire in 15 minutes.`;

    const payload = {
      to: formattedPhone,
      sms: message,
      type: "plain",
      api_key: TERMII_API_KEY,
      from: TERMII_SENDER_ID,
    };

    const response = await axios.post(
      `${TERMII_BASE_URL}/sms/send`,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Termii SMS sent successfully!", response.data);
    return true;
  } catch (err: any) {
    console.error(
      "❌ Failed to send SMS via Termii:",
      err.response?.data || err.message
    );
    return false;
  }
};

export const verifyOtpViaTermii = async (
  phone: string,
  otp: string
): Promise<boolean> => {
  try {
    if (!TERMII_API_KEY) {
      console.error("❌ TERMII_API_KEY is not configured");
      return false;
    }

    const formattedPhone = phone.startsWith("+") ? phone : `+234${phone.slice(-10)}`;

    const payload = {
      phone_number: formattedPhone,
      bundle_id: otp, // Termii uses bundle_id for verification
      api_key: TERMII_API_KEY,
    };

    const response = await axios.post(
      `${TERMII_BASE_URL}/verify/check`,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Termii OTP verification result:", response.data);
    return response.data.verified === true;
  } catch (err: any) {
    console.error(
      "❌ Failed to verify OTP via Termii:",
      err.response?.data || err.message
    );
    return false;
  }
};
