const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const MAX_PLAYERS = 2;
const CARD_LIBRARY = [
  { id: "bandit", name: "Bandit", badge: "BD", group: "Dash", image: "/cards/bandit.jpg" },
  { id: "bowler", name: "Bowler", badge: "BW", group: "Heavy", image: "/cards/BowlerCard.jpg" },
  { id: "dark-prince", name: "Dark Prince", badge: "DP", group: "Charge", image: "/cards/darkprince.jpg" },
  { id: "electro-wizard", name: "Electro Wizard", badge: "EW", group: "Ranged", image: "/cards/electro-wizard.jpg" },
  { id: "electro-dragon", name: "Electro Dragon", badge: "ED", group: "Dragon", image: "/cards/ElectroDragonCard.jpg" },
  { id: "firecracker", name: "Firecracker", badge: "FC", group: "Ranged", image: "/cards/FirecrackerCard.jpg" },
  { id: "giant-skeleton", name: "Giant Skeleton", badge: "GS", group: "Heavy", image: "/cards/GiantSkeletonCard.jpg" },
  { id: "goblin-gang", name: "Goblin Gang", badge: "GG", group: "Swarm", image: "/cards/GoblinGangCard.jpg" },
  { id: "ice-wizard", name: "Ice Wizard", badge: "IW", group: "Ranged", image: "/cards/IceWizardCard.jpg" },
  { id: "knight", name: "Knight", badge: "KN", group: "Melee", image: "/cards/KnightCard.jpg" },
  { id: "little-prince", name: "Little Prince", badge: "LP", group: "Champions", image: "/cards/LittlePrinceCard.jpg" },
  { id: "lumberjack", name: "Lumberjack", badge: "LJ", group: "Melee", image: "/cards/lumberjack.jpg" },
  { id: "magic-archer", name: "Magic Archer", badge: "MA", group: "Ranged", image: "/cards/MagicArcherCard.jpg" },
  { id: "mighty-miner", name: "Mighty Miner", badge: "MM", group: "Champions", image: "/cards/mighty-miner.jpg" },
  { id: "miner", name: "Miner", badge: "MN", group: "Sneaky", image: "/cards/miner-full-image-v0-ew54ev8qti601.jpg" },
  { id: "mini-pekka", name: "Mini P.E.K.K.A", badge: "MP", group: "Heavy", image: "/cards/mini-pekka.jpg" },
  { id: "mother-witch", name: "Mother Witch", badge: "MW", group: "Ranged", image: "/cards/mother-witch.jpg" },
  { id: "pekka", name: "P.E.K.K.A", badge: "PK", group: "Heavy", image: "/cards/PEKKACard.jpg" },
  { id: "princess", name: "Princess", badge: "PR", group: "Ranged", image: "/cards/princess.jpg" },
  { id: "ram-rider", name: "Ram Rider", badge: "RR", group: "Charge", image: "/cards/ram-rider.jpg" },
  { id: "royal-ghost", name: "Royal Ghost", badge: "RG", group: "Dash", image: "/cards/RoyalGhostCard.jpg" },
  { id: "skeleton-king", name: "Skeleton King", badge: "SK", group: "Champions", image: "/cards/SkeletonKingCard.jpg" },
  { id: "valkyrie", name: "Valkyrie", badge: "VK", group: "Melee", image: "/cards/valkyrie.jpg" },
  { id: "wizard", name: "Wizard", badge: "WZ", group: "Ranged", image: "/cards/WizardCard.jpg" }
];

const BOARD_SIZE = CARD_LIBRARY.length;

const rooms = new Map();

function randomId(length = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let value = "";
  while (value.length < length) {
    value += chars[Math.floor(Math.random() * chars.length)];
  }
  return value;
}

function shuffle(items) {
  const clone = [...items];
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
}

function createDeck() {
  return shuffle(CARD_LIBRARY).slice(0, BOARD_SIZE);
}

function ensureRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      id: roomId,
      createdAt: Date.now(),
      deck: createDeck(),
      players: new Map()
    });
  }
  return rooms.get(roomId);
}

function getPublicRoomState(room, socketId) {
  const players = [...room.players.values()].map((player) => ({
    id: player.id,
    name: player.name,
    connected: player.connected,
    hasChosenSecret: Boolean(player.secretCardId),
    isYou: player.id === socketId
  }));

  const self = room.players.get(socketId);

  return {
    roomId: room.id,
    shareUrl: `/room/${room.id}`,
    status: room.players.size < MAX_PLAYERS ? "waiting" : "ready",
    deck: room.deck,
    players,
    self: self
      ? {
          id: self.id,
          name: self.name,
          secretCardId: self.secretCardId,
          flippedCardIds: [...self.flippedCardIds]
        }
      : null
  };
}

function emitRoom(room) {
  for (const socketId of room.players.keys()) {
    io.to(socketId).emit("room:update", getPublicRoomState(room, socketId));
  }
}

function cleanupRoom(roomId) {
  const room = rooms.get(roomId);
  if (!room) {
    return;
  }

  const anyConnected = [...room.players.values()].some((player) => player.connected);
  if (!anyConnected) {
    rooms.delete(roomId);
  }
}

app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/room/:roomId", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

io.on("connection", (socket) => {
  socket.on("room:create", ({ name }) => {
    let roomId = randomId();
    while (rooms.has(roomId)) {
      roomId = randomId();
    }

    const room = ensureRoom(roomId);
    room.players.set(socket.id, {
      id: socket.id,
      name: String(name || "Player 1").slice(0, 24),
      connected: true,
      secretCardId: null,
      flippedCardIds: new Set()
    });

    socket.join(room.id);
    emitRoom(room);
    socket.emit("room:created", { roomId: room.id });
  });

  socket.on("room:join", ({ roomId, name }) => {
    const normalizedId = String(roomId || "").trim().toUpperCase();
    const room = rooms.get(normalizedId);

    if (!room) {
      socket.emit("room:error", { message: "That room does not exist yet." });
      return;
    }

    if (room.players.size >= MAX_PLAYERS) {
      socket.emit("room:error", { message: "That room is already full." });
      return;
    }

    room.players.set(socket.id, {
      id: socket.id,
      name: String(name || `Player ${room.players.size + 1}`).slice(0, 24),
      connected: true,
      secretCardId: null,
      flippedCardIds: new Set()
    });

    socket.join(room.id);
    emitRoom(room);
  });

  socket.on("board:toggle", ({ roomId, cardId }) => {
    const room = rooms.get(String(roomId || "").trim().toUpperCase());
    const player = room?.players.get(socket.id);

    if (!room || !player) {
      return;
    }

    if (player.flippedCardIds.has(cardId)) {
      player.flippedCardIds.delete(cardId);
    } else {
      player.flippedCardIds.add(cardId);
    }

    emitRoom(room);
  });

  socket.on("secret:choose", ({ roomId, cardId }) => {
    const room = rooms.get(String(roomId || "").trim().toUpperCase());
    const player = room?.players.get(socket.id);

    if (!room || !player) {
      return;
    }

    const existsInDeck = room.deck.some((card) => card.id === cardId);
    if (!existsInDeck) {
      return;
    }

    player.secretCardId = cardId;
    emitRoom(room);
  });

  socket.on("game:reset", ({ roomId }) => {
    const room = rooms.get(String(roomId || "").trim().toUpperCase());
    if (!room || !room.players.has(socket.id)) {
      return;
    }

    room.deck = createDeck();
    for (const player of room.players.values()) {
      player.secretCardId = null;
      player.flippedCardIds = new Set();
    }
    emitRoom(room);
  });

  socket.on("disconnect", () => {
    for (const room of rooms.values()) {
      const player = room.players.get(socket.id);
      if (!player) {
        continue;
      }

      player.connected = false;
      emitRoom(room);

      setTimeout(() => {
        const currentRoom = rooms.get(room.id);
        const currentPlayer = currentRoom?.players.get(socket.id);
        if (!currentRoom || !currentPlayer) {
          return;
        }

        if (!currentPlayer.connected) {
          currentRoom.players.delete(socket.id);
          emitRoom(currentRoom);
          cleanupRoom(currentRoom.id);
        }
      }, 30_000);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Guess Who server running on http://localhost:${PORT}`);
});
