"use client";

import type { SpeedMode } from "@/lib/speed-mode/types";

// Personal-best cache so the mode-select cards render instantly without a
// network round-trip. Reconciled with Supabase on auth and after each
// successful score submission. If you change scoring/constants, bump the
// version suffix below so stale entries are dropped on next load.

const STORAGE_KEY = "pokeguess.speedmode.best.v1";

export type LocalBests = {
  timed: { correctCount: number; achievedAt: string } | null;
  race: { elapsedMs: number; skipsUsed: number; achievedAt: string } | null;
  endless: {
    correctCount: number;
    longestStreak: number;
    achievedAt: string;
  } | null;
};

const EMPTY: LocalBests = { timed: null, race: null, endless: null };

const readRaw = (): LocalBests => {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<LocalBests>;
    return {
      timed: parsed.timed ?? null,
      race: parsed.race ?? null,
      endless: parsed.endless ?? null,
    };
  } catch {
    return EMPTY;
  }
};

const writeRaw = (next: LocalBests) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage full or disabled — silently no-op; cache is best-effort.
  }
};

export const loadLocalBests = (): LocalBests => readRaw();

export const replaceLocalBests = (bests: LocalBests) => writeRaw(bests);

export const recordLocalRun = (
  mode: SpeedMode,
  run: {
    correctCount: number;
    elapsedMs: number;
    longestStreak: number;
    skipsUsed: number;
  },
): { newBest: boolean } => {
  const current = readRaw();
  const achievedAt = new Date().toISOString();
  let newBest = false;
  switch (mode) {
    case "timed": {
      if (!current.timed || run.correctCount > current.timed.correctCount) {
        current.timed = { correctCount: run.correctCount, achievedAt };
        newBest = true;
      }
      break;
    }
    case "race": {
      // Lower elapsed wins. Only record if the player actually finished
      // (correctCount === target) — caller is responsible for that gate.
      if (
        !current.race ||
        run.elapsedMs < current.race.elapsedMs ||
        (run.elapsedMs === current.race.elapsedMs && run.skipsUsed < current.race.skipsUsed)
      ) {
        current.race = {
          elapsedMs: run.elapsedMs,
          skipsUsed: run.skipsUsed,
          achievedAt,
        };
        newBest = true;
      }
      break;
    }
    case "endless": {
      if (
        !current.endless ||
        run.correctCount > current.endless.correctCount ||
        (run.correctCount === current.endless.correctCount &&
          run.longestStreak > current.endless.longestStreak)
      ) {
        current.endless = {
          correctCount: run.correctCount,
          longestStreak: run.longestStreak,
          achievedAt,
        };
        newBest = true;
      }
      break;
    }
  }
  writeRaw(current);
  return { newBest };
};
