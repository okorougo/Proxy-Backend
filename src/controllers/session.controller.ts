import { Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";

/**
 * ✅ Register or update a user session (device)
 * Called after login or app launch.
 */
export const registerDevice = async (req: AuthRequest, res: Response) => {
  try {
    const { device, deviceToken, devicePlatform, sessionId } = req.body;
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    let session;

    if (sessionId) {
      // Update existing session by ID
      session = await prisma.session.update({
        where: { id: sessionId },
        data: {
          device,
          deviceToken,
          devicePlatform,
          ip: req.ip,
          isOnline: true,
          lastSeen: new Date(),
        },
      });
    } else {
      // Create a new session
      session = await prisma.session.create({
        data: {
          userId: req.user.id,
          device,
          deviceToken,
          devicePlatform,
          ip: req.ip,
          isOnline: true,
          lastSeen: new Date(),
        },
      });
    }

    res.json({ message: "Device session registered successfully", session });
  } catch (err) {
    console.error("registerDevice error:", err);
    res.status(500).json({ error: "Device registration failed" });
  }
};

/**
 * ✅ Get all active sessions for the logged-in user
 */
export const getUserSessions = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const sessions = await prisma.session.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
    });

    res.json({ sessions });
  } catch (err) {
    console.error("getUserSessions error:", err);
    res.status(500).json({ error: "Failed to fetch user sessions" });
  }
};

/**
 * ✅ Update a session's online status or push token
 * Used for background/foreground app state changes.
 */
export const updateSession = async (req: AuthRequest, res: Response) => {
  try {
    const { isOnline, deviceToken } = req.body;
    const { sessionId } = req.params;

    const session = await prisma.session.update({
      where: { id: sessionId },
      data: {
        isOnline,
        deviceToken,
        lastSeen: new Date(),
      },
    });

    res.json({ message: "Session updated", session });
  } catch (err) {
    console.error("updateSession error:", err);
    res.status(500).json({ error: "Failed to update session" });
  }
};

/**
 * ✅ Logout user from all sessions
 */
export const logoutSession = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    await prisma.session.updateMany({
      where: { userId: req.user.id },
      data: { isOnline: false, lastSeen: new Date(), socketId: null },
    });

    res.json({ message: "User logged out successfully" });
  } catch (err) {
    console.error("logoutSession error:", err);
    res.status(500).json({ error: "Logout failed" });
  }
};

/**
 * ✅ Admin: Get all active sessions in system (optional)
 */
export const getAllSessions = async (_req: AuthRequest, res: Response) => {
  try {
    const sessions = await prisma.session.findMany({
      include: { user: { select: { id: true, email: true, role: true } } },
      orderBy: { createdAt: "desc" },
    });

    res.json({ sessions });
  } catch (err) {
    console.error("getAllSessions error:", err);
    res.status(500).json({ error: "Failed to fetch all sessions" });
  }
};
