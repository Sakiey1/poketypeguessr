"use client";

import type { LeaderboardRow } from "@/lib/leaderboard";
import type { SpeedMode } from "@/lib/speed-mode/types";
import { formatStopwatch } from "@/lib/speed-mode/timer";

type LeaderboardProps = {
  mode: SpeedMode;
  rows: LeaderboardRow[];
  loading?: boolean;
  highlightUserId?: string | null;
  emptyMessage?: string;
  compact?: boolean;
};

const MODE_HEADER: Record<SpeedMode, string> = {
  timed: "Top — Timed (60s)",
  race: "Top — Race to 20",
  endless: "Top — Endless",
};

const formatScore = (mode: SpeedMode, row: LeaderboardRow) => {
  switch (mode) {
    case "timed":
      return `${row.correctCount}`;
    case "race":
      return formatStopwatch(row.elapsedMs);
    case "endless":
      return `${row.correctCount} · streak ${row.longestStreak}`;
  }
};

const formatScoreSubtitle = (mode: SpeedMode, row: LeaderboardRow): string | null => {
  switch (mode) {
    case "timed":
      return row.skipsUsed > 0 ? `${row.skipsUsed} skip${row.skipsUsed === 1 ? "" : "s"}` : null;
    case "race":
      return row.skipsUsed > 0 ? `${row.skipsUsed} skip${row.skipsUsed === 1 ? "" : "s"}` : null;
    case "endless":
      return null;
  }
};

export function Leaderboard({
  mode,
  rows,
  loading = false,
  highlightUserId = null,
  emptyMessage = "No scores yet — be the first.",
  compact = false,
}: LeaderboardProps) {
  return (
    <div className="border-4 border-black bg-white">
      <div className="border-b-4 border-black bg-[#f7f4e7] px-3 py-2 font-press text-[10px] uppercase">
        {MODE_HEADER[mode]}
      </div>
      <ol className="divide-y-2 divide-black">
        {loading && rows.length === 0 && (
          <li className="px-3 py-3 font-pixel text-xl text-black/60">Loading…</li>
        )}
        {!loading && rows.length === 0 && (
          <li className="px-3 py-3 font-pixel text-xl text-black/60">{emptyMessage}</li>
        )}
        {rows.map((row, index) => {
          const subtitle = formatScoreSubtitle(mode, row);
          const isMe = highlightUserId && row.userId === highlightUserId;
          return (
            <li
              key={row.id}
              className={`flex items-center justify-between gap-2 px-3 py-2 ${
                isMe ? "bg-[#9bbc0f]" : ""
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-press text-[10px] w-7 text-black/60">
                  #{index + 1}
                </span>
                <span className={`font-pixel ${compact ? "text-xl" : "text-2xl"} truncate`}>
                  {row.username}
                </span>
              </div>
              <div className="text-right">
                <div className={`font-press ${compact ? "text-[10px]" : "text-xs"}`}>
                  {formatScore(mode, row)}
                </div>
                {subtitle && (
                  <div className="font-pixel text-base text-black/60">{subtitle}</div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
