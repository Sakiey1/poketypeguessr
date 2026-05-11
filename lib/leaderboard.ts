"use client";

import type { SpeedMode } from "@/lib/speed-mode/types";
import { getSupabase } from "@/lib/supabase-client";

// Schema (see supabase migration `init_profiles_and_leaderboard`):
//   leaderboard_scores(id, user_id, mode, correct_count, elapsed_ms,
//                      longest_streak, target, skips_used, achieved_at)
//   profiles(id, username, created_at)
//
// Sort order per mode (matches the partial indexes on the table):
//   timed   : correct_count desc
//   race    : elapsed_ms asc, then skips_used asc, then achieved_at asc
//   endless : correct_count desc, then longest_streak desc

export type LeaderboardRow = {
  id: number;
  userId: string;
  username: string;
  mode: SpeedMode;
  correctCount: number;
  elapsedMs: number;
  longestStreak: number;
  target: number | null;
  skipsUsed: number;
  achievedAt: string;
};

type RawRow = {
  id: number;
  user_id: string;
  mode: SpeedMode;
  correct_count: number;
  elapsed_ms: number;
  longest_streak: number;
  target: number | null;
  skips_used: number;
  achieved_at: string;
  profiles: { username: string } | { username: string }[] | null;
};

const SCORE_SELECT =
  "id, user_id, mode, correct_count, elapsed_ms, longest_streak, target, skips_used, achieved_at, profiles ( username )";

const PENDING_QUEUE_KEY = "pokeguess.speedmode.pending.v1";

type PendingScore = {
  mode: SpeedMode;
  correctCount: number;
  elapsedMs: number;
  longestStreak: number;
  target: number | null;
  skipsUsed: number;
  queuedAt: string;
};

const readPendingQueue = (): PendingScore[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PENDING_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PendingScore[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writePendingQueue = (queue: PendingScore[]) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // localStorage full — drop silently rather than blocking the run.
  }
};

const adaptRow = (row: RawRow): LeaderboardRow => {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  return {
    id: row.id,
    userId: row.user_id,
    username: profile?.username ?? "(unknown)",
    mode: row.mode,
    correctCount: row.correct_count,
    elapsedMs: row.elapsed_ms,
    longestStreak: row.longest_streak,
    target: row.target,
    skipsUsed: row.skips_used,
    achievedAt: row.achieved_at,
  };
};

const asNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const asString = (value: unknown): string | null => (typeof value === "string" ? value : null);

const normalizeProfiles = (value: unknown): RawRow["profiles"] => {
  if (Array.isArray(value)) return value as RawRow["profiles"];
  if (value && typeof value === "object") return value as RawRow["profiles"];
  return null;
};

const normalizeRawRow = (raw: unknown): RawRow | null => {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = asNumber(row.id);
  const userId = asString(row.user_id) ?? asString(row.userId);
  const mode = row.mode;
  const correctCount = asNumber(row.correct_count) ?? asNumber(row.correctCount);
  const elapsedMs = asNumber(row.elapsed_ms) ?? asNumber(row.elapsedMs);
  const longestStreak = asNumber(row.longest_streak) ?? asNumber(row.longestStreak);
  const targetRaw = row.target;
  const skipsUsed = asNumber(row.skips_used) ?? asNumber(row.skipsUsed);
  const achievedAt = asString(row.achieved_at) ?? asString(row.achievedAt);
  const profileFromUsername =
    asString(row.username) !== null ? ({ username: asString(row.username)! } as const) : null;
  const profiles = normalizeProfiles(row.profiles ?? row.profile) ?? profileFromUsername;

  if (
    id === null ||
    userId === null ||
    (mode !== "timed" && mode !== "race" && mode !== "endless") ||
    correctCount === null ||
    elapsedMs === null ||
    longestStreak === null ||
    skipsUsed === null ||
    achievedAt === null
  ) {
    return null;
  }

  return {
    id,
    user_id: userId,
    mode,
    correct_count: correctCount,
    elapsed_ms: elapsedMs,
    longest_streak: longestStreak,
    target: typeof targetRaw === "number" || targetRaw === null ? targetRaw : null,
    skips_used: skipsUsed,
    achieved_at: achievedAt,
    profiles,
  };
};

const extractRunToken = (payload: unknown): string | null => {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as Record<string, unknown>;
  return (
    asString(data.runToken) ??
    asString(data.run_token) ??
    asString(data.token) ??
    asString(data.signedRunToken) ??
    null
  );
};

const extractRunTokenSignature = (payload: unknown): string | null => {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as Record<string, unknown>;
  return asString(data.runTokenSignature) ?? asString(data.run_token_signature) ?? null;
};

const extractFinishedRow = (payload: unknown): RawRow | null => {
  const direct = normalizeRawRow(payload);
  if (direct) return direct;
  if (!payload || typeof payload !== "object") return null;
  const data = payload as Record<string, unknown>;
  return (
    normalizeRawRow(data.row) ??
    normalizeRawRow(data.score) ??
    normalizeRawRow(data.leaderboardScore) ??
    normalizeRawRow(data.result) ??
    null
  );
};

const extractFinishedRowId = (payload: unknown): number | null => {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as Record<string, unknown>;
  return (
    asNumber(data.id) ??
    asNumber(data.score_id) ??
    asNumber(data.scoreId) ??
    (data.row && typeof data.row === "object" ? asNumber((data.row as { id?: unknown }).id) : null) ??
    null
  );
};

const orderForMode = (mode: SpeedMode) => {
  switch (mode) {
    case "timed":
      return [
        { column: "correct_count", ascending: false },
        { column: "achieved_at", ascending: true },
      ];
    case "race":
      return [
        { column: "elapsed_ms", ascending: true },
        { column: "skips_used", ascending: true },
        { column: "achieved_at", ascending: true },
      ];
    case "endless":
      return [
        { column: "correct_count", ascending: false },
        { column: "longest_streak", ascending: false },
        { column: "achieved_at", ascending: true },
      ];
  }
};

export const fetchTopScores = async (
  mode: SpeedMode,
  limit: number,
): Promise<LeaderboardRow[]> => {
  const supabase = getSupabase();
  if (!supabase) return [];

  let query = supabase
    .from("leaderboard_scores")
    .select(SCORE_SELECT)
    .eq("mode", mode);

  for (const order of orderForMode(mode)) {
    query = query.order(order.column, { ascending: order.ascending });
  }

  const { data, error } = await query.limit(limit);
  if (error || !data) return [];
  return (data as unknown as RawRow[]).map(adaptRow);
};

export type RankResult = { rank: number; total: number } | null;

export const fetchRunRank = async (
  mode: SpeedMode,
  run: {
    correctCount: number;
    elapsedMs: number;
    longestStreak: number;
    skipsUsed: number;
  },
): Promise<RankResult> => {
  const supabase = getSupabase();
  if (!supabase) return null;

  // For each mode: count how many existing scores STRICTLY beat this run.
  // Rank = beaten + 1; ties don't outrank, so two #5s are both "#5".
  let beatenQuery = supabase
    .from("leaderboard_scores")
    .select("*", { count: "exact", head: true })
    .eq("mode", mode);

  switch (mode) {
    case "timed":
      beatenQuery = beatenQuery.gt("correct_count", run.correctCount);
      break;
    case "race":
      beatenQuery = beatenQuery.lt("elapsed_ms", run.elapsedMs);
      break;
    case "endless":
      // Strict beat: more correct, OR same correct + longer streak.
      beatenQuery = beatenQuery.or(
        `correct_count.gt.${run.correctCount},and(correct_count.eq.${run.correctCount},longest_streak.gt.${run.longestStreak})`,
      );
      break;
  }

  const { count: beaten, error: beatenError } = await beatenQuery;
  const { count: total, error: totalError } = await supabase
    .from("leaderboard_scores")
    .select("*", { count: "exact", head: true })
    .eq("mode", mode);

  if (beatenError || totalError) return null;
  return {
    rank: (beaten ?? 0) + 1,
    total: total ?? 0,
  };
};

export type SubmitOutcome =
  | { ok: true; row: LeaderboardRow }
  | { ok: false; queued: boolean; error: string };

const insertScore = async (
  userId: string,
  payload: PendingScore,
): Promise<LeaderboardRow | { error: string }> => {
  const supabase = getSupabase();
  if (!supabase) return { error: "supabase_missing" };

  const { data: startData, error: startError } = await supabase.functions.invoke("start-run", {
    body: {
      mode: payload.mode,
      target: payload.target,
    },
  });
  if (startError) {
    return { error: startError.message ?? "start_run_failed" };
  }
  const runToken = extractRunToken(startData);
  if (!runToken) {
    return { error: "start_run_missing_token" };
  }
  const runTokenSignature = extractRunTokenSignature(startData);
  if (!runTokenSignature) {
    return { error: "start_run_missing_signature" };
  }

  const { data: finishData, error: finishError } = await supabase.functions.invoke("finish-run", {
    body: {
      runToken,
      runTokenSignature,
      run_token: runToken,
      run_token_signature: runTokenSignature,
      mode: payload.mode,
      correctCount: payload.correctCount,
      correct_count: payload.correctCount,
      elapsedMs: payload.elapsedMs,
      elapsed_ms: payload.elapsedMs,
      longestStreak: payload.longestStreak,
      longest_streak: payload.longestStreak,
      target: payload.target,
      skipsUsed: payload.skipsUsed,
      skips_used: payload.skipsUsed,
    },
  });
  if (finishError) {
    return { error: finishError.message ?? "finish_run_failed" };
  }

  const finishedRow = extractFinishedRow(finishData);
  if (finishedRow) {
    return adaptRow(finishedRow);
  }

  const finishedId = extractFinishedRowId(finishData);
  if (finishedId !== null) {
    const { data, error } = await supabase
      .from("leaderboard_scores")
      .select(SCORE_SELECT)
      .eq("id", finishedId)
      .single();
    if (!error && data) {
      return adaptRow(data as unknown as RawRow);
    }
  }

  // Defensive fallback: if function wrote the score but returned a minimal body,
  // fetch the latest row for this user/mode.
  const { data: fallbackData, error: fallbackError } = await supabase
    .from("leaderboard_scores")
    .select(SCORE_SELECT)
    .eq("user_id", userId)
    .eq("mode", payload.mode)
    .order("achieved_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (fallbackError || !fallbackData) {
    return { error: fallbackError?.message ?? "finish_run_no_row" };
  }
  return adaptRow(fallbackData as unknown as RawRow);
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Submit a finished run. One automatic retry with backoff; on second failure
 * the score is queued in localStorage and the caller can show a "couldn't
 * save" toast. flushPendingScores() drains the queue on next auth event.
 */
export const submitScore = async (
  userId: string,
  run: Omit<PendingScore, "queuedAt">,
): Promise<SubmitOutcome> => {
  const payload: PendingScore = { ...run, queuedAt: new Date().toISOString() };
  const first = await insertScore(userId, payload);
  if ("id" in first) {
    return { ok: true, row: first };
  }
  await sleep(1500);
  const second = await insertScore(userId, payload);
  if ("id" in second) {
    return { ok: true, row: second };
  }

  const queue = readPendingQueue();
  queue.push(payload);
  writePendingQueue(queue);
  return { ok: false, queued: true, error: second.error };
};

/**
 * Try to drain previously-failed submissions for the currently authed user.
 * Best-effort — anything that still fails stays queued.
 */
export const flushPendingScores = async (userId: string): Promise<number> => {
  const queue = readPendingQueue();
  if (queue.length === 0) return 0;
  const remaining: PendingScore[] = [];
  let drained = 0;
  for (const item of queue) {
    const result = await insertScore(userId, item);
    if ("id" in result) {
      drained += 1;
    } else {
      remaining.push(item);
    }
  }
  writePendingQueue(remaining);
  return drained;
};

export const compareForBetter = (
  mode: SpeedMode,
  a: { correctCount: number; elapsedMs: number; longestStreak: number; skipsUsed: number },
  b: { correctCount: number; elapsedMs: number; longestStreak: number; skipsUsed: number },
): "a" | "b" | "tie" => {
  switch (mode) {
    case "timed":
      if (a.correctCount > b.correctCount) return "a";
      if (a.correctCount < b.correctCount) return "b";
      return "tie";
    case "race":
      if (a.elapsedMs < b.elapsedMs) return "a";
      if (a.elapsedMs > b.elapsedMs) return "b";
      if (a.skipsUsed < b.skipsUsed) return "a";
      if (a.skipsUsed > b.skipsUsed) return "b";
      return "tie";
    case "endless":
      if (a.correctCount > b.correctCount) return "a";
      if (a.correctCount < b.correctCount) return "b";
      if (a.longestStreak > b.longestStreak) return "a";
      if (a.longestStreak < b.longestStreak) return "b";
      return "tie";
  }
};
