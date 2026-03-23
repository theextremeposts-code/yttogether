const ding = new Audio("https://www.soundjay.com/buttons/sounds/button-3.mp3");

let socket = io("https://yttogether.onrender.com");
let player;
let ready = false;
let ignoreEmit = false;

const urlParams = new URLSearchParams(window.location.search);
const userParam = urlParams.get("user")?.toLowerCase();
const userName = userParam === "aadi" ? "Aadi" : userParam === "varna" ? "Varna" : "Guest";
const friendName = userName === "Aadi" ? "Varna" : "Aadi";

const label = document.getElementById("userLabel");
if (label) {
  label.textContent = `Hi ${userName} 🌹`;
}

function getYouTubeVideoID(url) {
  const match = url.match(/(?:v=|youtu\.be\/)([^&]+)/);
  return match ? match[1] : null;
}

document.getElementById("youtubeUrl").addEventListener("keydown", function (e) {
  if (e.key === "Enter" || e.keyCode === 13) {
    e.preventDefault();
    const url = e.target.value.trim();
    const videoId = getYouTubeVideoID(url);
    if (videoId) {
      console.log(`[${userName}] Emitting loadVideo:`, videoId);
      loadVideo(videoId);
      socket.emit("loadVideo", videoId);
      e.target.blur();
    }
  }
});

document.getElementById("youtubeUrl").addEventListener("keyup", function (e) {
  if ((e.key === "Enter" || e.keyCode === 13) && e.target.value.trim() !== "") {
    e.preventDefault();
    const url = e.target.value.trim();
    const videoId = getYouTubeVideoID(url);
    if (videoId) {
      loadVideo(videoId);
      socket.emit("loadVideo", videoId);
      e.target.blur(); // hide keyboard
    }
  }
});

const chatInput = document.getElementById("chatInput");
let typingTimeout;

chatInput.addEventListener("keypress", function (e) {
  if (e.key === "Enter" && this.value.trim() !== "") {
    const msgObj = { name: userName, text: this.value };
    console.log(`[${userName}] Sending chat:`, msgObj);
    socket.emit("chatMessage", msgObj);
    appendMessage(`<span class="username ${userName.toLowerCase()}">${userName}</span>: ${this.value}`);
    this.value = "";
    socket.emit("stopTyping");
  }
});

chatInput.addEventListener("input", () => {
  socket.emit("typing");
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => socket.emit("stopTyping"), 1000);
});

function appendMessage(msg, isRemote = false) {
  const msgBox = document.getElementById("messages");
  const msgDiv = document.createElement("div");
  msgDiv.innerHTML = msg; // no timestamp
  msgBox.appendChild(msgDiv);
  msgBox.scrollTop = msgBox.scrollHeight;
  if (isRemote) ding.play();
}

function loadVideo(videoId) {
  if (player && typeof player.loadVideoById === "function") {
    console.log(`[${userName}] Reusing player, loading: ${videoId}`);
    player.loadVideoById(videoId);
  } else {
    console.log(`[${userName}] Creating new player for: ${videoId}`);
    player = new YT.Player("player", {
      videoId,
      events: {
        onReady: (event) => {
          console.log(`[${userName}] Player ready`);
          ready = true;
        },
        onStateChange: onPlayerStateChange
      }
    });
  }

  if (player && typeof player.addEventListener === "function" && !player._eventHooked) {
    player.addEventListener("onStateChange", onPlayerStateChange);
    player._eventHooked = true;
  }
}

function onPlayerStateChange(event) {
  if (!ready || ignoreEmit) return;
  const currentTime = player.getCurrentTime();
  switch (event.data) {
    case YT.PlayerState.PLAYING:
      console.log(`[${userName}] Emitting PLAY at ${currentTime}`);
      socket.emit("play", currentTime);
      break;
    case YT.PlayerState.PAUSED:
      console.log(`[${userName}] Emitting PAUSE at ${currentTime}`);
      socket.emit("pause", currentTime);
      break;
  }
}

socket.on("loadVideo", (videoId) => {
  console.log(`[${userName}] Received loadVideo:`, videoId);
  loadVideo(videoId);
});

socket.on("play", (time) => {
  if (player && typeof player.seekTo === "function") {
    console.log(`[${userName}] Received play at ${time}`);
    ignoreEmit = true;
    player.seekTo(time, true);
    player.playVideo();
    setTimeout(() => (ignoreEmit = false), 500);
  } else {
    console.warn(`[${userName}] Cannot play: player not ready`);
  }
});

socket.on("pause", (time) => {
  if (player && typeof player.seekTo === "function") {
    console.log(`[${userName}] Received pause at ${time}`);
    ignoreEmit = true;
    player.seekTo(time, true);
    player.pauseVideo();
    setTimeout(() => (ignoreEmit = false), 500);
  } else {
    console.warn(`[${userName}] Cannot pause: player not ready`);
  }
});

socket.on("chatMessage", (msg) => {
  const cssClass = msg.name.toLowerCase();
  console.log(`[${userName}] Received chat from ${msg.name}: ${msg.text}`);
  appendMessage(`<span class="username ${cssClass}">${msg.name}</span>: ${msg.text}`, true);
});

socket.on("typing", () => {
  document.getElementById("typingIndicator").classList.remove("hidden");
});
socket.on("stopTyping", () => {
  document.getElementById("typingIndicator").classList.add("hidden");
});
