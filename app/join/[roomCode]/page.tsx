"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { PixelButton } from "@/components/PixelButton";
import { useSocket } from "@/lib/use-socket";

export default function JoinByLinkPage() {
  const params = useParams<{ roomCode: string }>();
  const router = useRouter();
  const socket = useSocket();
  const roomCode = (params.roomCode ?? "").toUpperCase();

  const [playerName, setPlayerName] = useState(() =>
    typeof window === "undefined" ? "" : (window.localStorage.getItem("poketypeguessr:name") ?? ""),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sanitizedName = playerName.trim().slice(0, 16);
  const canSubmit = sanitizedName.length > 0 && Boolean(socket) && roomCode.length === 4;

  const joinFromLink = () => {
    if (!socket || !canSubmit) {
      setError("Enter a player name first.");
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
        window.localStorage.setItem("poketypeguessr:name", sanitizedName);
        window.localStorage.setItem("poketypeguessr:roomCode", roomCode);
        router.push(`/lobby/${roomCode}`);
      },
    );
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f4e7] p-6">
      <div className="w-full max-w-xl border-4 border-black bg-white p-6 space-y-6">
        <h1 className="font-press text-2xl text-center">Join Room</h1>
        <p className="font-pixel text-xl text-center">
          Room: <span className="font-press text-sm tracking-[0.3em]">{roomCode}</span>
        </p>

        <label className="block">
          <span className="font-press text-xs uppercase">Player Name</span>
          <input
            value={playerName}
            onChange={(event) => setPlayerName(event.target.value)}
            className="mt-2 w-full border-4 border-black px-3 py-2 font-pixel text-2xl bg-[#f7f4e7]"
            maxLength={16}
          />
        </label>

        <div className="flex gap-3">
          <PixelButton disabled={!canSubmit || busy} onClick={joinFromLink} className="flex-1">
            Join Lobby
          </PixelButton>
          <PixelButton variant="secondary" onClick={() => router.push("/")} className="flex-1">
            Back
          </PixelButton>
        </div>

        {error && <p className="font-pixel text-xl text-[#c03028]">{error}</p>}
      </div>
    </main>
  );
}
