/* eslint-disable @typescript-eslint/no-require-imports */
const { createServer } = require("http");
const next = require("next");
const { Server } = require("socket.io");
const pokemonData = require("./data/pokemon.json");

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const DEFAULT_SETTINGS = {
  targetScore: 10,
  generations: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  includeAltForms: true,
};

/** @type {Map<string, any>} */
const rooms = new Map();
const pokemonById = new Map(pokemonData.map((pokemon) => [pokemon.id, pokemon]));

const normalizeCombo = (combo) => [...combo].sort().join("|");

const getDualTypePool = (room) =>
  pokemonData.filter(
    (pokemon) =>
      pokemon.types.length === 2 &&
      room.settings.generations.includes(pokemon.generation) &&
      (room.settings.includeAltForms || !pokemon.isAltForm),
  );

const buildComboPool = (room) => {
  const combos = new Set();
  for (const pokemon of getDualTypePool(room)) {
    combos.add(normalizeCombo([pokemon.types[0], pokemon.types[1]]));
  }
  return [...combos].map((combo) => combo.split("|"));
};

const randomCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
};

const getUniqueRoomCode = () => {
  let code = randomCode();
  while (rooms.has(code)) {
    code = randomCode();
  }
  return code;
};

const playerPayload = (player) => ({
  id: player.id,
  name: player.name,
  score: player.score,
  connected: player.connected,
});

const emitRoomState = (io, room) => {
  for (const player of room.players) {
    io.to(player.id).emit("room_state", {
      roomCode: room.code,
      players: room.players.map(playerPayload),
      settings: room.settings,
      isHost: room.hostId === player.id,
      hostId: room.hostId,
      gameStarted: room.game.started,
    });
  }
};

const resetRoundState = (room) => {
  room.game.skipVotes = new Set();
};

const resetPlayAgainState = (room) => {
  room.game.playAgainVotes = new Set();
};

const pickCombo = (room) => {
  if (room.game.comboPool.length === 0) {
    room.game.comboPool = buildComboPool(room);
    room.game.usedCombos.clear();
  }

  const available = room.game.comboPool.filter(
    (combo) => !room.game.usedCombos.has(normalizeCombo(combo)),
  );
  const source = available.length > 0 ? available : room.game.comboPool;
  const combo = source[Math.floor(Math.random() * source.length)];
  room.game.usedCombos.add(normalizeCombo(combo));
  room.game.currentCombo = combo;
  room.game.comboNumber += 1;
  room.game.roundOpen = true;
  resetRoundState(room);
  return combo;
};

const emitNewCombo = (io, room, isFirst = false) => {
  const combo = pickCombo(room);
  io.to(room.code).emit(isFirst ? "game_started" : "new_combo", {
    combo,
    comboNumber: room.game.comboNumber,
    firstCombo: combo,
  });
};

const emitCurrentCombo = (socket, room) => {
  if (room.game.started && room.game.currentCombo) {
    socket.emit("new_combo", { combo: room.game.currentCombo, comboNumber: room.game.comboNumber });
  }
};

const getRoundExample = (room) =>
  getDualTypePool(room).find(
    (pokemon) =>
      normalizeCombo([pokemon.types[0], pokemon.types[1]]) === normalizeCombo(room.game.currentCombo),
  );

const processRoundResult = (io, room, winnerId, pokemon) => {
  room.game.roundOpen = false;
  resetRoundState(room);
  const scores = room.players.map((player) => ({ id: player.id, score: player.score }));
  io.to(room.code).emit("round_result", {
    winnerId,
    pokemonId: pokemon?.id ?? null,
    pokemonName: pokemon?.name ?? null,
    scores,
  });

  const winningPlayer = room.players.find((player) => player.id === winnerId);
  if (winningPlayer && winningPlayer.score >= room.settings.targetScore) {
    setTimeout(() => {
      io.to(room.code).emit("game_over", {
        winnerId,
        finalScores: room.players.map((player) => ({
          id: player.id,
          name: player.name,
          score: player.score,
        })),
      });
      room.game.started = false;
    }, 2000);
    return;
  }

  setTimeout(() => {
    if (!rooms.has(room.code)) {
      return;
    }
    emitNewCombo(io, room, false);
  }, 2000);
};

const validateSubmission = (room, pokemon) => {
  if (!pokemon || pokemon.types.length !== 2) {
    return false;
  }
  if (!room.settings.generations.includes(pokemon.generation)) {
    return false;
  }
  if (!room.settings.includeAltForms && pokemon.isAltForm) {
    return false;
  }
  return (
    normalizeCombo([pokemon.types[0], pokemon.types[1]]) === normalizeCombo(room.game.currentCombo)
  );
};

const removePlayerFromRoom = (io, room, socketId) => {
  const index = room.players.findIndex((player) => player.id === socketId);
  if (index === -1) {
    return;
  }

  room.players.splice(index, 1);
  if (room.players.length === 0) {
    rooms.delete(room.code);
    return;
  }

  if (room.hostId === socketId) {
    room.hostId = room.players[0].id;
  }

  emitRoomState(io, room);
};

app.prepare().then(() => {
  const httpServer = createServer(handle);
  const io = new Server(httpServer);

  io.on("connection", (socket) => {
    socket.on("create_room", ({ playerName }, callback) => {
      const roomCode = getUniqueRoomCode();
      const room = {
        code: roomCode,
        hostId: socket.id,
        settings: { ...DEFAULT_SETTINGS },
        players: [{ id: socket.id, name: playerName, score: 0, connected: true }],
        game: {
          started: false,
          currentCombo: null,
          comboPool: [],
          usedCombos: new Set(),
          comboNumber: 0,
          roundOpen: false,
          skipVotes: new Set(),
          playAgainVotes: new Set(),
        },
      };
      rooms.set(roomCode, room);
      socket.join(roomCode);
      emitRoomState(io, room);
      callback({ roomCode });
    });

    socket.on("join_room", ({ roomCode, playerName }, callback) => {
      const room = rooms.get((roomCode || "").toUpperCase());
      if (!room) {
        callback({ ok: false, error: "Invalid room code" });
        return;
      }

      const existingBySocket = room.players.find((player) => player.id === socket.id);
      if (existingBySocket) {
        socket.join(room.code);
        emitRoomState(io, room);
        emitCurrentCombo(socket, room);
        callback({ ok: true });
        return;
      }

      const reconnecting = room.players.find(
        (player) => !player.connected && player.name.toLowerCase() === playerName.toLowerCase(),
      );
      if (reconnecting) {
        reconnecting.id = socket.id;
        reconnecting.connected = true;
        socket.join(room.code);
        if (room.hostId === reconnecting.oldSocketId) {
          room.hostId = socket.id;
        }
        emitRoomState(io, room);
        emitCurrentCombo(socket, room);
        callback({ ok: true });
        return;
      }

      const existingByName = room.players.find(
        (player) => player.connected && player.name.toLowerCase() === playerName.toLowerCase(),
      );
      if (existingByName) {
        callback({ ok: false, error: "That player name is already in this room." });
        return;
      }

      if (room.players.length >= 2) {
        callback({ ok: false, error: "Room is full" });
        return;
      }

      room.players.push({ id: socket.id, name: playerName, score: 0, connected: true });
      socket.join(room.code);
      emitRoomState(io, room);
      emitCurrentCombo(socket, room);
      callback({ ok: true });
    });

    socket.on("sync_state", ({ roomCode }) => {
      const room = rooms.get((roomCode || "").toUpperCase());
      if (!room) {
        return;
      }
      if (!room.players.some((player) => player.id === socket.id)) {
        return;
      }
      emitRoomState(io, room);
      emitCurrentCombo(socket, room);
    });

    socket.on("update_settings", ({ roomCode, targetScore, generations, includeAltForms }) => {
      const room = rooms.get((roomCode || "").toUpperCase());
      if (!room || room.hostId !== socket.id) {
        return;
      }
      const parsedTargetScore = Number(targetScore);
      if (!Number.isInteger(parsedTargetScore) || parsedTargetScore < 1 || parsedTargetScore > 20) {
        socket.emit("error", { message: "Target score must be an integer from 1 to 20." });
        return;
      }
      if (!Array.isArray(generations) || generations.length === 0) {
        socket.emit("error", { message: "Pick at least one generation." });
        return;
      }

      room.settings = {
        targetScore: parsedTargetScore,
        generations: generations.sort((a, b) => a - b),
        includeAltForms: Boolean(includeAltForms),
      };
      emitRoomState(io, room);
    });

    socket.on("start_game", ({ roomCode }) => {
      const room = rooms.get((roomCode || "").toUpperCase());
      if (!room) {
        return;
      }
      if (socket.id !== room.hostId) {
        return;
      }
      if (room.players.length < 2) {
        socket.emit("error", { message: "Need two players to start." });
        return;
      }
      if (room.settings.generations.length === 0) {
        socket.emit("error", { message: "Select at least one generation." });
        return;
      }

      room.players.forEach((player) => {
        player.score = 0;
      });
      room.game.comboPool = buildComboPool(room);
      if (room.game.comboPool.length === 0) {
        socket.emit("error", { message: "No dual-type combos available for these settings." });
        return;
      }

      room.game.usedCombos = new Set();
      room.game.comboNumber = 0;
      room.game.started = true;
      resetRoundState(room);
      resetPlayAgainState(room);
      emitRoomState(io, room);
      emitNewCombo(io, room, true);
    });

    socket.on("submit_answer", ({ roomCode, pokemonId }) => {
      const room = rooms.get((roomCode || "").toUpperCase());
      if (!room || !room.game.started || !room.game.roundOpen) {
        return;
      }
      const player = room.players.find((item) => item.id === socket.id);
      if (!player) {
        return;
      }

      const pokemon = pokemonById.get(Number(pokemonId));
      const valid = validateSubmission(room, pokemon);
      if (!valid) {
        socket.emit("error", { message: "That Pokemon does not match this combo." });
        return;
      }

      if (!room.game.roundOpen) {
        socket.emit("error", { message: "Too late!" });
        return;
      }

      player.score += 1;
      processRoundResult(io, room, socket.id, pokemon);
    });

    socket.on("skip_round", ({ roomCode }) => {
      const room = rooms.get((roomCode || "").toUpperCase());
      if (!room || !room.game.roundOpen) {
        return;
      }
      const player = room.players.find((item) => item.id === socket.id);
      if (!player || !player.connected) {
        return;
      }

      room.game.skipVotes.add(socket.id);
      const connectedPlayers = room.players.filter((item) => item.connected);
      const neededVotes = connectedPlayers.length;
      io.to(room.code).emit("skip_vote_update", {
        votes: room.game.skipVotes.size,
        needed: neededVotes,
      });

      if (room.game.skipVotes.size < neededVotes) {
        return;
      }

      const example = getRoundExample(room);
      processRoundResult(io, room, null, example);
    });

    socket.on("play_again", ({ roomCode }) => {
      const room = rooms.get((roomCode || "").toUpperCase());
      if (!room || room.game.started) {
        return;
      }
      const player = room.players.find((item) => item.id === socket.id);
      if (!player || !player.connected) {
        return;
      }

      room.game.playAgainVotes.add(socket.id);
      const connectedPlayers = room.players.filter((item) => item.connected);
      const neededVotes = connectedPlayers.length;
      io.to(room.code).emit("play_again_vote_update", {
        votes: room.game.playAgainVotes.size,
        needed: neededVotes,
      });

      if (room.game.playAgainVotes.size < neededVotes) {
        return;
      }

      room.players.forEach((item) => {
        item.score = 0;
      });
      room.game.comboPool = buildComboPool(room);
      room.game.usedCombos = new Set();
      room.game.comboNumber = 0;
      room.game.started = true;
      resetRoundState(room);
      resetPlayAgainState(room);
      emitRoomState(io, room);
      emitNewCombo(io, room, true);
    });

    socket.on("leave_room", ({ roomCode }) => {
      const room = rooms.get((roomCode || "").toUpperCase());
      if (!room) {
        return;
      }
      socket.leave(room.code);
      removePlayerFromRoom(io, room, socket.id);
    });

    socket.on("disconnect", () => {
      for (const room of rooms.values()) {
        const player = room.players.find((item) => item.id === socket.id);
        if (!player) {
          continue;
        }

        player.connected = false;
        player.oldSocketId = socket.id;
        io.to(room.code).emit("opponent_disconnected");
        emitRoomState(io, room);

        setTimeout(() => {
          const liveRoom = rooms.get(room.code);
          if (!liveRoom) {
            return;
          }
          const disconnectedPlayer = liveRoom.players.find((item) => item.oldSocketId === socket.id);
          if (!disconnectedPlayer || disconnectedPlayer.connected) {
            return;
          }

          removePlayerFromRoom(io, liveRoom, disconnectedPlayer.id);
          if (liveRoom.game.started && liveRoom.players.length === 1) {
            io.to(liveRoom.code).emit("game_over", {
              winnerId: liveRoom.players[0].id,
              finalScores: liveRoom.players.map((p) => ({
                id: p.id,
                name: p.name,
                score: p.score,
              })),
            });
            liveRoom.game.started = false;
          }
        }, 60_000);
      }
    });
  });

  httpServer
    .once("error", (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});
