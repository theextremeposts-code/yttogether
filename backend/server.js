const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins (you can restrict this to your Netlify URL)
    methods: ["GET", "POST"]
  }
});

let connectedUsers = [];

io.on("connection", (socket) => {
  if (connectedUsers.length >= 2) {
    socket.emit("full", "Only 2 users allowed at a time.");
    socket.disconnect(true);
    return;
  }

  connectedUsers.push(socket.id);
  console.log("User connected:", socket.id);

  // Sync events
  socket.on("play", (time) => {
    socket.broadcast.emit("play", time);
  });

  socket.on("pause", (time) => {
    socket.broadcast.emit("pause", time);
  });

  socket.on("loadVideo", (videoId) => {
    socket.broadcast.emit("loadVideo", videoId);
  });

  // Chat events
  socket.on("chatMessage", (msg) => {
    socket.broadcast.emit("chatMessage", msg);
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
