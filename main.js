const ding = new Audio("https://www.soundjay.com/buttons/sounds/button-3.mp3");

let socket;
let player;
let ready = false;
let ignoreEmit = false;

const allowedUsers = ["aadi", "varna"];
let savedUser = localStorage.getItem("user");

const identityScreen = document.getElementById("identity-screen");

async function getVideoDetails(videoId) {
  try {
    const res = await fetch(
      `https://ytsearch-psi.vercel.app/api?q=${videoId}`
    );
    const data = await res.json();

    if (data?.videos?.length > 0) {
      return {
        title: data.videos[0].title,
        thumbnail: data.videos[0].thumbnail
      };
    }
  } catch (e) {
    console.error("Metadata fetch failed", e);
  }

  return null;
}

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
  socket.emit("getWatchlist");
});

socket.on("disconnect", () => {
  console.log("❌ Disconnected");
});

  // ================= VIDEO =================

function getYouTubeVideoID(input) {
  try {
    const url = new URL(input);

    // youtube.com or m.youtube.com
    if (url.hostname.includes("youtube.com")) {
      return url.searchParams.get("v");
    }

    // youtu.be short links
    if (url.hostname === "youtu.be") {
      return url.pathname.split("/")[1];
    }

    return null;
  } catch {
    return null;
  }
}

async function searchYouTube(query) {
  try {
    const res = await fetch(
      `https://ytsearch-psi.vercel.app/api?q=${encodeURIComponent(query)}`
    );

    const data = await res.json();

    console.log("Search response:", data); // 👈 add this

    if (data?.videos?.length > 0) {
      return data.videos[0].id;
    }

    return null;
  } catch (err) {
    console.error("Search failed:", err);
    return null;
  }
}

  document.getElementById("youtubeUrl").addEventListener("keydown", async function (e) {
  if (e.key === "Enter") {
    e.preventDefault();

    const input = e.target.value.trim();

    let videoId = getYouTubeVideoID(input);

    // If not a URL → search
    if (!videoId) {
      console.log("🔍 Searching YouTube for:", input);
      videoId = await searchYouTube(input);
    }

    if (videoId) {
      console.log(`[${userName}] Loading:`, videoId);
      loadVideo(videoId);
      socket.emit("loadVideo", videoId);
      saveCurrentVideo(videoId);
      e.target.blur();
    } else {
      console.warn("No video found");
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
    socket.emit("typing", { name: userName });
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
	currentVideoIdGlobal = videoId;
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

  // ================= WATCHLIST UI =================

socket.on("watchlistUpdated", (list) => {
  const container = document.getElementById("watchlist");

  if (!container) {
    console.error("Watchlist container not found!");
    return;
  }

  container.innerHTML = ""; // clear old UI

  list.forEach(item => {
    const div = document.createElement("div");

    div.innerHTML = `
      <img src="${item.thumbnail}" />
      <span>${item.title}</span>
      <button onclick="playSaved('${item.videoId}')">▶</button>
      <button onclick="deleteSaved(${item.id})">❌</button>
    `;

    container.appendChild(div);
  });
});

  socket.on("typing", (data) => {
  const indicator = document.getElementById("typingIndicator");

  if (data && data.name) {
    indicator.textContent = `${data.name} is typing...`;
  }

  indicator.classList.remove("hidden");
});

  socket.on("stopTyping", () => {
  const indicator = document.getElementById("typingIndicator");
  indicator.classList.add("hidden");
  indicator.textContent = ""; // reset
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

let currentVideoIdGlobal = null;

async function saveCurrentVideo(videoId) {
  if (!videoId) return;

  const details = await getVideoDetails(videoId);
  if (!details) return;

  socket.emit("addVideo", {
    videoId,
    title: details.title,
    thumbnail: details.thumbnail
  });

  console.log("✅ Saved:", videoId);
}

function playSaved(videoId) {
  if (typeof loadVideo === "function") {
    loadVideo(videoId);
    socket.emit("loadVideo", videoId);
  }
}

function deleteSaved(id) {
  socket.emit("deleteVideo", id);
}

document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {

    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");

    const tabName = tab.dataset.tab;

    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));

    if (tabName === "chat") {
      document.getElementById("chat-container").classList.add("active");
    } else {
      document.getElementById("watchlist-container").classList.add("active");
    }
  });
});

document.getElementById("saveBtn").addEventListener("click", () => {
  if (currentVideoIdGlobal) {
    saveCurrentVideo(currentVideoIdGlobal);
  }
});