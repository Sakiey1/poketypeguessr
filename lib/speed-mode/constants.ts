// Single-player Speed Mode tuning. Keep these in sync with the spec —
// changing them shifts what scores are comparable across players, so any
// edit should also bump the local-best cache key in lib/local-best.ts.

export const TIMED_DURATION_MS = 60_000;
export const TIMED_SKIP_PENALTY_MS = 5_000;

export const RACE_TARGET = 20;
export const RACE_MAX_SKIPS = 3;

export const ENDLESS_MAX_STRIKES = 3;

export const LEADERBOARD_PAGE_SIZE = 10;
export const LEADERBOARD_MINI_SIZE = 5;

// Default settings for solo runs: every generation, every constraint type,
// alt forms included. Mirrors the multiplayer DEFAULT_SETTINGS in server.js.
export const SOLO_GENERATIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

// Wrong-answer flash duration before auto-advancing to the next pokémon.
export const WRONG_FLASH_MS = 600;
