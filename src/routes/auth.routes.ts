import { Router } from "express";
import passport from "../lib/passport";
import { register, login,sendOtp, verifyOtp,registerVendor, forgotPassword, resetPassword, resendResetOtp, vendorLogin } from "../controllers/auth.controller";
import jwt from "jsonwebtoken"

const router = Router();

router.post("/register", register);
router.post("/register-vendor", registerVendor);
router.post("/login", login);
router.post("/login-vendor", vendorLogin);
router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/resend-reset-otp", resendResetOtp);

// Google
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));
router.get("/google/callback", passport.authenticate("google", { session: false }), (req:any, res) => {
  // issue JWT
  const user = req.user as any;
  const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET!, {
    expiresIn: "7d",
  });
  res.json({ token, user });
});

// Apple (similar flow)
router.get("/apple", passport.authenticate("apple"));
router.post("/apple/callback", passport.authenticate("apple", { session: false }), (req:any, res) => {
  const user = req.user as any;
  const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET!, {
    expiresIn: "7d",
  });
  res.json({ token, user });
});

export default router;
