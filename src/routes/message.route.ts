import { Router } from "express";
import { sendMessageRest, getConversation, markAsRead, getAllUserChats } from "../controllers/message.controller";
import { authMiddleware } from "../middleware/auth";

const router = Router();

// Send message
router.post("/", authMiddleware, sendMessageRest);

// Get conversation with another user
router.get("/:otherUserId", authMiddleware, getConversation);
router.get("/messages/chats", authMiddleware, getAllUserChats);
// Mark as read
router.post("/read", authMiddleware, markAsRead);

export default router;
