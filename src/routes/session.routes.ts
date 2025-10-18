import { Router } from "express";
import { getUserSessions, logoutSession, registerDevice,getAllSessions, updateSession } from "../controllers/session.controller";
import { authMiddleware } from "../middleware/auth";

const router = Router();

router.post("/register", authMiddleware, registerDevice);
router.get("/my-device", authMiddleware, getUserSessions);
router.post("/logout", authMiddleware, logoutSession);
router.get("/all", authMiddleware, getAllSessions);
router.put("/update/:sessionId", authMiddleware, updateSession);

export default router;
