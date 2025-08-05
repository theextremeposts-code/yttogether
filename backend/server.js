const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

let connectedUsers = [];
let currentVideoId = null;
let currentVideoTime = 0;
let isPlaying = false;

io.on("connection", (socket) => {
  if (connectedUsers.length >= 2) {
    socket.emit("full", "Only 2 users allowed at a time.");
    socket.disconnect(true);
    return;
  }

  connectedUsers.push(socket.id);
  console.log("User connected:", socket.id);

  const room = "main";
  socket.join(room);

  // 🆕 Send current video state to new user
  if (currentVideoId) {
    socket.emit("loadVideo", currentVideoId);
    socket.emit(isPlaying ? "play" : "pause", currentVideoTime);
  }

  socket.on("loadVideo", (videoId) => {
    currentVideoId = videoId;
    currentVideoTime = 0;
    isPlaying = false;
    socket.to(room).emit("loadVideo", videoId);
  });

  socket.on("play", (time) => {
    currentVideoTime = time;
    isPlaying = true;
    socket.to(room).emit("play", time);
  });

  socket.on("pause", (time) => {
    currentVideoTime = time;
    isPlaying = false;
    socket.to(room).emit("pause", time);
  });

  socket.on("chatMessage", (msg) => {
    socket.to(room).emit("chatMessage", msg);
  });

  socket.on("typing", () => {
    socket.to(room).emit("typing");
  });

  socket.on("stopTyping", () => {
    socket.to(room).emit("stopTyping");
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    connectedUsers = connectedUsers.filter((id) => id !== socket.id);
  });
});

app.get("/", (req, res) => {
  res.send("Socket server is running.");
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
