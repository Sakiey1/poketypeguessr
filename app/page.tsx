"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { AuthControls } from "@/components/AuthControls";
import { PixelButton } from "@/components/PixelButton";
import { useSocket } from "@/lib/use-socket";

export default function HomePage() {
  const router = useRouter();
  const socket = useSocket();
  const [playerName, setPlayerName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sanitizedName = playerName.trim().slice(0, 16);
  const canSubmit = sanitizedName.length > 0 && Boolean(socket);

  const createRoom = () => {
    if (!socket || !canSubmit) {
      setError("Enter a player name first.");
      return;
    }
    setBusy(true);
    setError(null);
    socket.emit("create_room", { playerName: sanitizedName }, ({ roomCode }: { roomCode: string }) => {
      localStorage.setItem("poketypeguessr:name", sanitizedName);
      localStorage.setItem("poketypeguessr:roomCode", roomCode);
      setBusy(false);
      router.push(`/lobby/${roomCode}`);
    });
  };

  const joinRoom = () => {
    if (!socket || !canSubmit) {
      setError("Enter a player name first.");
      return;
    }
    const roomCode = joinCode.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
    if (roomCode.length !== 4) {
      setError("Room code must be 4 letters.");
      return;
    }

    setBusy(true);
    setError(null);
    socket.emit(
      "join_room",
      { roomCode, playerName: sanitizedName },
      ({ ok, error: joinError }: { ok: boolean; error?: string }) => {
        setBusy(false);
        if (!ok) {
          setError(joinError ?? "Unable to join room.");
          return;
        }
        localStorage.setItem("poketypeguessr:name", sanitizedName);
        localStorage.setItem("poketypeguessr:roomCode", roomCode);
        router.push(`/lobby/${roomCode}`);
      },
    );
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#f7f4e7] p-6 md:p-10">
      <div className="absolute right-4 top-4 md:right-6 md:top-6">
        <AuthControls />
      </div>

      <div className="w-full max-w-3xl border-4 border-black bg-white p-6 md:p-10 space-y-7">
        <div className="space-y-2">
          <h1 className="font-press text-3xl md:text-4xl text-center">PoketypeGuessr</h1>
          <p className="font-pixel text-2xl md:text-3xl text-center">
            Race your rival to match the dual type!
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="h-[3px] flex-1 bg-black/30" />
          <span className="font-press text-[10px] uppercase tracking-wide text-black/60">
            multiplayer
          </span>
          <span className="h-[3px] flex-1 bg-black/30" />
        </div>

        <label className="block">
          <span className="font-press text-sm md:text-base uppercase">Player Name</span>
          <input
            value={playerName}
            onChange={(event) => setPlayerName(event.target.value)}
            className="mt-2 w-full border-4 border-black px-4 py-3 font-pixel text-3xl bg-[#f7f4e7]"
            maxLength={16}
          />
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PixelButton disabled={!canSubmit || busy} onClick={createRoom} className="w-full text-2xl md:text-3xl py-3">
            Create Room
          </PixelButton>
          <div className="space-y-3">
            <input
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
              placeholder="ABCD"
              className="w-full border-4 border-black px-4 py-3 font-press text-center text-2xl tracking-[0.3em] bg-[#f7f4e7]"
              maxLength={4}
            />
            <PixelButton
              disabled={!canSubmit || busy}
              onClick={joinRoom}
              className="w-full text-lg md:text-xl py-3"
              variant="secondary"
            >
              Join Room
            </PixelButton>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="h-[3px] flex-1 bg-black/30" />
          <span className="font-press text-[10px] uppercase tracking-wide text-black/60">
            single player
          </span>
          <span className="h-[3px] flex-1 bg-black/30" />
        </div>

        <button
          type="button"
          onClick={() => router.push("/speed")}
          className="w-full border-4 border-black bg-[#9bbc0f] px-5 py-4 md:py-5 flex items-center justify-between gap-4 transition-all hover:bg-black hover:text-[#9bbc0f] active:translate-x-[1px] active:translate-y-[1px]"
          style={{ boxShadow: "6px 6px 0 0 #1a1a1a" }}
        >
          <span className="flex-1 text-left">
            <span className="block font-press text-lg md:text-xl uppercase tracking-wide">
              Single Player
            </span>
          </span>
        </button>

        {error && <p className="font-pixel text-2xl text-[#c03028]">{error}</p>}
      </div>
    </main>
  );
}
