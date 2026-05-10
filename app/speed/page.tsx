"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AuthControls } from "@/components/AuthControls";
import { Leaderboard } from "@/components/Leaderboard";
import { PixelButton } from "@/components/PixelButton";
import { fetchTopScores, type LeaderboardRow } from "@/lib/leaderboard";
import { loadLocalBests, type LocalBests } from "@/lib/local-best";
import {
  ENDLESS_MAX_STRIKES,
  LEADERBOARD_MINI_SIZE,
  RACE_MAX_SKIPS,
  RACE_TARGET,
  TIMED_DURATION_MS,
  TIMED_SKIP_PENALTY_MS,
} from "@/lib/speed-mode/constants";
import type { SpeedMode } from "@/lib/speed-mode/types";
import { formatStopwatch } from "@/lib/speed-mode/timer";

type ModeMeta = {
  id: SpeedMode;
  name: string;
  rules: string;
  bestLabel: (bests: LocalBests) => string;
};

const MODE_META: ModeMeta[] = [
  {
    id: "timed",
    name: "Timed",
    rules: `${TIMED_DURATION_MS / 1000}s. Skip: −${TIMED_SKIP_PENALTY_MS / 1000}s.`,
    bestLabel: (bests) =>
      bests.timed ? `${bests.timed.correctCount} correct` : "—",
  },
  {
    id: "race",
    name: "Race to N",
    rules: `${RACE_TARGET} correct. ${RACE_MAX_SKIPS} skips max.`,
    bestLabel: (bests) =>
      bests.race ? formatStopwatch(bests.race.elapsedMs) : "—",
  },
  {
    id: "endless",
    name: "Endless",
    rules: `${ENDLESS_MAX_STRIKES} strikes. Skip = strike.`,
    bestLabel: (bests) =>
      bests.endless
        ? `${bests.endless.correctCount} (streak ${bests.endless.longestStreak})`
        : "—",
  },
];

export default function SpeedSelectPage() {
  const router = useRouter();
  // useState initializer reads localStorage exactly once on mount; no
  // follow-up effect needed. (Calling loadLocalBests on the server is safe
  // because it short-circuits when window is undefined.)
  const [bests] = useState<LocalBests>(() => loadLocalBests());
  const [topByMode, setTopByMode] = useState<Record<SpeedMode, LeaderboardRow[]>>({
    timed: [],
    race: [],
    endless: [],
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [timed, race, endless] = await Promise.all([
        fetchTopScores("timed", LEADERBOARD_MINI_SIZE),
        fetchTopScores("race", LEADERBOARD_MINI_SIZE),
        fetchTopScores("endless", LEADERBOARD_MINI_SIZE),
      ]);
      if (cancelled) return;
      setTopByMode({ timed, race, endless });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const cards = useMemo(() => MODE_META, []);

  return (
    <main className="min-h-screen bg-[#f7f4e7] p-6 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-press text-2xl md:text-3xl">Speed Mode</h1>
          </div>
          <div className="flex items-center gap-3">
            <AuthControls />
            <Link
              href="/"
              className="border-2 border-black bg-white px-3 py-2 font-press text-[10px] uppercase hover:bg-black hover:text-white"
            >
              Back
            </Link>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {cards.map((card) => (
            <article
              key={card.id}
              className="border-4 border-black bg-white p-4 flex flex-col gap-3"
              style={{ boxShadow: "5px 5px 0 0 #1a1a1a" }}
            >
              <h2 className="font-press text-base md:text-lg">{card.name}</h2>
              <p className="font-pixel text-xl text-black/75">{card.rules}</p>
              <div className="border-2 border-black bg-[#f7f4e7] px-3 py-2">
                <div className="font-press text-[9px] uppercase text-black/60">
                  Your best
                </div>
                <div className="font-pixel text-2xl">{card.bestLabel(bests)}</div>
              </div>
              <Leaderboard
                mode={card.id}
                rows={topByMode[card.id]}
                compact
                emptyMessage="Be the first."
              />
              <PixelButton
                onClick={() => router.push(`/speed/${card.id}`)}
                className="w-full text-lg py-3"
              >
                Play {card.name}
              </PixelButton>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
