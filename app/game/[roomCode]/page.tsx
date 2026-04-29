"use client";

import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { PixelButton } from "@/components/PixelButton";
import { PokemonSearchDropdown } from "@/components/PokemonSearchDropdown";
import { ScoreBar } from "@/components/ScoreBar";
import { SpeechBox } from "@/components/SpeechBox";
import { TypeBadge } from "@/components/TypeBadge";
import pokemonData from "@/data/pokemon.json";
import type { PokemonEntry, RoomStatePayload, TypeCombo } from "@/lib/types";
import { useSocket } from "@/lib/use-socket";

type RoundResultPayload = {
  winnerId: string | null;
  pokemonId: number | null;
  pokemonName: string | null;
  scores: { id: string; score: number }[];
};

export default function GamePage() {
  const params = useParams<{ roomCode: string }>();
  const router = useRouter();
  const socket = useSocket();
  const roomCode = (params.roomCode ?? "").toUpperCase();
  const [roomState, setRoomState] = useState<RoomStatePayload | null>(null);
  const [selfId, setSelfId] = useState("");
  const [currentCombo, setCurrentCombo] = useState<TypeCombo | null>(null);
  const [roundResult, setRoundResult] = useState<RoundResultPayload | null>(null);
  const [gameOver, setGameOver] = useState<{
    winnerId: string;
    finalScores: { id: string; name: string; score: number }[];
  } | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [scoresByPlayerId, setScoresByPlayerId] = useState<Record<string, number>>({});
  const [playAgainVotes, setPlayAgainVotes] = useState(0);
  const [playAgainNeeded, setPlayAgainNeeded] = useState(2);
  const [hasVotedPlayAgain, setHasVotedPlayAgain] = useState(false);
  const playerName = useMemo(
    () => (typeof window === "undefined" ? "" : (window.localStorage.getItem("poketypeguessr:name") ?? "")),
    [],
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
    const onRoomState = (payload: RoomStatePayload) => {
      setRoomState(payload);
      setScoresByPlayerId(
        Object.fromEntries(payload.players.map((player) => [player.id, player.score])),
      );
    };
    const onGameStarted = ({ firstCombo, combo }: { firstCombo?: TypeCombo; combo?: TypeCombo }) => {
      setGameOver(null);
      setRoundResult(null);
      setCurrentCombo(firstCombo ?? combo ?? null);
      setPlayAgainVotes(0);
      setPlayAgainNeeded(2);
      setHasVotedPlayAgain(false);
    };
    const onNewCombo = ({ combo }: { combo: TypeCombo }) => {
      setRoundResult(null);
      setCurrentCombo(combo);
      setStatusMessage(null);
    };
    const onRoundResult = (payload: RoundResultPayload) => {
      setRoundResult(payload);
      setStatusMessage(null);
      setScoresByPlayerId((previous) => ({
        ...previous,
        ...Object.fromEntries(payload.scores.map((score) => [score.id, score.score])),
      }));
    };
    const onGameOver = (payload: { winnerId: string; finalScores: { id: string; name: string; score: number }[] }) => {
      setGameOver(payload);
      setScoresByPlayerId(
        Object.fromEntries(payload.finalScores.map((score) => [score.id, score.score])),
      );
      setPlayAgainVotes(0);
      setPlayAgainNeeded(payload.finalScores.length || 2);
      setHasVotedPlayAgain(false);
    };
    const onOpponentDisconnected = () => setStatusMessage("Waiting for opponent reconnect...");
    const onError = ({ message }: { message: string }) => setStatusMessage(message);
    const onSkipVoteUpdate = ({ votes, needed }: { votes: number; needed: number }) => {
      if (votes < needed) {
        setStatusMessage(`Skip votes: ${votes}/${needed}`);
      } else {
        setStatusMessage(null);
      }
    };
    const onPlayAgainVoteUpdate = ({ votes, needed }: { votes: number; needed: number }) => {
      setPlayAgainVotes(votes);
      setPlayAgainNeeded(needed);
    };

    socket.on("connect", syncState);
    socket.on("room_state", onRoomState);
    socket.on("game_started", onGameStarted);
    socket.on("new_combo", onNewCombo);
    socket.on("round_result", onRoundResult);
    socket.on("game_over", onGameOver);
    socket.on("opponent_disconnected", onOpponentDisconnected);
    socket.on("error", onError);
    socket.on("skip_vote_update", onSkipVoteUpdate);
    socket.on("play_again_vote_update", onPlayAgainVoteUpdate);

    if (socket.connected) {
      syncState();
    } else if (roomCode) {
      socket.connect();
    }

    return () => {
      socket.off("connect", syncState);
      socket.off("room_state", onRoomState);
      socket.off("game_started", onGameStarted);
      socket.off("new_combo", onNewCombo);
      socket.off("round_result", onRoundResult);
      socket.off("game_over", onGameOver);
      socket.off("opponent_disconnected", onOpponentDisconnected);
      socket.off("error", onError);
      socket.off("skip_vote_update", onSkipVoteUpdate);
      socket.off("play_again_vote_update", onPlayAgainVoteUpdate);
    };
  }, [roomCode, socket]);

  useEffect(() => {
    if (!socket || !roomCode || !playerName) {
      return;
    }
    if (selfId && roomState?.players.some((player) => player.id === selfId)) {
      return;
    }
    socket.emit("join_room", { roomCode, playerName }, ({ ok }: { ok: boolean }) => {
      if (!ok) {
        router.push("/");
      }
    });
  }, [playerName, roomCode, roomState, router, selfId, socket]);

  const me =
    roomState?.players.find((player) => player.id === selfId) ??
    roomState?.players.find((player) => player.name === playerName) ??
    null;
  const opponent = roomState?.players.find((player) => player.id !== me?.id) ?? null;
  const data = pokemonData as unknown as PokemonEntry[];

  useEffect(() => {
    if (!roomState) {
      return;
    }
    if (!roomState.gameStarted) {
      router.push(`/lobby/${roomCode}`);
    }
  }, [roomCode, roomState, router]);

  if (!socket || !roomState || !currentCombo || !me || !opponent) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#f7f4e7] font-pixel text-2xl">
        Loading battle...
      </main>
    );
  }

  const winnerName =
    roundResult?.winnerId === null
      ? null
      : roomState.players.find((player) => player.id === roundResult?.winnerId)?.name;

  return (
    <main className="min-h-screen bg-[#f7f4e7] p-4">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <ScoreBar
            label={me.name}
            score={scoresByPlayerId[me.id] ?? me.score}
            targetScore={roomState.settings.targetScore}
            highlighted
          />
          <ScoreBar
            label={opponent.name}
            score={scoresByPlayerId[opponent.id] ?? opponent.score}
            targetScore={roomState.settings.targetScore}
          />
        </div>

        <section className="border-4 border-black bg-white p-6 flex flex-col items-center gap-4">
          <h2 className="font-press text-lg">Find This Dual Type</h2>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <TypeBadge type={currentCombo[0]} large />
            <TypeBadge type={currentCombo[1]} large />
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="space-y-2">
            <h3 className="font-press text-xs uppercase">{me.name} (you)</h3>
            <PokemonSearchDropdown
              allPokemon={data}
              combo={currentCombo}
              onSubmit={(pokemonId) => socket.emit("submit_answer", { roomCode, pokemonId })}
              disabled={Boolean(roundResult) || Boolean(gameOver)}
            />
          </section>
          <section className="space-y-2">
            <h3 className="font-press text-xs uppercase">{opponent.name}</h3>
            <PokemonSearchDropdown
              allPokemon={data}
              combo={currentCombo}
              onSubmit={() => undefined}
              disabled
            />
          </section>
        </div>

        <div className="flex justify-center">
          <PixelButton onClick={() => socket.emit("skip_round", { roomCode })} disabled={Boolean(roundResult)}>
            Skip / Both Stuck
          </PixelButton>
        </div>

        {statusMessage && (
          <SpeechBox className="max-w-2xl mx-auto">
            <p className="font-pixel text-2xl">{statusMessage}</p>
          </SpeechBox>
        )}

        {roundResult && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
            <SpeechBox className="w-full max-w-lg">
              <p className="font-press text-sm mb-2">
                {roundResult.winnerId ? `${winnerName} got it!` : "Round skipped - no points"}
              </p>
              {roundResult.pokemonId && roundResult.pokemonName ? (
                <div className="flex items-center gap-3">
                  <Image
                    src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${roundResult.pokemonId}.png`}
                    alt={roundResult.pokemonName}
                    width={64}
                    height={64}
                    className="pixel-img"
                    unoptimized
                  />
                  <span className="font-pixel text-3xl">{roundResult.pokemonName}</span>
                </div>
              ) : null}
            </SpeechBox>
          </div>
        )}

        {gameOver && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4">
            <SpeechBox className="w-full max-w-lg">
              <h2 className="font-press text-base mb-3">
                {roomState.players.find((player) => player.id === gameOver.winnerId)?.name} wins!
              </h2>
              <div className="space-y-1">
                {gameOver.finalScores.map((score) => (
                  <p key={score.id} className="font-pixel text-2xl">
                    {score.name}: {score.score}
                  </p>
                ))}
              </div>
              <div className="mt-4 flex gap-3">
                <PixelButton
                  onClick={() => {
                    socket.emit("play_again", { roomCode });
                    setHasVotedPlayAgain(true);
                  }}
                  disabled={hasVotedPlayAgain}
                >
                  {hasVotedPlayAgain ? "Waiting..." : "Play Again"}
                </PixelButton>
                <PixelButton
                  variant="danger"
                  onClick={() => {
                    socket.emit("leave_room", { roomCode });
                    router.push("/");
                  }}
                >
                  Leave Room
                </PixelButton>
              </div>
              <p className="mt-3 font-pixel text-xl">
                Rematch votes: {playAgainVotes}/{playAgainNeeded}
              </p>
            </SpeechBox>
          </div>
        )}
      </div>
    </main>
  );
}
