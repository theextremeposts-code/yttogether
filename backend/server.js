const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();

// ✅ FIX: define before use
const allowedOrigin = "*";

// CORS for Express
app.use(cors({
  origin: allowedOrigin
}));

const server = http.createServer(app);

// Socket.IO with strict origin check
const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      if (!origin || origin === allowedOrigin) {
        callback(null, true);
      } else {
        callback(new Error("CORS blocked: " + origin));
      }
    },
    methods: ["GET", "POST"]
  }
});

// Store connected users
let connectedUsers = [];

io.on("connection", (socket) => {

  const user = socket.handshake.query.user?.toLowerCase();
  const allowedUsers = ["aadi", "varna"];

  // 🚫 Block unauthorized users
  if (!user || !allowedUsers.includes(user)) {
    console.log("Blocked unauthorized user:", user);
    socket.emit("unauthorized", "Access denied");
    socket.disconnect(true);
    return;
  }

  // 🚫 Prevent same user joining twice
  const existingUser = connectedUsers.find(u => u.user === user);
  if (existingUser) {
    console.log(`Duplicate login blocked: ${user}`);
    socket.emit("duplicate", "User already connected");
    socket.disconnect(true);
    return;
  }

  // ✅ Allow connection
  connectedUsers.push({ id: socket.id, user });
  console.log(`User connected: ${user}`);

  // ================= SYNC EVENTS =================
  socket.on("play", (time) => {
    socket.broadcast.emit("play", time);
  });

  socket.on("pause", (time) => {
    socket.broadcast.emit("pause", time);
  });

  socket.on("loadVideo", (videoId) => {
    socket.broadcast.emit("loadVideo", videoId);
  });

  // ================= CHAT EVENTS =================
  socket.on("chatMessage", (msg) => {
    socket.broadcast.emit("chatMessage", msg);
  });

  socket.on("typing", (data) => {
    socket.broadcast.emit("typing", data);
  });

  socket.on("stopTyping", () => {
    socket.broadcast.emit("stopTyping");
  });

  // ================= DISCONNECT =================
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${user}`);
    connectedUsers = connectedUsers.filter((u) => u.id !== socket.id);
  });
});

// Basic route
app.get("/", (req, res) => {
  res.send("Private YT Sync server is running 🔒");
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
