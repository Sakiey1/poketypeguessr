"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
    <main className="flex min-h-screen items-center justify-center bg-[#f7f4e7] p-6">
      <div className="w-full max-w-xl border-4 border-black bg-white p-6 space-y-6">
        <h1 className="font-press text-2xl text-center">PoketypeGuessr</h1>
        <p className="font-pixel text-xl text-center">Race your rival to match the dual type!</p>

        <label className="block">
          <span className="font-press text-xs uppercase">Player Name</span>
          <input
            value={playerName}
            onChange={(event) => setPlayerName(event.target.value)}
            className="mt-2 w-full border-4 border-black px-3 py-2 font-pixel text-2xl bg-[#f7f4e7]"
            maxLength={16}
          />
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <PixelButton disabled={!canSubmit || busy} onClick={createRoom} className="w-full">
            Create Room
          </PixelButton>
          <div className="space-y-2">
            <input
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
              placeholder="ABCD"
              className="w-full border-4 border-black px-3 py-2 font-press text-center text-lg tracking-[0.3em] bg-[#f7f4e7]"
              maxLength={4}
            />
            <PixelButton disabled={!canSubmit || busy} onClick={joinRoom} className="w-full" variant="secondary">
              Join Room
            </PixelButton>
          </div>
        </div>

        {error && <p className="font-pixel text-xl text-[#c03028]">{error}</p>}
      </div>
    </main>
  );
}
