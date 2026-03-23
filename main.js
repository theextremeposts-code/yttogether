const ding = new Audio("https://www.soundjay.com/buttons/sounds/button-3.mp3");

let socket;
let player;
let ready = false;
let ignoreEmit = false;

const allowedUsers = ["aadi", "varna"];
let savedUser = localStorage.getItem("user");

const identityScreen = document.getElementById("identity-screen");

// ================= IDENTITY FLOW =================

// If already known → skip selection screen
if (savedUser && allowedUsers.includes(savedUser)) {
  identityScreen.classList.add("hidden");
  initApp(savedUser);
} else {
  // Wait for button click
  document.querySelectorAll(".identity-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const selected = btn.dataset.user;

      localStorage.setItem("user", selected);

      identityScreen.classList.add("hidden");

      setTimeout(() => {
        initApp(selected);
      }, 400);
    });
  });
}

// ================= MAIN APP =================

function initApp(user) {

  const userName = user === "aadi" ? "Aadi" : "Varna";
  const friendName = userName === "Aadi" ? "Varna" : "Aadi";

  const label = document.getElementById("userLabel");
  if (label) {
    label.textContent = `Hi ${userName} 🌹`;
  }

  // ✅ Socket connection AFTER identity is known
  socket = io("https://yttogether.onrender.com", {
  query: { user },
  transports: ["websocket", "polling"],
});

// Debug logs
socket.on("connect", () => {
  console.log("✅ Connected:", socket.id);
});

socket.on("disconnect", () => {
  console.log("❌ Disconnected");
});

  // ================= VIDEO =================

  function getYouTubeVideoID(url) {
    const match = url.match(/(?:v=|youtu\.be\/)([^&]+)/);
    return match ? match[1] : null;
  }

  document.getElementById("youtubeUrl").addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
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
    if (e.key === "Enter" && e.target.value.trim() !== "") {
      e.preventDefault();
      const url = e.target.value.trim();
      const videoId = getYouTubeVideoID(url);
      if (videoId) {
        loadVideo(videoId);
        socket.emit("loadVideo", videoId);
        e.target.blur();
      }
    }
  });

  // ================= CHAT =================

  const chatInput = document.getElementById("chatInput");
  let typingTimeout;

  chatInput.addEventListener("keypress", function (e) {
    if (e.key === "Enter" && this.value.trim() !== "") {
      const msgObj = { name: userName, text: this.value };
      console.log(`[${userName}] Sending chat:`, msgObj);

      socket.emit("chatMessage", msgObj);

      appendMessage(
        `<span class="username ${userName.toLowerCase()}">${userName}</span>: ${this.value}`
      );

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
    msgDiv.innerHTML = msg;
    msgBox.appendChild(msgDiv);
    msgBox.scrollTop = msgBox.scrollHeight;

    if (isRemote) ding.play();
  }

  // ================= PLAYER =================

  function loadVideo(videoId) {
    if (player && typeof player.loadVideoById === "function") {
      console.log(`[${userName}] Reusing player, loading: ${videoId}`);
      player.loadVideoById(videoId);
    } else {
      console.log(`[${userName}] Creating new player for: ${videoId}`);
      player = new YT.Player("player", {
        videoId,
        events: {
          onReady: () => {
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

  // ================= SOCKET EVENTS =================

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
    }
  });

  socket.on("pause", (time) => {
    if (player && typeof player.seekTo === "function") {
      console.log(`[${userName}] Received pause at ${time}`);
      ignoreEmit = true;
      player.seekTo(time, true);
      player.pauseVideo();
      setTimeout(() => (ignoreEmit = false), 500);
    }
  });

  socket.on("chatMessage", (msg) => {
    const cssClass = msg.name.toLowerCase();
    console.log(`[${userName}] Received chat from ${msg.name}: ${msg.text}`);
    appendMessage(
      `<span class="username ${cssClass}">${msg.name}</span>: ${msg.text}`,
      true
    );
  });

  socket.on("typing", () => {
    document.getElementById("typingIndicator").classList.remove("hidden");
  });

  socket.on("stopTyping", () => {
    document.getElementById("typingIndicator").classList.add("hidden");
  });

  socket.on("unauthorized", () => {
    localStorage.removeItem("user");

    document.body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#121212;color:white;font-family:sans-serif;text-align:center;">
        <div>
          <h2>Access Denied 🚫</h2>
          <p>Unauthorized user.</p>
        </div>
      </div>
    `;
  });
}
