"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { PixelButton } from "@/components/PixelButton";
import type { LobbySettings, RoomStatePayload } from "@/lib/types";
import { useSocket } from "@/lib/use-socket";

const SCORE_OPTIONS = [5, 10, 15, 20];

export default function LobbyPage() {
  const params = useParams<{ roomCode: string }>();
  const router = useRouter();
  const socket = useSocket();
  const roomCode = (params.roomCode ?? "").toUpperCase();
  const [state, setState] = useState<RoomStatePayload | null>(null);
  const [selfId, setSelfId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showCustomTarget, setShowCustomTarget] = useState(false);
  const [customTargetInput, setCustomTargetInput] = useState("10");
  const [playerName] = useState(() =>
    typeof window === "undefined" ? "" : (localStorage.getItem("poketypeguessr:name") ?? ""),
  );

  useEffect(() => {
    if (!socket) {
      return;
    }

    const syncState = () => {
      setSelfId(socket.id ?? "");
      if (roomCode) {
        socket.emit("sync_state", { roomCode });
      }
    };
    const onRoomState = (payload: RoomStatePayload) => setState(payload);
    const onGameStarted = () => router.push(`/game/${roomCode}`);
    const onError = ({ message }: { message: string }) => setError(message);

    socket.on("connect", syncState);
    socket.on("room_state", onRoomState);
    socket.on("game_started", onGameStarted);
    socket.on("error", onError);

    if (socket.connected) {
      syncState();
    } else if (roomCode) {
      socket.connect();
    }

    return () => {
      socket.off("connect", syncState);
      socket.off("room_state", onRoomState);
      socket.off("game_started", onGameStarted);
      socket.off("error", onError);
    };
  }, [roomCode, router, socket]);

  useEffect(() => {
    if (!socket || !roomCode || !playerName) {
      return;
    }
    if (selfId && state?.players.some((player) => player.id === selfId)) {
      return;
    }
    socket.emit(
      "join_room",
      { roomCode, playerName },
      ({ ok, error: joinError }: { ok: boolean; error?: string }) => {
        if (!ok) {
          setError(joinError ?? "Could not join room.");
        }
      },
    );
  }, [playerName, roomCode, selfId, socket, state]);

  if (!state) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#f7f4e7] font-pixel text-2xl">
        Connecting...
      </main>
    );
  }

  const selectedGens = new Set(state.settings.generations);
  const canStart = state.isHost && state.players.length >= 2 && state.settings.generations.length > 0;
  const isPresetTarget = SCORE_OPTIONS.includes(state.settings.targetScore);
  const shouldShowCustomTarget = showCustomTarget || !isPresetTarget;

  const updateSettings = (nextSettings: LobbySettings) => {
    if (!socket) {
      return;
    }
    socket.emit("update_settings", { roomCode, ...nextSettings });
  };

  const submitCustomTarget = () => {
    const parsed = Number(customTargetInput);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 20) {
      setError("Custom target score must be an integer from 1 to 20.");
      return;
    }
    setError(null);
    updateSettings({
      ...state.settings,
      targetScore: parsed,
    });
  };

  return (
    <main className="min-h-screen bg-[#f7f4e7] p-6">
      <div className="mx-auto max-w-4xl border-4 border-black bg-white p-6 space-y-6">
        <h1 className="font-press text-2xl text-center">Lobby</h1>
        <div className="font-press text-sm text-center">
          Room Code: <span className="tracking-[0.3em]">{roomCode}</span>
        </div>

        <div className="grid gap-2">
          {state.players.map((player) => (
            <div key={player.id} className="border-2 border-black p-3 font-pixel text-xl">
              {player.name} {player.id === state.hostId ? "(Host)" : ""}
              {!player.connected ? " - reconnecting..." : ""}
            </div>
          ))}
        </div>

        <section className="border-4 border-black p-4 bg-[#f7f4e7] space-y-4">
          <h2 className="font-press text-xs">Game Settings</h2>
          <label className="flex items-center gap-3 font-pixel text-xl">
            Target Score
            <select
              className="border-2 border-black bg-white px-2 py-1"
              value={shouldShowCustomTarget ? "custom" : String(state.settings.targetScore)}
              disabled={!state.isHost}
              onChange={(event) => {
                const value = event.target.value;
                if (value === "custom") {
                  setShowCustomTarget(true);
                  setCustomTargetInput(String(state.settings.targetScore));
                  return;
                }
                setShowCustomTarget(false);
                updateSettings({
                  ...state.settings,
                  targetScore: Number(value),
                });
              }}
            >
              {SCORE_OPTIONS.map((score) => (
                <option key={score} value={String(score)}>
                  {score}
                </option>
              ))}
              <option value="custom">Custom</option>
            </select>
          </label>
          {shouldShowCustomTarget && (
            <div className="flex items-center gap-2 font-pixel text-xl">
              <label htmlFor="custom-target-score">Custom (1-20)</label>
              <input
                id="custom-target-score"
                type="number"
                min={1}
                max={20}
                step={1}
                value={state.isHost ? customTargetInput : String(state.settings.targetScore)}
                disabled={!state.isHost}
                onChange={(event) => setCustomTargetInput(event.target.value)}
                onBlur={() => {
                  if (state.isHost) {
                    submitCustomTarget();
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && state.isHost) {
                    submitCustomTarget();
                  }
                }}
                className="w-24 border-2 border-black bg-white px-2 py-1"
              />
            </div>
          )}

          <div>
            <p className="font-pixel text-xl mb-2">Generations</p>
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 9 }, (_, index) => index + 1).map((generation) => (
                <label key={generation} className="flex items-center gap-2 font-pixel text-lg">
                  <input
                    type="checkbox"
                    checked={selectedGens.has(generation)}
                    disabled={!state.isHost}
                    onChange={(event) => {
                      const next = new Set(selectedGens);
                      if (event.target.checked) {
                        next.add(generation);
                      } else {
                        next.delete(generation);
                      }
                      updateSettings({
                        ...state.settings,
                        generations: [...next],
                      });
                    }}
                  />
                  Gen {generation}
                </label>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 font-pixel text-xl">
            <input
              type="checkbox"
              checked={state.settings.includeAltForms}
              disabled={!state.isHost}
              onChange={(event) =>
                updateSettings({
                  ...state.settings,
                  includeAltForms: event.target.checked,
                })
              }
            />
            Include alternate forms
          </label>
        </section>

        {error && <p className="font-pixel text-xl text-[#c03028]">{error}</p>}

        <div className="flex flex-wrap gap-3">
          <PixelButton disabled={!socket || !canStart} onClick={() => socket?.emit("start_game", { roomCode })}>
            Start Game
          </PixelButton>
          <PixelButton
            variant="danger"
            onClick={() => {
              socket?.emit("leave_room", { roomCode });
              router.push("/");
            }}
          >
            Leave Room
          </PixelButton>
        </div>
      </div>
    </main>
  );
}
