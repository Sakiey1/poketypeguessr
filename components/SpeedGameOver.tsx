"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { AuthModal } from "@/components/AuthModal";
import { Leaderboard } from "@/components/Leaderboard";
import { PixelButton } from "@/components/PixelButton";
import {
  fetchRunRank,
  fetchTopScores,
  submitScore,
  type LeaderboardRow,
  type RankResult,
} from "@/lib/leaderboard";
import { LEADERBOARD_PAGE_SIZE, RACE_TARGET } from "@/lib/speed-mode/constants";
import type { SpeedRunSummary } from "@/lib/speed-mode/types";
import { formatStopwatch } from "@/lib/speed-mode/timer";
import { useAuth } from "@/lib/use-auth";

type SpeedGameOverProps = {
  summary: SpeedRunSummary;
  // For race mode we only submit if the run finished (correctCount === target).
  // For other modes, all completed runs are eligible.
  eligible: boolean;
  // Computed by the play page at end-of-run (so the localStorage write
  // happens in the event that ended the run, not in a mount effect here).
  newBest: boolean;
  onPlayAgain: () => void;
  onChangeMode: () => void;
  onMainMenu: () => void;
};

type SubmitState =
  | { phase: "idle" }
  | { phase: "submitting" }
  | { phase: "submitted" }
  | { phase: "queued"; message: string }
  | { phase: "skipped" } // guest, not yet signed in
  | { phase: "ineligible" };

// Internal submission status (independent of authState; we combine the two
// when rendering so we don't need an effect just to flip "skipped").
type InternalSubmit =
  | { phase: "idle" }
  | { phase: "submitting" }
  | { phase: "submitted" }
  | { phase: "queued"; message: string };

export function SpeedGameOver({
  summary,
  eligible,
  newBest,
  onPlayAgain,
  onChangeMode,
  onMainMenu,
}: SpeedGameOverProps) {
  const { state: authState } = useAuth();
  const [rank, setRank] = useState<RankResult>(null);
  const [rankLoading, setRankLoading] = useState(true);
  const [topRows, setTopRows] = useState<LeaderboardRow[]>([]);
  const [topLoading, setTopLoading] = useState(true);
  const [internalSubmit, setInternalSubmit] = useState<InternalSubmit>({ phase: "idle" });
  const [showAuth, setShowAuth] = useState(false);
  // Track which user we've already submitted for so the auth-watch effect
  // never double-submits across re-renders or quick auth toggles.
  const submittedForUserRef = useRef<string | null>(null);

  // Display state derived from the combination of internal submit progress,
  // eligibility, and auth — no effect required.
  const submitState: SubmitState = !eligible
    ? { phase: "ineligible" }
    : internalSubmit.phase === "idle" && authState.status !== "authed"
      ? { phase: "skipped" }
      : internalSubmit;

  const refreshLeaderboard = useCallback(async () => {
    setTopLoading(true);
    setRankLoading(true);
    const [top, rankResult] = await Promise.all([
      fetchTopScores(summary.mode, LEADERBOARD_PAGE_SIZE),
      eligible
        ? fetchRunRank(summary.mode, {
            correctCount: summary.correctCount,
            elapsedMs: summary.elapsedMs,
            longestStreak: summary.longestStreak,
            skipsUsed: summary.skipsUsed,
          })
        : Promise.resolve(null),
    ]);
    setTopRows(top);
    setRank(rankResult);
    setTopLoading(false);
    setRankLoading(false);
  }, [eligible, summary]);

  // Fetch rank + top-10 once on mount. The lint rule warns that this
  // setState-from-effect is "cascading"; in this case the side effect is a
  // network round-trip whose result is the actual app state we need.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshLeaderboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-submit once when authed. Re-fires only if the user changes (so a
  // sign-out + sign-in-as-someone-else still gets one submission).
  useEffect(() => {
    if (!eligible) return;
    if (authState.status !== "authed") return;
    if (submittedForUserRef.current === authState.user.id) return;
    submittedForUserRef.current = authState.user.id;

    let cancelled = false;
    (async () => {
      setInternalSubmit({ phase: "submitting" });
      const result = await submitScore(authState.user.id, {
        mode: summary.mode,
        correctCount: summary.correctCount,
        elapsedMs: summary.elapsedMs,
        longestStreak: summary.longestStreak,
        target: summary.target,
        skipsUsed: summary.skipsUsed,
      });
      if (cancelled) return;
      if (result.ok) {
        setInternalSubmit({ phase: "submitted" });
        await refreshLeaderboard();
      } else {
        setInternalSubmit({
          phase: "queued",
          message:
            "Couldn't save your score right now. We'll retry next time you sign in.",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState.status, eligible]);

  const totalAttempts = summary.correctCount + summary.wrongCount;
  const accuracyPct =
    totalAttempts > 0
      ? Math.round((summary.correctCount / totalAttempts) * 100)
      : null;

  const stats: Array<{ label: string; value: string }> = (() => {
    switch (summary.mode) {
      case "timed":
        return [
          { label: "Correct", value: String(summary.correctCount) },
          {
            label: "Accuracy",
            value: accuracyPct === null ? "—" : `${accuracyPct}%`,
          },
          { label: "Skips used", value: String(summary.skipsUsed) },
        ];
      case "race":
        return [
          {
            label: "Time",
            value: eligible ? formatStopwatch(summary.elapsedMs) : "—",
          },
          {
            label: "Progress",
            value: `${summary.correctCount} / ${summary.target ?? RACE_TARGET}`,
          },
          {
            label: "Accuracy",
            value: accuracyPct === null ? "—" : `${accuracyPct}%`,
          },
          { label: "Skips used", value: String(summary.skipsUsed) },
        ];
      case "endless":
        return [
          { label: "Correct", value: String(summary.correctCount) },
          { label: "Longest streak", value: String(summary.longestStreak) },
          { label: "Time", value: formatStopwatch(summary.elapsedMs) },
        ];
    }
  })();

  return (
    <div className="space-y-5">
      <section className="border-4 border-black bg-white p-5 md:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-press text-xl md:text-2xl">Game Over</h2>
          {newBest && eligible && (
            <span
              className="border-2 border-black bg-[#9bbc0f] px-3 py-1 font-press text-[10px] uppercase"
              style={{ boxShadow: "3px 3px 0 0 #1a1a1a" }}
            >
              New high score!
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="border-2 border-black bg-[#f7f4e7] px-3 py-2"
            >
              <div className="font-press text-[9px] uppercase tracking-wide text-black/60">
                {stat.label}
              </div>
              <div className="font-pixel text-2xl">{stat.value}</div>
            </div>
          ))}
        </div>
        {eligible && (
          <div className="font-pixel text-xl">
            {rankLoading
              ? "Calculating global rank…"
              : rank
                ? `Global rank: #${rank.rank} of ${rank.total}`
                : "Global rank: unavailable"}
          </div>
        )}
        {!eligible && summary.mode === "race" && (
          <p className="font-pixel text-lg text-black/60">
            Race didn&apos;t finish, so this run isn&apos;t eligible for the leaderboard.
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <PixelButton onClick={onPlayAgain}>Play Again</PixelButton>
          <PixelButton variant="secondary" onClick={onChangeMode}>
            Change Mode
          </PixelButton>
          <PixelButton variant="danger" onClick={onMainMenu}>
            Main Menu
          </PixelButton>
        </div>
      </section>

      {eligible && submitState.phase === "skipped" && authState.status !== "authed" && (
        <section
          className="border-4 border-black bg-[#f7f4e7] p-4 md:p-5 space-y-3"
          style={{ boxShadow: "4px 4px 0 0 #9bbc0f" }}
        >
          <h3 className="font-press text-sm">Sign in to save this score</h3>
          <p className="font-pixel text-xl">
            Pick a username + password (no email needed) and your run is saved
            to the global leaderboard.
          </p>
          <div className="flex flex-wrap gap-2">
            <PixelButton onClick={() => setShowAuth(true)}>Sign Up / Sign In</PixelButton>
          </div>
          <AuthModal
            open={showAuth}
            initialMode="signup"
            onClose={() => setShowAuth(false)}
            title="Sign in to save your score"
          />
        </section>
      )}

      {submitState.phase === "submitting" && (
        <p className="font-pixel text-xl text-black/60">Saving your score…</p>
      )}
      {submitState.phase === "submitted" && (
        <p className="font-pixel text-xl text-[#3a7a2e]">Score saved.</p>
      )}
      {submitState.phase === "queued" && (
        <p className="font-pixel text-xl text-[#c03028]">{submitState.message}</p>
      )}

      <Leaderboard
        mode={summary.mode}
        rows={topRows}
        loading={topLoading}
        highlightUserId={authState.status === "authed" ? authState.user.id : null}
      />
    </div>
  );
}
