"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ConstraintBadge } from "@/components/ConstraintBadge";
import { PixelButton } from "@/components/PixelButton";
import { PokemonSearchDropdown } from "@/components/PokemonSearchDropdown";
import { SpeechBox } from "@/components/SpeechBox";
import { SpeedGameOver } from "@/components/SpeedGameOver";
import { SpeedModeHud } from "@/components/SpeedModeHud";
import { TypeBadge } from "@/components/TypeBadge";
import pokemonData from "@/data/pokemon.json";
import {
  renderConstraintForClient,
  validateAgainstConstraint,
  type ClientConstraint,
  type Constraint,
} from "@/lib/constraints";
import {
  ENDLESS_MAX_STRIKES,
  RACE_MAX_SKIPS,
  RACE_TARGET,
  TIMED_DURATION_MS,
  TIMED_SKIP_PENALTY_MS,
  WRONG_FLASH_MS,
} from "@/lib/speed-mode/constants";
import { recordLocalRun } from "@/lib/local-best";
import { RoundPicker } from "@/lib/speed-mode/picker";
import { formatStopwatch, useStopwatch } from "@/lib/speed-mode/timer";
import { isSpeedMode, type SpeedMode, type SpeedRunSummary } from "@/lib/speed-mode/types";
import type { PokemonEntry, TypeCombo } from "@/lib/types";
import { normalizeCombo } from "@/lib/pokemon-utils";

type Status = "playing" | "gameover";
type Flash = "correct" | "wrong" | "skip" | null;

const ALL_POKEMON = pokemonData as unknown as PokemonEntry[];
const POKEMON_BY_ID = new Map(ALL_POKEMON.map((p) => [p.id, p]));

const MODE_TITLE: Record<SpeedMode, string> = {
  timed: "Timed",
  race: "Race to N",
  endless: "Endless",
};

export default function SpeedPlayPage() {
  const params = useParams<{ mode: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const modeParam = params.mode ?? "";

  if (!isSpeedMode(modeParam)) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[#f7f4e7] p-6 font-pixel text-2xl">
        <p>Unknown mode: {modeParam}</p>
        <PixelButton onClick={() => router.push("/speed")}>Pick a mode</PixelButton>
      </main>
    );
  }

  return <SpeedRun mode={modeParam} key={`${modeParam}:${searchParams.toString()}`} />;
}

function SpeedRun({ mode }: { mode: SpeedMode }) {
  const router = useRouter();
  const canPause = mode === "endless";

  // The picker is created once and never re-created across renders. Stored
  // in a ref because it's a stateful object that must NOT trigger renders
  // when its internal sets mutate.
  const pickerRef = useRef<RoundPicker | null>(null);
  if (pickerRef.current === null) {
    pickerRef.current = new RoundPicker(ALL_POKEMON);
  }

  const [status, setStatus] = useState<Status>("playing");
  const [combo, setCombo] = useState<TypeCombo | null>(null);
  const [constraint, setConstraint] = useState<Constraint | null>(null);
  const [clientConstraint, setClientConstraint] = useState<ClientConstraint | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [skipsUsed, setSkipsUsed] = useState(0);
  const [strikes, setStrikes] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [flash, setFlash] = useState<Flash>(null);
  // Each timed-mode skip adds 5_000 to the displayed elapsed so the
  // countdown drops by 5s. Stored separately from stopwatch.elapsedMs so
  // the underlying wall-clock stays honest.
  const [timedPenaltyMs, setTimedPenaltyMs] = useState(0);
  const [finalElapsedMs, setFinalElapsedMs] = useState(0);
  const [inputLocked, setInputLocked] = useState(false);
  const [newBest, setNewBest] = useState(false);

  // The rAF loop reads the latest penalty via this ref so the limit check
  // sees timed-mode penalties without re-creating the stopwatch each render.
  // The mirror-into-ref effects below keep these in sync after each render.
  const timedPenaltyRef = useRef(0);
  const endRunRef = useRef<() => void>(() => {});

  const stopwatch = useStopwatch({
    limitMs: mode === "timed" ? TIMED_DURATION_MS : undefined,
    getExtraMs: mode === "timed" ? () => timedPenaltyRef.current : undefined,
    onLimit: mode === "timed" ? () => endRunRef.current() : undefined,
    pauseOnVisibilityHidden: canPause,
  });

  const advance = useCallback(() => {
    const picker = pickerRef.current;
    if (!picker) return;
    const next = picker.next();
    setCombo(next.combo);
    setConstraint(next.constraint);
    setClientConstraint(renderConstraintForClient(next.constraint));
    setFlash(null);
    setInputLocked(false);
  }, []);

  const finalizeRun = useCallback(
    (elapsedMs: number) => {
      // Pull the rest of "what happened" out of state via functional updates
      // so this stays valid regardless of when it's invoked (rAF callback,
      // event handler, or another setState resolver).
      setStatus((current) => {
        if (current !== "playing") return current;
        setInputLocked(true);
        setFinalElapsedMs(elapsedMs);
        return "gameover";
      });
    },
    [],
  );

  // The mode-specific eligibility check decides whether to write a local
  // best. Race runs that didn't hit RACE_TARGET aren't eligible, so we'd
  // skip the localStorage write for those. We compute eligibility here at
  // end-of-run from the closure values to avoid stale-closure surprises.
  const recordIfEligible = useCallback(
    (elapsedMs: number) => {
      const eligibleNow =
        mode === "race" ? correctCount >= RACE_TARGET : true;
      if (!eligibleNow) return;
      const { newBest: wasBest } = recordLocalRun(mode, {
        correctCount,
        elapsedMs,
        longestStreak,
        skipsUsed,
      });
      if (wasBest) setNewBest(true);
    },
    [correctCount, longestStreak, mode, skipsUsed],
  );

  const endRun = useCallback(() => {
    const elapsed = stopwatch.stop();
    const adjusted = elapsed + (mode === "timed" ? timedPenaltyMs : 0);
    recordIfEligible(adjusted);
    finalizeRun(adjusted);
  }, [finalizeRun, mode, recordIfEligible, stopwatch, timedPenaltyMs]);

  // Keep the rAF-readable refs aligned with current state after every render.
  useEffect(() => {
    timedPenaltyRef.current = timedPenaltyMs;
  });
  useEffect(() => {
    endRunRef.current = endRun;
  });

  // Boot: fire the first round and start the clock so the run feels instant.
  // The stopwatch's onLimit callback handles timed-mode expiry, so there's
  // no separate watcher effect (which the React Compiler lint disallows).
  useEffect(() => {
    advance();
    stopwatch.start();
    return () => {
      stopwatch.reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = useCallback(
    (pokemonId: number) => {
      if (status !== "playing" || !combo || inputLocked) return;
      // Timed mode: don't accept an in-flight submission once the clock has
      // hit zero (the watcher effect will end the run on the next tick).
      if (
        mode === "timed" &&
        stopwatch.elapsedMs + timedPenaltyMs >= TIMED_DURATION_MS
      ) {
        return;
      }

      const pokemon = POKEMON_BY_ID.get(pokemonId);
      if (!pokemon) return;
      const matchesType =
        pokemon.types.length === 2 &&
        normalizeCombo([pokemon.types[0], pokemon.types[1]]) ===
          normalizeCombo([combo[0], combo[1]]);
      const matchesConstraint = validateAgainstConstraint(pokemon, constraint);
      const isCorrect = matchesType && matchesConstraint;

      if (isCorrect) {
        pickerRef.current?.markPokemonUsed(pokemon.id);
        const nextCorrect = correctCount + 1;
        setCorrectCount(nextCorrect);
        const nextStreak = currentStreak + 1;
        setCurrentStreak(nextStreak);
        if (nextStreak > longestStreak) {
          setLongestStreak(nextStreak);
        }
        setFlash("correct");
        if (mode === "race" && nextCorrect >= RACE_TARGET) {
          // Stop immediately so elapsed = moment of target-clearing answer.
          endRun();
          return;
        }
        advance();
        return;
      }

      // Wrong answer.
      setWrongCount((value) => value + 1);
      setCurrentStreak(0);
      setFlash("wrong");
      setInputLocked(true);

      if (mode === "endless") {
        const nextStrikes = strikes + 1;
        setStrikes(nextStrikes);
        if (nextStrikes >= ENDLESS_MAX_STRIKES) {
          setTimeout(() => endRun(), WRONG_FLASH_MS);
          return;
        }
      }

      setTimeout(() => {
        setInputLocked(false);
        setFlash(null);
      }, WRONG_FLASH_MS);
    },
    [
      advance,
      combo,
      constraint,
      correctCount,
      currentStreak,
      endRun,
      inputLocked,
      longestStreak,
      mode,
      status,
      stopwatch.elapsedMs,
      strikes,
      timedPenaltyMs,
    ],
  );

  const skipsRemaining = mode === "race" ? Math.max(0, RACE_MAX_SKIPS - skipsUsed) : null;
  const skipDisabled =
    status !== "playing" ||
    inputLocked ||
    (mode === "race" && skipsRemaining !== null && skipsRemaining <= 0);

  const skipHint = (() => {
    switch (mode) {
      case "timed":
        return `−${TIMED_SKIP_PENALTY_MS / 1000}s`;
      case "race":
        return skipsRemaining === null
          ? ""
          : `${skipsRemaining} skip${skipsRemaining === 1 ? "" : "s"} left`;
      case "endless":
        return "Costs a strike";
    }
  })();

  const handleSkip = useCallback(() => {
    if (skipDisabled) return;
    setSkipsUsed((value) => value + 1);
    setFlash("skip");

    switch (mode) {
      case "timed": {
        setTimedPenaltyMs((value) => value + TIMED_SKIP_PENALTY_MS);
        // The watcher effect will catch a now-overshot clock on the next
        // render and end the run; otherwise just advance.
        advance();
        return;
      }
      case "race": {
        advance();
        return;
      }
      case "endless": {
        const nextStrikes = strikes + 1;
        setStrikes(nextStrikes);
        if (nextStrikes >= ENDLESS_MAX_STRIKES) {
          setTimeout(() => endRun(), WRONG_FLASH_MS);
          return;
        }
        setCurrentStreak(0);
        advance();
        return;
      }
    }
  }, [advance, endRun, mode, skipDisabled, strikes]);

  // Keyboard skip shortcut: Ctrl+Enter.
  // Deliberate combo to avoid accidental presses while typing.
  useEffect(() => {
    if (status !== "playing") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (!event.ctrlKey) return;
      if (event.key !== "Enter") return;
      event.preventDefault();
      handleSkip();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSkip, status]);

  const summary = useMemo<SpeedRunSummary>(
    () => ({
      mode,
      correctCount,
      wrongCount,
      longestStreak,
      elapsedMs: finalElapsedMs,
      skipsUsed,
      target: mode === "race" ? RACE_TARGET : null,
    }),
    [correctCount, finalElapsedMs, longestStreak, mode, skipsUsed, wrongCount],
  );

  // Race mode is only leaderboard-eligible if the player actually finished.
  const eligible = mode === "race" ? correctCount >= RACE_TARGET : true;

  if (status === "gameover") {
    return (
      <main className="min-h-screen bg-[#f7f4e7] p-6 md:p-8">
        <div className="mx-auto max-w-4xl space-y-5">
          <header className="flex items-center justify-between gap-3 flex-wrap">
            <h1 className="font-press text-xl md:text-2xl">{MODE_TITLE[mode]}</h1>
          </header>
          <SpeedGameOver
            summary={summary}
            eligible={eligible}
            newBest={newBest}
            onPlayAgain={() => router.push(`/speed/${mode}?run=${Date.now()}`)}
            onChangeMode={() => router.push("/speed")}
            onMainMenu={() => router.push("/")}
          />
        </div>
      </main>
    );
  }

  // Display-time elapsed for the HUD (with timed penalty baked in).
  const displayElapsed = stopwatch.elapsedMs + (mode === "timed" ? timedPenaltyMs : 0);

  const flashTint =
    flash === "correct"
      ? "bg-[#9bbc0f]"
      : flash === "wrong"
        ? "bg-[#c03028] animate-[shake_0.4s]"
        : flash === "skip"
          ? "bg-[#e0c068]"
          : "bg-white";

  return (
    <main className="min-h-screen bg-[#f7f4e7] p-6 md:p-8">
      <div className="mx-auto max-w-4xl space-y-5">
        <header className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="font-press text-xl md:text-2xl">{MODE_TITLE[mode]}</h1>
          <div className="flex gap-2">
            {canPause && (
              <PixelButton
                variant="secondary"
                onClick={() => stopwatch.pause()}
                disabled={!stopwatch.running}
              >
                Pause
              </PixelButton>
            )}
            <PixelButton
              variant="danger"
              onClick={() => {
                if (confirm("End this run?")) endRun();
              }}
            >
              End Run
            </PixelButton>
          </div>
        </header>

        <SpeedModeHud
          mode={mode}
          elapsedMs={displayElapsed}
          correctCount={correctCount}
          skipsUsed={skipsUsed}
          strikes={strikes}
          currentStreak={currentStreak}
        />

        <section
          className={`border-4 border-black p-7 flex flex-col items-center gap-5 transition-colors duration-150 ${flashTint}`}
        >
          <h2 className="font-press text-base">Find this dual type</h2>
          {combo && (
            <div className="flex flex-wrap items-center justify-center gap-4">
              <TypeBadge type={combo[0]} large />
              <TypeBadge type={combo[1]} large />
            </div>
          )}
          <ConstraintBadge constraint={clientConstraint} />
        </section>

        <section className="flex flex-col items-center gap-3">
          {combo && (
            <PokemonSearchDropdown
              key={`${combo[0]}-${combo[1]}-${correctCount}-${wrongCount}-${skipsUsed}`}
              allPokemon={ALL_POKEMON}
              combo={combo}
              onSubmit={handleSubmit}
              disabled={inputLocked || stopwatch.paused}
            />
          )}
          <div className="flex items-center gap-3">
            <PixelButton
              onClick={handleSkip}
              disabled={skipDisabled}
              variant="secondary"
              className="text-lg py-3 px-6"
              title={skipHint}
            >
              Skip ({skipHint}) · Ctrl+Enter
            </PixelButton>
          </div>
        </section>

        {canPause && stopwatch.paused && (
          <div
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/60"
            onClick={() => stopwatch.resume()}
          >
            <SpeechBox className="w-full max-w-md mx-4">
              <p className="font-press text-base mb-2">Paused</p>
              <p className="font-pixel text-2xl">Click anywhere to resume.</p>
              <p className="font-pixel text-lg text-black/60 mt-2">
                Elapsed: {formatStopwatch(stopwatch.elapsedMs)}
              </p>
            </SpeechBox>
          </div>
        )}
      </div>
    </main>
  );
}
