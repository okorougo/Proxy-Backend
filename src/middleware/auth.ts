import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  user?: { id: string; email: string; role: string };
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "Authorization header missing" });

  const token = header.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Token missing" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; email: string; role: string };
    req.user = payload;  // ✅ This is where req.user.id comes from
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}
