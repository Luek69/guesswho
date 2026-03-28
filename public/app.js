const socket = io({
  transports: ["websocket", "polling"],
  reconnection: true
});

const state = {
  roomId: window.location.pathname.startsWith("/room/") ? window.location.pathname.split("/").pop().toUpperCase() : "",
  room: null,
  choosingSecret: false
};

const elements = {
  landing: document.getElementById("landing"),
  game: document.getElementById("game"),
  joinForm: document.getElementById("join-form"),
  playerName: document.getElementById("player-name"),
  roomCode: document.getElementById("room-code"),
  createRoom: document.getElementById("create-room"),
  connectionStatus: document.getElementById("connection-status"),
  roomTitle: document.getElementById("room-title"),
  shareLink: document.getElementById("share-link"),
  copyLink: document.getElementById("copy-link"),
  selfName: document.getElementById("self-name"),
  selfSecret: document.getElementById("self-secret"),
  opponentName: document.getElementById("opponent-name"),
  opponentStatus: document.getElementById("opponent-status"),
  board: document.getElementById("board"),
  selectMode: document.getElementById("select-mode"),
  resetGame: document.getElementById("reset-game"),
  modePill: document.getElementById("mode-pill"),
  toast: document.getElementById("toast")
};

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.remove("hidden");
  clearTimeout(showToast.timeoutId);
  showToast.timeoutId = setTimeout(() => {
    elements.toast.classList.add("hidden");
  }, 2200);
}

function setConnectionStatus(message, isError = false) {
  elements.connectionStatus.textContent = message;
  elements.connectionStatus.classList.toggle("is-error", isError);
}

function getPlayerName() {
  return elements.playerName.value.trim() || "Player";
}

function persistPlayerName() {
  localStorage.setItem("clash-guess-name", elements.playerName.value.trim());
}

function getShareUrl(roomId) {
  return `${window.location.origin}/room/${roomId}`;
}

function hashString(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 360;
  }
  return hash;
}

function getCardTheme(card) {
  const hue = hashString(card.id);
  const accent = `hsl(${hue} 82% 62%)`;
  const accentSoft = `hsl(${(hue + 24) % 360} 70% 72%)`;
  const shadow = `hsla(${hue} 90% 55% / 0.34)`;
  return { accent, accentSoft, shadow };
}

function joinRoom(roomId) {
  const normalizedId = roomId.trim().toUpperCase();
  if (!normalizedId) {
    showToast("Enter a room code first.");
    return;
  }

  socket.emit("room:join", { roomId: normalizedId, name: getPlayerName() });
}

function renderBoard(room) {
  const flipped = new Set(room.self?.flippedCardIds || []);
  const secretCardId = room.self?.secretCardId;

  elements.board.innerHTML = "";

  for (const card of room.deck) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "card";
    const theme = getCardTheme(card);
    button.style.setProperty("--card-accent", theme.accent);
    button.style.setProperty("--card-accent-soft", theme.accentSoft);
    button.style.setProperty("--card-shadow", theme.shadow);
    if (flipped.has(card.id)) {
      button.classList.add("is-flipped");
    }
    if (secretCardId === card.id) {
      button.classList.add("is-secret");
    }

    button.innerHTML = `
      <span class="card-frame">
        <span class="card-art">
          <img class="card-image" src="${card.image}" alt="${card.name}" loading="lazy" />
          <span class="card-glow"></span>
          <span class="card-orb"></span>
          <span class="card-ribbon">${card.group}</span>
        </span>
        <span class="card-info">
          <span class="card-badge">${card.badge}</span>
          <span class="card-name">${card.name}</span>
          <span class="card-subtitle">Arena contender</span>
        </span>
      </span>
    `;

    button.addEventListener("click", () => {
      if (state.choosingSecret) {
        socket.emit("secret:choose", { roomId: room.roomId, cardId: card.id });
        state.choosingSecret = false;
        updateModeUi();
        return;
      }

      socket.emit("board:toggle", { roomId: room.roomId, cardId: card.id });
    });

    elements.board.appendChild(button);
  }
}

function updateModeUi() {
  elements.modePill.textContent = state.choosingSecret ? "Secret select mode" : "Flip mode";
  elements.selectMode.textContent = state.choosingSecret ? "Cancel secret select" : "Choose secret";
}

function renderRoom(room) {
  state.room = room;
  state.roomId = room.roomId;
  state.choosingSecret = false;

  elements.landing.classList.add("hidden");
  elements.game.classList.remove("hidden");

  const shareUrl = getShareUrl(room.roomId);
  history.replaceState({}, "", `/room/${room.roomId}`);

  elements.roomTitle.textContent = room.roomId;
  elements.shareLink.textContent = shareUrl;
  elements.selfName.textContent = room.self?.name || "Player";
  elements.selfSecret.textContent = room.self?.secretCardId
    ? `Secret character locked: ${room.deck.find((card) => card.id === room.self.secretCardId)?.name || "Chosen"}`
    : "Secret character not locked in yet.";

  const opponent = room.players.find((player) => !player.isYou);
  if (opponent) {
    elements.opponentName.textContent = opponent.name;
    elements.opponentStatus.textContent = !opponent.connected
      ? "Temporarily disconnected. Their spot is held for 30 seconds."
      : opponent.hasChosenSecret
        ? "Secret chosen. Time to ask better questions."
        : "Still choosing a secret character.";
  } else {
    elements.opponentName.textContent = "Waiting for player 2";
    elements.opponentStatus.textContent = "Invite a friend to this room.";
  }

  renderBoard(room);
  updateModeUi();
}

elements.createRoom.addEventListener("click", () => {
  persistPlayerName();
  if (!socket.connected) {
    showToast("Still connecting to the server. Try again in a moment.");
    return;
  }
  socket.emit("room:create", { name: getPlayerName() });
});

elements.joinForm.addEventListener("submit", (event) => {
  event.preventDefault();
  persistPlayerName();
  joinRoom(elements.roomCode.value || state.roomId);
});

elements.copyLink.addEventListener("click", async () => {
  if (!state.roomId) {
    return;
  }

  await navigator.clipboard.writeText(getShareUrl(state.roomId));
  showToast("Room link copied.");
});

elements.selectMode.addEventListener("click", () => {
  state.choosingSecret = !state.choosingSecret;
  updateModeUi();
});

elements.resetGame.addEventListener("click", () => {
  if (!state.roomId) {
    return;
  }
  state.choosingSecret = false;
  updateModeUi();
  socket.emit("game:reset", { roomId: state.roomId });
});

socket.on("room:created", ({ roomId }) => {
  history.replaceState({}, "", `/room/${roomId}`);
});

socket.on("room:update", (room) => {
  renderRoom(room);
});

socket.on("room:error", ({ message }) => {
  showToast(message);
});

socket.on("connect", () => {
  setConnectionStatus("Connected. You can create or join a room.");
  if (state.roomId && !state.room) {
    joinRoom(state.roomId);
  }
});

socket.on("connect_error", () => {
  setConnectionStatus("Could not reach the game server. Refresh in a moment.", true);
});

socket.on("disconnect", () => {
  setConnectionStatus("Connection lost. Reconnecting...", true);
});

if (state.roomId) {
  const inferredName = localStorage.getItem("clash-guess-name") || "";
  elements.playerName.value = inferredName;
  elements.roomCode.value = state.roomId;
}

elements.playerName.addEventListener("change", () => {
  persistPlayerName();
});
