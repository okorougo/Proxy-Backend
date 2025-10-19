import { Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import { errorResponse, successResponse } from "../utils/response";

/**
 * ✅ Register or update a user session (device)
 * Called after login or app launch.
 */
export const registerDevice = async (req: AuthRequest, res: Response) => {
  try {
    const { device, deviceToken, devicePlatform, sessionId } = req.body;
    if (!req.user) return errorResponse(res, "Unauthorized", "UNAUTHORIZED", 401);

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

    return successResponse(res, "Device registered successfully", session);
  } catch (err) {
    console.error("registerDevice error:", err);
    return errorResponse(res, "Device registration failed");
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

    return successResponse(res, "User sessions fetched successfully", sessions);
  } catch (err) {
    console.error("getUserSessions error:", err);
    return errorResponse(res, "Failed to fetch user sessions");
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

    return successResponse(res, "Session updated successfully", session);
  } catch (err) {
    console.error("updateSession error:", err);
    return errorResponse(res, "Session update failed");
  }
};

/**
 * ✅ Logout user from all sessions
 */
export const logoutSession = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return errorResponse(res, "Unauthorized", "UNAUTHORIZED", 401);

    await prisma.session.updateMany({
      where: { userId: req.user.id },
      data: { isOnline: false, lastSeen: new Date(), socketId: null },
    });

    return successResponse(res, "Logged out from all sessions successfully");
  } catch (err) {
    console.error("logoutSession error:", err);
    return errorResponse(res, "Logout failed");
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

    return successResponse(res, "All sessions fetched successfully", sessions);
  } catch (err) {
    console.error("getAllSessions error:", err);
    return errorResponse(res, "Failed to fetch all sessions");
  }
};
