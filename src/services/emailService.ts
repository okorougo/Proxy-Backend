import nodemailer from "nodemailer";
import { google } from "googleapis";

const GOOGLE_ID =
  "80403603163-mf1287mpnvrrmtcvmun67qc38461a5on.apps.googleusercontent.com";
const GOOGLE_SECRET = "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";
const GOOGLE_REFRESHTOKEN =
  "1//04KKp2C7vJZb_CgYIARAAGAQSNwF-L9IrxJ5m4_tN574S7V_19j54GZFDuPVGL_7-nNMofujE4A2SYfJIhH7rHuoDXhloLa92YvU";

const GOOGLE_URL = "https://developer.google.com/oauthplayground";

const oAuth = new google.auth.OAuth2(GOOGLE_ID, GOOGLE_SECRET, GOOGLE_URL);
oAuth.setCredentials({ access_token: GOOGLE_REFRESHTOKEN });

export const sendEmail = async (to: string, subject: string, html: string) => {
  try {
    const accessToken: any = await oAuth.getAccessToken();
    if (!accessToken.token) {
      throw new Error("Failed to retrieve access token");
    }

    const transport = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        type: "OAuth2",
        user: "ajayisegun2003@gmail.com",
        clientId: GOOGLE_ID,
        clientSecret: GOOGLE_SECRET,
        refreshToken: GOOGLE_REFRESHTOKEN,
        accessToken,
      },
    });

    const mailer = {
      from: "Proxy <ajayisegun2003@gmail.com>",
      to: to,
      subject,
      html,
    };

    transport.sendMail(mailer);
  } catch (error) {
    console.log(error);
  }
};
