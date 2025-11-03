const jwt = require("jsonwebtoken");
const User = require("../models/senderReceiver");
const Chat = require("../models/chat");

class SocketService {
  constructor(io) {
    this.io = io;
    this.userSockets = new Map(); // userId -> socketId
    this.socketUsers = new Map(); // socketId -> userId
    this.userStatus = new Map(); // userId -> "online"/"offline"
    this.typingUsers = new Map(); // chatId -> Set of typing userIds
    this.setupSocketHandlers();
  }

  setupSocketHandlers() {
    this.io.on("connection", (socket) => {
      console.log("New socket connection:", socket.id);

      // Authenticate
      socket.on("authenticate", async (data) => {
        try {
          await this.authenticateUser(socket, data);
        } catch (error) {
          console.error("Socket authentication error:", error);
          socket.emit("auth_error", { message: "Authentication failed" });
        }
      });

      // Join chat
      socket.on("join_chat", async (data) => {
        try {
          await this.joinChatRoom(socket, data);
        } catch (error) {
          console.error("Join chat error:", error);
          socket.emit("error", { message: "Failed to join chat" });
        }
      });

      // Leave chat
      socket.on("leave_chat", (data) => {
        try {
          this.leaveChatRoom(socket, data);
        } catch (error) {
          console.error("Leave chat error:", error);
        }
      });

      // Typing indicators
      socket.on("typing_start", (data) => {
        this.handleTypingStart(socket, data);
      });

      socket.on("typing_stop", (data) => {
        this.handleTypingStop(socket, data);
      });

      // Status updates
      socket.on("update_status", (data) => {
        this.updateUserStatus(socket, data);
      });

      // Send message in real-time
      socket.on("send_message", async (data) => {
        try {
          await this.handleSendMessage(socket, data);
        } catch (error) {
          console.error("Send message error:", error);
          socket.emit("error", { message: "Failed to send message" });
        }
      });

      // Disconnect
      socket.on("disconnect", () => {
        console.log("Socket disconnected:", socket.id);
        this.handleDisconnection(socket);
      });
    });
  }

  /** AUTHENTICATION */
  async authenticateUser(socket, data) {
    const { token } = data;
    if (!token) throw new Error("No token provided");

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select(
      "fullName email phoneNumber profilePhoto role"
    );

    if (!user) throw new Error("User not found");

    // Store mappings
    this.userSockets.set(user._id.toString(), socket.id);
    this.socketUsers.set(socket.id, user._id.toString());
    this.userStatus.set(user._id.toString(), "online");

    socket.user = user;

    console.log(`✅ Authenticated: ${user.fullName} (${socket.id})`);

    socket.emit("auth_success", { user });

    await this.broadcastUserStatus(user._id.toString(), "online");
  }

  /** JOIN CHAT */
  async joinChatRoom(socket, { chatId }) {
    if (!socket.user)
      return socket.emit("error", { message: "Not authenticated" });
    if (!chatId) return socket.emit("error", { message: "Chat ID required" });

    const chat = await Chat.findById(chatId);
    if (!chat) return socket.emit("error", { message: "Chat not found" });
    if (!chat.isParticipant(socket.user._id)) {
      return socket.emit("error", { message: "Access denied" });
    }

    socket.join(chatId);

    console.log(`User ${socket.user.fullName} joined chat ${chatId}`);

    socket.emit("chat_joined", { chatId });

    socket.to(chatId).emit("user_joined_chat", {
      chatId,
      user: {
        id: socket.user._id,
        fullName: socket.user.fullName,
        profilePhoto: socket.user.profilePhoto,
      },
    });
  }

  /** LEAVE CHAT */
  leaveChatRoom(socket, { chatId }) {
    if (!socket.user || !chatId) return;

    socket.leave(chatId);

    console.log(`User ${socket.user.fullName} left chat ${chatId}`);

    this.handleTypingStop(socket, { chatId });

    socket.to(chatId).emit("user_left_chat", {
      chatId,
      user: {
        id: socket.user._id,
        fullName: socket.user.fullName,
      },
    });

    socket.emit("chat_left", { chatId });
  }

  /** TYPING */
  handleTypingStart(socket, { chatId }) {
    if (!socket.user || !chatId) return;

    if (!this.typingUsers.has(chatId)) {
      this.typingUsers.set(chatId, new Set());
    }
    this.typingUsers.get(chatId).add(socket.user._id.toString());

    socket.to(chatId).emit("user_typing_start", {
      chatId,
      user: {
        id: socket.user._id,
        fullName: socket.user.fullName,
      },
    });
  }

  handleTypingStop(socket, { chatId }) {
    if (!socket.user || !chatId) return;

    if (this.typingUsers.has(chatId)) {
      this.typingUsers.get(chatId).delete(socket.user._id.toString());
      if (this.typingUsers.get(chatId).size === 0) {
        this.typingUsers.delete(chatId);
      }
    }

    socket.to(chatId).emit("user_typing_stop", {
      chatId,
      user: {
        id: socket.user._id,
        fullName: socket.user.fullName,
      },
    });
  }

  /** STATUS */
  updateUserStatus(socket, { status }) {
    if (!socket.user) return;

    const validStatuses = ["online", "away", "busy", "offline"];
    if (!validStatuses.includes(status)) {
      return socket.emit("error", { message: "Invalid status" });
    }

    this.userStatus.set(socket.user._id.toString(), status);

    console.log(`User ${socket.user.fullName} status → ${status}`);

    this.broadcastUserStatus(socket.user._id.toString(), status);

    socket.emit("status_updated", { status });
  }

  async broadcastUserStatus(userId, status) {
    const chats = await Chat.find({
      "participants.userId": userId,
      status: "active",
    }).populate("participants.userId", "_id");

    const participantIds = new Set();
    chats.forEach((chat) => {
      chat.participants.forEach((p) => {
        const pid = p.userId._id.toString();
        if (pid !== userId) participantIds.add(pid);
      });
    });

    participantIds.forEach((pid) => {
      const socketId = this.userSockets.get(pid);
      if (socketId) {
        this.io.to(socketId).emit("user_status_update", {
          userId,
          status,
          timestamp: new Date(),
        });
      }
    });
  }

  /** REAL-TIME MESSAGE */
  async handleSendMessage(
    socket,
    { chatId, message, messageType = "text", imageUrl }
  ) {
    if (!socket.user) return;

    const chat = await Chat.findById(chatId);
    if (!chat || !chat.isParticipant(socket.user._id)) {
      return socket.emit("error", {
        message: "Chat not found or access denied",
      });
    }

    const newMessage = chat.addMessage(
      socket.user._id,
      message,
      messageType,
      imageUrl
    );
    await chat.save();

    this.io.to(chatId).emit("new_message", {
      chatId,
      message: {
        id: newMessage._id,
        senderId: socket.user._id,
        senderName: socket.user.fullName,
        senderProfilePhoto: socket.user.profilePhoto,
        message: newMessage.message,
        messageType: newMessage.messageType,
        imageUrl: newMessage.imageUrl,
        createdAt: newMessage.createdAt,
      },
    });
  }

  /** DISCONNECT */
  handleDisconnection(socket) {
    if (!socket.user) return;

    const userId = socket.user._id.toString();
    this.userSockets.delete(userId);
    this.socketUsers.delete(socket.id);
    this.userStatus.set(userId, "offline");

    this.typingUsers.forEach((set, chatId) => {
      if (set.has(userId)) {
        set.delete(userId);
        socket.to(chatId).emit("user_typing_stop", {
          chatId,
          user: { id: socket.user._id, fullName: socket.user.fullName },
        });
        if (set.size === 0) this.typingUsers.delete(chatId);
      }
    });

    console.log(`❌ Disconnected: ${socket.user.fullName}`);

    this.broadcastUserStatus(userId, "offline");
  }

  /** HELPERS */
  getUserStatus(userId) {
    return this.userStatus.get(userId) || "offline";
  }

  getOnlineUsers() {
    return [...this.userStatus.entries()]
      .filter(([_, status]) => status === "online")
      .map(([userId]) => userId);
  }

  isUserOnline(userId) {
    return this.userStatus.get(userId) === "online";
  }

  sendToUser(userId, event, data) {
    const socketId = this.userSockets.get(userId);
    if (socketId) {
      this.io.to(socketId).emit(event, data);
      return true;
    }
    return false;
  }

  sendToChat(chatId, event, data) {
    this.io.to(chatId).emit(event, data);
  }

  getTypingUsers(chatId) {
    return Array.from(this.typingUsers.get(chatId) || []);
  }
}

module.exports = SocketService;
