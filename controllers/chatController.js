const mongoose = require("mongoose");
const Chat = require("../models/chat");
const User = require("../models/senderReceiver");
const Delivery = require("../models/delivery");

// GET all conversations for current user
exports.getConversations = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status = "active",
      includeArchived = false,
    } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const chats = await Chat.findForUser(req.user._id, {
      status,
      limit: parseInt(limit),
      skip,
      includeArchived: includeArchived === "true",
    });

    const totalQuery = { "participants.userId": req.user._id };
    if (includeArchived !== "true") totalQuery.status = status;

    const total = await Chat.countDocuments(totalQuery);

    const transformedChats = chats.map((chat) => {
      const otherParticipants = chat.getOtherParticipants(req.user._id);
      const unreadCount = chat.getUnreadCount(req.user._id);

      return {
        id: chat._id,
        title: chat.title,
        chatType: chat.chatType,
        participants: otherParticipants.map((p) => ({
          id: p.userId._id,
          name: p.userId.fullName,
          email: p.userId.email,
          profilePhoto: p.userId.profilePhoto,
          role: p.userId.role,
        })),
        lastMessage: chat.lastMessage
          ? {
              message: chat.lastMessage.message,
              timestamp: chat.lastMessage.timestamp,
              senderId: chat.lastMessage.senderId,
            }
          : null,
        unreadCount,
        status: chat.status,
        deliveryId: chat.deliveryId,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
      };
    });

    res.json({
      success: true,
      conversations: transformedChats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Get conversations error:", error);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

// GET specific conversation with messages
exports.getConversationById = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid conversation ID" });
    }

    const chat = await Chat.findById(id)
      .populate("participants.userId", "fullName email profilePhoto role")
      .populate("deliveryId", "pickupLocation dropoffLocation status createdAt")
      .populate("messages.senderId", "fullName profilePhoto");

    if (!chat)
      return res
        .status(404)
        .json({ success: false, error: "Conversation not found" });
    if (!chat.isParticipant(req.user._id)) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const totalMessages = chat.messages.length;

    const paginatedMessages = chat.messages
      .slice()
      .reverse()
      .slice(skip, skip + parseInt(limit))
      .reverse();

    chat.markMessagesAsRead(req.user._id);
    await chat.save();

    res.json({
      success: true,
      conversation: {
        id: chat._id,
        title: chat.title,
        chatType: chat.chatType,
        participants: chat.participants.map((p) => ({
          id: p.userId._id,
          name: p.userId.fullName,
          email: p.userId.email,
          profilePhoto: p.userId.profilePhoto,
          role: p.userId.role,
          joinedAt: p.joinedAt,
        })),
        delivery: chat.deliveryId,
        status: chat.status,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
      },
      messages: paginatedMessages.map((msg) => ({
        id: msg._id,
        senderId: msg.senderId._id,
        senderName: msg.senderId.fullName,
        senderProfilePhoto: msg.senderId.profilePhoto,
        message: msg.message,
        messageType: msg.messageType,
        isRead: msg.isRead,
        readAt: msg.readAt,
        isEdited: msg.isEdited,
        editedAt: msg.editedAt,
        createdAt: msg.createdAt,
        updatedAt: msg.updatedAt,
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalMessages,
        pages: Math.ceil(totalMessages / parseInt(limit)),
        hasMore: skip + parseInt(limit) < totalMessages,
      },
    });
  } catch (error) {
    console.error("Get conversation error:", error);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

// POST new conversation
exports.createConversation = async (req, res) => {
  try {
    const {
      recipientId,
      message,
      deliveryId,
      chatType = "delivery_related",
    } = req.body;

    if (recipientId === req.userId) {
      return res.status(400).json({
        success: false,
        error: "Cannot start conversation with yourself",
      });
    }

    const recipient = await User.findById(recipientId).select("fullName role");
    if (!recipient)
      return res
        .status(404)
        .json({ success: false, error: "Recipient not found" });

    if (deliveryId) {
      const delivery = await Delivery.findById(deliveryId);
      if (!delivery)
        return res
          .status(404)
          .json({ success: false, error: "Delivery not found" });

      const isOwner = delivery.userId?.toString() === req.userId;
      const isAssignedDriver = delivery.driverId?.toString() === req.userId;
      if (!isOwner && !isAssignedDriver) {
        return res
          .status(403)
          .json({ success: false, error: "Not authorized for this delivery" });
      }
    }

    const chat = await Chat.createOrFindChat(
      req.user._id,
      recipientId,
      deliveryId,
      chatType
    );
    chat.addMessage(req.user._id, message);
    await chat.save();

    await chat.populate(
      "participants.userId",
      "fullName email profilePhoto role"
    );
    await chat.populate("messages.senderId", "fullName profilePhoto");

    if (req.io) {
      const recipientSocketId = req.io.userSockets.get(recipientId);
      if (recipientSocketId) {
        req.io.to(recipientSocketId).emit("new_message", {
          chatId: chat._id,
          message: chat.messages[chat.messages.length - 1],
          sender: {
            id: req.user._id,
            name: req.user.fullName,
            profilePhoto: req.user.profilePhoto,
          },
        });
      }
    }

    res.status(201).json({ success: true, conversation: chat });
  } catch (error) {
    console.error("Create conversation error:", error);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

// POST send message
exports.sendMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { message, messageType = "text", imageUrl } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid conversation ID" });
    }

    const chat = await Chat.findById(id).populate(
      "participants.userId",
      "fullName profilePhoto role"
    );
    if (!chat)
      return res
        .status(404)
        .json({ success: false, error: "Conversation not found" });
    if (!chat.isParticipant(req.user._id))
      return res.status(403).json({ success: false, error: "Access denied" });
    if (chat.status !== "active")
      return res
        .status(400)
        .json({ success: false, error: "Conversation inactive" });

    const newMessage = chat.addMessage(
      req.user._id,
      message,
      messageType,
      imageUrl
    );
    await chat.save();
    await chat.populate("messages.senderId", "fullName profilePhoto");

    const populatedMessage = chat.messages[chat.messages.length - 1];

    if (req.io) {
      const otherParticipants = chat.getOtherParticipants(req.user._id);
      otherParticipants.forEach((participant) => {
        const socketId = req.io.userSockets.get(
          participant.userId._id.toString()
        );
        if (socketId) {
          req.io.to(socketId).emit("new_message", {
            chatId: chat._id,
            message: {
              id: populatedMessage._id,
              senderId: populatedMessage.senderId._id,
              senderName: populatedMessage.senderId.fullName,
              senderProfilePhoto: populatedMessage.senderId.profilePhoto,
              message: populatedMessage.message,
              messageType: populatedMessage.messageType,
              createdAt: populatedMessage.createdAt,
            },
          });
        }
      });
    }

    res
      .status(201)
      .json({ success: true, message: "Message sent", data: populatedMessage });
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

// PUT mark messages as read
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const { messageIds } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid conversation ID" });
    }

    const chat = await Chat.findById(id);
    if (!chat)
      return res
        .status(404)
        .json({ success: false, error: "Conversation not found" });
    if (!chat.isParticipant(req.user._id))
      return res.status(403).json({ success: false, error: "Access denied" });

    chat.markMessagesAsRead(req.user._id, messageIds || []);
    await chat.save();

    res.json({ success: true, message: "Messages marked as read" });
  } catch (error) {
    console.error("Mark as read error:", error);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

// PUT archive conversation
exports.archiveConversation = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ success: false, error: "Invalid ID" });

    const chat = await Chat.findById(id);
    if (!chat)
      return res
        .status(404)
        .json({ success: false, error: "Conversation not found" });
    if (!chat.isParticipant(req.user._id))
      return res.status(403).json({ success: false, error: "Access denied" });

    chat.status = "archived";
    chat.metadata.archivedAt = new Date();
    await chat.save();

    res.json({ success: true, message: "Conversation archived" });
  } catch (error) {
    console.error("Archive error:", error);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

// GET total unread count
exports.getUnreadCount = async (req, res) => {
  try {
    const chats = await Chat.find({
      "participants.userId": req.user._id,
      status: "active",
    });
    const totalUnreadCount = chats.reduce(
      (total, chat) => total + chat.getUnreadCount(req.user._id),
      0
    );

    res.json({ success: true, unreadCount: totalUnreadCount });
  } catch (error) {
    console.error("Unread count error:", error);
    res.status(500).json({ success: false, error: "Server error" });
  }
};
