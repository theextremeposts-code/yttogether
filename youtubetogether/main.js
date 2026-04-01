const ding = new Audio("https://www.soundjay.com/buttons/sounds/button-3.mp3");

let socket;
let player;
let ready = false;
let ignoreEmit = false;
let currentVideoIdGlobal = null;

const allowedUsers = ["aadi", "varna"];
let savedUser = localStorage.getItem("user");

const identityScreen = document.getElementById("identity-screen");

async function getVideoDetails(videoId) {
  try {
    const res = await fetch(`https://ytsearch-psi.vercel.app/api?q=${videoId}`);
    const data = await res.json();
    if (data?.videos?.length > 0) {
      return { title: data.videos.title, thumbnail: data.videos.thumbnail };
    }
  } catch (e) {
    console.error("Metadata fetch failed", e);
  }
  return null;
}

function getYouTubeVideoID(input) {
  try {
    const url = new URL(input);
    if (url.hostname.includes("youtube.com")) return url.searchParams.get("v");
    if (url.hostname === "youtu.be") return url.pathname.split("/");
    return null;
  } catch {
    return null;
  }
}

async function searchYouTube(query) {
  try {
    const res = await fetch(`https://ytsearch-psi.vercel.app/api?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    if (data?.videos?.length > 0) return data.videos.id;
    return null;
  } catch (err) {
    console.error("Search failed:", err);
    return null;
  }
}

if (savedUser && allowedUsers.includes(savedUser)) {
  identityScreen.classList.add("hidden");
  initApp(savedUser);
} else {
  document.querySelectorAll(".identity-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const selected = btn.dataset.user;
      localStorage.setItem("user", selected);
      identityScreen.classList.add("hidden");
      setTimeout(() => { initApp(selected); }, 400);
    });
  });
}

function initApp(user) {
  const userName = user === "aadi" ? "Aadi" : "Varna";
  const label = document.getElementById("userLabel");
  if (label) label.textContent = `Hi ${userName} 🌹`;

  socket = io("https://yttogether.onrender.com", {
    query: { user },
    transports: ["websocket", "polling"],
  });

  socket.on("connect", () => {
    console.log("✅ Connected:", socket.id);
    socket.emit("getWatchlist");
  });

  socket.on("disconnect", () => {
    console.log("❌ Disconnected");
  });

  document.getElementById("youtubeUrl").addEventListener("keydown", async function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      const input = e.target.value.trim();
      let videoId = getYouTubeVideoID(input);

      if (!videoId) {
        console.log("🔍 Searching YouTube for:", input);
        videoId = await searchYouTube(input);
      }

      if (videoId) {
        console.log(`[${userName}] Loading:`, videoId);
        loadVideo(videoId);
        socket.emit("loadVideo", videoId);
        e.target.blur();
      } else {
        console.warn("No video found");
      }
    }
  });

  const chatInput = document.getElementById("chatInput");
  let typingTimeout;

  chatInput.addEventListener("keypress", function (e) {
    if (e.key === "Enter" && this.value.trim() !== "") {
      const msgObj = { name: userName, text: this.value };
      socket.emit("chatMessage", msgObj);
      appendMessage(`<span class="username ${userName.toLowerCase()}">${userName}</span>: ${this.value}`);
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

  function loadVideo(videoId) {
    if (player && typeof player.loadVideoById === "function") {
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
        socket.emit("play", currentTime);
        break;
      case YT.PlayerState.PAUSED:
        socket.emit("pause", currentTime);
        break;
    }
  }

  socket.on("loadVideo", (videoId) => { loadVideo(videoId); });

  socket.on("play", (time) => {
    if (player && typeof player.seekTo === "function") {
      ignoreEmit = true;
      player.seekTo(time, true);
      player.playVideo();
      setTimeout(() => (ignoreEmit = false), 500);
    }
  });

  socket.on("pause", (time) => {
    if (player && typeof player.seekTo === "function") {
      ignoreEmit = true;
      player.seekTo(time, true);
      player.pauseVideo();
      setTimeout(() => (ignoreEmit = false), 500);
    }
  });

  socket.on("chatMessage", (msg) => {
    const cssClass = msg.name.toLowerCase();
    appendMessage(`<span class="username ${cssClass}">${msg.name}</span>: ${msg.text}`, true);
  });

  socket.on("watchlistUpdated", (list) => {
    const container = document.getElementById("watchlist");
    if (!container) return;
    container.innerHTML = ""; 

    const folders = ["Movies", "Telugu", "Tamil", "Hindi", "English", "Malayalam", "Others"];

    folders.forEach(folder => {
      const folderItems = list.filter(item => item.category === folder || (!item.category && folder === "Others"));
      
      if (folderItems.length > 0) {
        const folderHeader = document.createElement("h5");
        folderHeader.textContent = `📁 ${folder}`;
        folderHeader.style.color = "#00bfff";
        folderHeader.style.margin = "15px 0 8px 0";
        folderHeader.style.borderBottom = "1px solid #333";
        folderHeader.style.paddingBottom = "4px";
        container.appendChild(folderHeader);

        folderItems.forEach(item => {
          const div = document.createElement("div");
          div.innerHTML = `
            <img src="${item.thumbnail}" />
            <span>${item.title}</span>
            <button onclick="playSaved('${item.videoId}')">▶</button>
            <button onclick="deleteSaved(${item.id})">❌</button>
          `;
          container.appendChild(div);
        });
      }
    });
  });

  socket.on("typing", (data) => {
    const indicator = document.getElementById("typingIndicator");
    if (data && data.name) indicator.textContent = `${data.name} is typing...`;
    indicator.classList.remove("hidden");
  });

  socket.on("stopTyping", () => {
    const indicator = document.getElementById("typingIndicator");
    indicator.classList.add("hidden");
    indicator.textContent = "";
  });

  socket.on("unauthorized", () => {
    localStorage.removeItem("user");
    document.body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#121212;color:white;font-family:sans-serif;text-align:center;">
        <div><h2>Access Denied 🚫</h2><p>Unauthorized user.</p></div>
      </div>`;
  });
}

async function saveCurrentVideo(videoId, category) {
  if (!videoId) return;
  const details = await getVideoDetails(videoId);
  if (!details) return;

  if (socket) {
    socket.emit("addVideo", {
      videoId,
      title: details.title,
      thumbnail: details.thumbnail,
      category: category 
    });
    console.log(`✅ Saved: ${videoId} in folder: ${category}`);
  }
}

function playSaved(videoId) {
  if (currentVideoIdGlobal && socket) {
      socket.emit("loadVideo", videoId);
      document.getElementById("youtubeUrl").value = `https://youtube.com/watch?v=${videoId}`;
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      document.getElementById("youtubeUrl").dispatchEvent(enterEvent);
  }
}

function deleteSaved(id) {
  if (socket) socket.emit("deleteVideo", id);
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

document.getElementById("saveBtn").addEventListener("click", async () => {
  const input = document.getElementById("youtubeUrl").value.trim();
  const category = document.getElementById("categorySelect").value;
  
  let videoId = getYouTubeVideoID(input) || currentVideoIdGlobal;

  if (!videoId && input) {
    console.log("🔍 Searching YouTube to save:", input);
    videoId = await searchYouTube(input);
  }

  if (videoId) {
    saveCurrentVideo(videoId, category);
    document.getElementById("youtubeUrl").value = "";
  } else {
    alert("Please load a video or enter a valid YouTube link to save.");
  }
});