const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "watchlist.json");

function readWatchlist() {
  if (!fs.existsSync(DATA_FILE)) return [];
  return JSON.parse(fs.readFileSync(DATA_FILE));
}

function saveWatchlist(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}
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
  
  // ================= WATCHLIST EVENTS =================

// Get watchlist
socket.on("getWatchlist", () => {
  const list = readWatchlist();
  socket.emit("watchlistUpdated", list);
});

// Add video
socket.on("addVideo", (video) => {
  const list = readWatchlist();

  const newItem = {
    id: Date.now(),
    videoId: video.videoId,
    title: video.title,
    thumbnail: video.thumbnail,
    category: video.category || "Others" // Save the category
  };

  list.push(newItem);
  saveWatchlist(list);
  io.emit("watchlistUpdated", list);
});

// Delete video
socket.on("deleteVideo", (id) => {
  let list = readWatchlist();

  list = list.filter(item => item.id !== id);

  saveWatchlist(list);
  io.emit("watchlistUpdated", list);
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