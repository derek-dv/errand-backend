const express = require("express");
const { body, validationResult } = require("express-validator");
const chatController = require("../controllers/chatController");

const router = express.Router();

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: "Validation failed",
      details: errors.array(),
    });
  }
  next();
};

// Routes
router.get("/conversations", chatController.getConversations);
router.get("/conversations/:id", chatController.getConversationById);

router.post(
  "/conversations",
  [
    body("recipientId")
      .notEmpty()
      .isMongoId()
      .withMessage("Valid recipient ID required"),
    body("message")
      .notEmpty()
      .trim()
      .isLength({ min: 1, max: 1000 })
      .withMessage("Message must be 1–1000 chars"),
    body("deliveryId").optional().isMongoId(),
    body("chatType").optional().isIn(["delivery_related", "general_inquiry"]),
  ],
  handleValidationErrors,
  chatController.createConversation
);

router.post(
  "/conversations/:id/messages",
  [
    body("message").notEmpty().trim().isLength({ min: 1, max: 1000 }),
    body("messageType").optional().isIn(["text", "image"]),
  ],
  handleValidationErrors,
  chatController.sendMessage
);

router.put("/conversations/:id/read", chatController.markAsRead);
router.put("/conversations/:id/archive", chatController.archiveConversation);
router.get("/unread-count", chatController.getUnreadCount);

module.exports = router;
