const { Server } = require("socket.io");
const SocketService = require("./services/SocketService");

let io;
let socketService;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  // Initialize socket service
  socketService = new SocketService(io);

  console.log("✅ Socket.io initialized");
  return io;
};

const getIO = () => {
  if (!io) throw new Error("Socket.io not initialized. Call initSocket first.");
  return io;
};

const getSocketService = () => {
  if (!socketService)
    throw new Error("SocketService not initialized. Call initSocket first.");
  return socketService;
};

module.exports = {
  initSocket,
  getIO,
  getSocketService,
};
