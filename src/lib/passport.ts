import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
// import { Strategy as AppleStrategy } from "passport-apple";
import prisma from "./prisma";

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: process.env.GOOGLE_CALLBACK_URL!,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const user = await prisma.user.upsert({
          where: { email: profile.emails?.[0].value },
          update: {},
          create: {
            provider: "google",
            providerId: profile.id,
            email: profile.emails?.[0].value ?? (() => { throw new Error("Google profile email is missing"); })(),
            name: profile.displayName,
          },
        });
        done(null, user);
      } catch (err) {
        done(err, false);
      }
    }
  )
);

// Apple strategy (similar setup)
// passport.use(
//   new AppleStrategy(
//     {
//       clientID: process.env.APPLE_CLIENT_ID!,
//       teamID: process.env.APPLE_TEAM_ID!,
//       keyID: process.env.APPLE_KEY_ID!,
//       privateKeyString: process.env.APPLE_PRIVATE_KEY!,
//       callbackURL: process.env.APPLE_CALLBACK_URL!,
//     },
//     async (accessToken, refreshToken, idToken: any, profile: any, done:any) => {
//       try {
//         // AppleStrategy's profile is usually just a string (user id), so use idToken for user info
//         const email = idToken?.email;
//         const name = idToken?.name || "";
//         const providerId = typeof profile === "string" ? profile : idToken?.sub;

//         if (!email) {
//           throw new Error("Apple profile email is missing");
//         }

//         const user = await prisma.user.upsert({
//           where: { email },
//           update: {},
//           create: {
//             provider: "apple",
//             providerId,
//             email,
//             name,
//           },
//         });
//         done(null, user);
//       } catch (err) {
//         done(err, null);
//       }
//     }
//   )
// );

export default passport;
