"use client";

import {
  ENDLESS_MAX_STRIKES,
  RACE_MAX_SKIPS,
  RACE_TARGET,
  TIMED_DURATION_MS,
  TIMED_SKIP_PENALTY_MS,
} from "@/lib/speed-mode/constants";
import type { SpeedMode } from "@/lib/speed-mode/types";
import { formatCountdown, formatStopwatch } from "@/lib/speed-mode/timer";

type Stat = { label: string; value: string };

type SpeedModeHudProps = {
  mode: SpeedMode;
  elapsedMs: number;
  correctCount: number;
  skipsUsed: number;
  strikes: number;
  currentStreak: number;
};

export function SpeedModeHud({
  mode,
  elapsedMs,
  correctCount,
  skipsUsed,
  strikes,
  currentStreak,
}: SpeedModeHudProps) {
  switch (mode) {
    case "timed": {
      const remaining = Math.max(0, TIMED_DURATION_MS - elapsedMs);
      const seconds = remaining / 1000;
      const danger = seconds < 10;
      const pulsing = seconds < 5;
      return (
        <Hud
          accent={danger ? "#c03028" : "#1a1a1a"}
          stats={[
            { label: "Correct", value: String(correctCount) },
            { label: "Skips", value: `${skipsUsed} (-${TIMED_SKIP_PENALTY_MS / 1000}s each)` },
          ]}
          big={
            <span
              className={`font-press text-4xl md:text-5xl ${pulsing ? "animate-pulse" : ""}`}
              style={{ color: danger ? "#c03028" : "#1a1a1a" }}
            >
              {formatCountdown(remaining)}
            </span>
          }
        />
      );
    }
    case "race": {
      const skipsRemaining = Math.max(0, RACE_MAX_SKIPS - skipsUsed);
      return (
        <Hud
          accent="#1a1a1a"
          stats={[
            { label: "Progress", value: `${correctCount} / ${RACE_TARGET}` },
            {
              label: "Skips",
              value: `${skipsRemaining} left`,
            },
          ]}
          big={
            <span className="font-press text-4xl md:text-5xl">
              {formatStopwatch(elapsedMs)}
            </span>
          }
        />
      );
    }
    case "endless": {
      return (
        <Hud
          accent="#1a1a1a"
          stats={[
            { label: "Streak", value: String(currentStreak) },
            { label: "Correct", value: String(correctCount) },
          ]}
          big={
            <div className="flex flex-col items-center gap-2">
              <span className="font-press text-3xl md:text-4xl">
                {formatStopwatch(elapsedMs)}
              </span>
              <StrikeRow strikes={strikes} />
            </div>
          }
        />
      );
    }
  }
}

function Hud({
  big,
  stats,
  accent,
}: {
  big: React.ReactNode;
  stats: Stat[];
  accent: string;
}) {
  return (
    <div
      className="border-4 border-black bg-white px-4 py-3 flex flex-wrap items-center justify-between gap-4"
      style={{ boxShadow: `4px 4px 0 0 ${accent}` }}
    >
      <div className="flex flex-col items-start min-w-[140px]">{big}</div>
      <div className="flex flex-wrap gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="border-2 border-black px-3 py-2 bg-[#f7f4e7] min-w-[120px]"
          >
            <div className="font-press text-[9px] uppercase tracking-wide text-black/60">
              {stat.label}
            </div>
            <div className="font-pixel text-2xl">{stat.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StrikeRow({ strikes }: { strikes: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: ENDLESS_MAX_STRIKES }).map((_, index) => {
        const struck = index < strikes;
        return (
          <span
            key={index}
            className={`inline-flex h-6 w-6 items-center justify-center border-2 border-black font-press text-[10px] ${
              struck ? "bg-[#c03028] text-white" : "bg-white text-black/30"
            }`}
            aria-label={struck ? "strike" : "no strike"}
          >
            {struck ? "X" : ""}
          </span>
        );
      })}
    </div>
  );
}
