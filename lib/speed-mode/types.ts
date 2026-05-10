import type { ClientConstraint } from "@/lib/constraints";
import type { TypeCombo } from "@/lib/types";

export type SpeedMode = "timed" | "race" | "endless";

export const SPEED_MODES: readonly SpeedMode[] = ["timed", "race", "endless"];

export const isSpeedMode = (value: unknown): value is SpeedMode =>
  typeof value === "string" && (SPEED_MODES as readonly string[]).includes(value);

export type SpeedStatus = "select" | "playing" | "gameover";

export type RoundResult = "correct" | "wrong" | "skip";

export type RoundEntry = {
  pokemonId: number;
  pokemonName: string;
  combo: TypeCombo;
  result: RoundResult;
  tookMs: number;
};

export type CurrentRound = {
  combo: TypeCombo;
  constraint: ClientConstraint | null;
  startedAt: number; // performance.now() snapshot for the answer-time stat
};

export type SpeedRunSummary = {
  mode: SpeedMode;
  correctCount: number;
  wrongCount: number;
  longestStreak: number;
  elapsedMs: number;
  skipsUsed: number;
  // Race target (N). Only meaningful for race runs; tracked here so the
  // game-over screen and leaderboard submission can read a single object.
  target: number | null;
};
