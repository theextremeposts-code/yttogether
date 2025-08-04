const ding = new Audio("https://www.soundjay.com/buttons/sounds/button-3.mp3");

let socket = io("https://yttogether.onrender.com"); // Replace with your actual backend URL
let player;
let ready = false;
let ignoreEmit = false;

// Video URL input
document.getElementById("youtubeUrl").addEventListener("keypress", function (e) {
  if (e.key === "Enter") {
    const url = e.target.value.trim();
    const videoId = getYouTubeVideoID(url);
    if (videoId) {
      loadVideo(videoId);
      socket.emit("loadVideo", videoId);   
    }
  }
});

// Chat input and send
const chatInput = document.getElementById("chatInput");
let typingTimeout;

chatInput.addEventListener("keypress", function (e) {
  if (e.key === "Enter" && this.value.trim() !== "") {
    socket.emit("chatMessage", this.value);
    appendMessage("You: " + this.value);
    this.value = "";
    socket.emit("stopTyping");
  }
});

chatInput.addEventListener("input", () => {
  socket.emit("typing");

  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit("stopTyping");
  }, 1000);
});

// Append message with optional sound and timestamp
function appendMessage(msg, isRemote = false) {
  const msgBox = document.getElementById("messages");
  const msgDiv = document.createElement("div");

  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  msgDiv.textContent = `[${time}] ${msg}`;

  msgBox.appendChild(msgDiv);
  msgBox.scrollTop = msgBox.scrollHeight;

  if (isRemote) ding.play();
}

// Get video ID from YouTube URL
function getYouTubeVideoID(url) {
  const match = url.match(/(?:v=|youtu\.be\/)([^&]+)/);
  return match ? match[1] : null;
}

// Load or reload video
function loadVideo(videoId) {
  if (player) {
    player.loadVideoById(videoId);
  } else {
    player = new YT.Player("player", {
      videoId,
      events: {
        onReady: () => { ready = true; },
        onStateChange: onPlayerStateChange
      }
    });
  }
}

// Handle video state changes
function onPlayerStateChange(event) {
  if (!ready || ignoreEmit) return;

  switch (event.data) {
    case YT.PlayerState.PLAYING:
      socket.emit("play", player.getCurrentTime());
      break;
    case YT.PlayerState.PAUSED:
      socket.emit("pause", player.getCurrentTime());
      break;
  }
}

// Socket events
socket.on("play", (time) => {
  if (player) {
    ignoreEmit = true;
    player.seekTo(time, true);
    player.playVideo();
    setTimeout(() => (ignoreEmit = false), 500);
  }
});

socket.on("pause", (time) => {
  if (player) {
    ignoreEmit = true;
    player.seekTo(time, true);
    player.pauseVideo();
    setTimeout(() => (ignoreEmit = false), 500);
  }
});

socket.on("loadVideo", (videoId) => {
  loadVideo(videoId);
});

socket.on("chatMessage", (msg) => {
  appendMessage("Friend: " + msg, true);
});

// 👇 Typing indicator support
socket.on("typing", () => {
  document.getElementById("typingIndicator").textContent = "Friend is typing...";
});

socket.on("stopTyping", () => {
  document.getElementById("typingIndicator").textContent = "";
});

