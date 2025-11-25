import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";
import { errorResponse } from "../utils/response";

export interface AuthRequest extends Request {
  user?: { id: string; email: string; role: string };
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header) return errorResponse(res, "Authorization header missing", null, 401);

  const token = header.split(" ")[1];
  if (!token) return errorResponse(res, "Token missing", null, 401);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; email: string; role: string };
    const user = await prisma.user.findUnique({
      where: { id: payload?.id }
    });
     if (!user) {
      errorResponse(res, "User not found", null, 404);
    }

    if (user.isBanned) {
      errorResponse(res, "User is banned", null, 403);
    }
    req.user = payload;  // ✅ This is where req.user.id comes from
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}
