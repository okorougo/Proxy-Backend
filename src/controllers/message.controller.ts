import { Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import { sendFcm, sendExpo } from "../lib/notifications";
import { errorResponse, successResponse } from "../utils/response";

// Send message
export const sendMessageRest = async (req: AuthRequest, res: Response) => {
  try {
    const { receiverId, listingId, content } = req.body;
    if (!receiverId || !content) return errorResponse(res, "receiverId and content are required");

    const message = await prisma.message.create({
      data: {
        senderId: req.user!.id,
        recipientId: receiverId,
        listingId,
        content,
        status: "SENT",
      },
      include: { sender: { select: { id: true, name: true } } },
    });

    // find receiver device tokens
    const sessions = await prisma.session.findMany({ where: { userId: receiverId, deviceToken: { not: null } } });

    // If receiver offline (no active socket) we will notify them from Socket.IO code — but REST can attempt push too:
    for (const s of sessions) {
      if (s.devicePlatform === "expo") {
        await sendExpo(s.deviceToken!, "New message", content, { type: "message", listingId, senderId: req.user!.id });
      } else {
        await sendFcm(s.deviceToken!, "New message", content, { type: "message", listingId, senderId: req.user!.id });
      }
    }

    return successResponse(res, "Message sent", message);
  } catch (err) {
    console.error(err);
    return errorResponse(res, "Message send failed");
  }
};

// Get conversation between two users
export const getConversation = async (req: AuthRequest, res: Response) => {
  try {
    const { otherUserId } = req.params;

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: req.user!.id, recipientId: otherUserId },
          { senderId: otherUserId, recipientId: req.user!.id },
        ],
      },
      orderBy: { createdAt: "asc" },
    });

    res.json({ messages });
  } catch (err) {
    console.error(err);
    return errorResponse(res, "Failed to load conversation");
  }
};

// Mark messages as read
export const markDelivered = async (req: AuthRequest, res: Response) => {
  try {
    const { messageIds } = req.body; // array of message ids
    if (!Array.isArray(messageIds)) return errorResponse(res, "messageIds must be an array");

    const now = new Date();
    await prisma.message.updateMany({
      where: { id: { in: messageIds }, status: "SENT" },
      data: { status: "DELIVERED", deliveredAt: now },
    });

    return successResponse(res, "Messages marked as delivered");

  } catch (err) {
    console.error(err);
    return errorResponse(res, "Mark delivered failed");
  }
};

/** Mark messages from a sender as read (receiver calls) */
export const markAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const { senderId } = req.body;
    if (!senderId) return errorResponse(res, "senderId is required");

    const now = new Date();
    const result = await prisma.message.updateMany({
      where: { senderId, recipientId: req.user!.id, status: { in: ["SENT", "DELIVERED"] } },
      data: { status: "READ", readAt: now },
    });

    // Optionally notify sender via push that messages were read (small UX improvement)
    const senderSessions = await prisma.session.findMany({ where: { userId: senderId, deviceToken: { not: null } } });
    for (const s of senderSessions) {
      const body = `${req.user!.id} read your messages`;
      if (s.devicePlatform === "expo") await sendExpo(s.deviceToken!, "Messages read", body, { type: "read", by: req.user!.id });
      else await sendFcm(s.deviceToken!, "Messages read", body, { type: "read", by: req.user!.id });
    }

    return successResponse(res, "Messages marked as read", { count: result.count });
  } catch (err) {
    console.error(err);
    return errorResponse(res, "Mark as read failed");
  }
};

/** Unread count per chat for current user */
export const getUnreadCounts = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // group by senderId producing unread count
    const raw = await prisma.$queryRawUnsafe(`
      SELECT senderId, COUNT(*) as unread
      FROM Message
      WHERE receiverId = '${userId}' AND status != 'READ'
      GROUP BY senderId
    `);

    const counts: { [key: string]: number } = {};
    for (const row of raw as any[]) {
      counts[row.senderId] = Number(row.unread);
    }
    return successResponse(res, "Unread counts retrieved", counts);
  } catch (err) {
    console.error(err);
    return errorResponse(res, "Failed to get unread counts");
  }
};
export const getAllUserChats = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // 📨 1️⃣ Fetch all messages involving this user
    const allMessages = await prisma.message.findMany({
      where: {
        OR: [{ senderId: userId }, { recipientId: userId }],
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        content: true,
        createdAt: true,
        senderId: true,
        recipientId: true,
        status: true,
        listingId: true,
      },
    });

    if (allMessages.length === 0) {
      return successResponse(res, "No conversations yet", []);
    }

    // 🧠 2️⃣ Keep only latest message per other user
    const chatMap = new Map<string, any>();
    for (const msg of allMessages) {
      const otherUserId = msg.senderId === userId ? msg.recipientId : msg.senderId;
      if (!chatMap.has(otherUserId)) {
        chatMap.set(otherUserId, msg);
      }
    }

    const chatPartnerIds = Array.from(chatMap.keys());

    // 🔢 3️⃣ Count unread messages per partner
    const unreadCountsRaw = await prisma.message.groupBy({
      by: ["senderId"],
      where: {
        recipientId: userId,
        status: { notIn: ["READ"] },
      },
      _count: { _all: true },
    });

    const unreadMap: Record<string, number> = {};
    unreadCountsRaw.forEach((r) => {
      unreadMap[r.senderId] = r._count._all;
    });

    // 👥 4️⃣ Fetch user + session details
    const users = await prisma.user.findMany({
      where: { id: { in: chatPartnerIds } },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        kycDocument: true,
        vendorApplication:true,
        Session: {
          select: {
            id: true,
            devicePlatform: true,
            deviceToken: true,
            lastSeen: true,
            isOnline: true,
          },
        },
      },
    });

    // ⚙️ 5️⃣ Combine results into structured output
    const chats = users.map((user) => ({
      user,
      lastMessage: chatMap.get(user.id),
      unreadCount: unreadMap[user.id] || 0,
    }));

    // 📆 Sort chats by latest message time
    chats.sort(
      (a, b) =>
        new Date(b.lastMessage?.createdAt).getTime() -
        new Date(a.lastMessage?.createdAt).getTime()
    );

    return successResponse(res, "Chats retrieved successfully", chats);
  } catch (err) {
    console.error("❌ getAllUserChats error:", err);
    return errorResponse(res, "Failed to get user chats");
  }
};

