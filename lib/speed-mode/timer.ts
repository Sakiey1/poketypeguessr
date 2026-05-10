"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// performance.now()-based stopwatch for speed runs.
//
// Why not setInterval(+= 1000): drift, missed ticks during tab throttling,
// and lying-to-the-server latency all compound over a 60-second timed run.
// Instead we accumulate true wall-clock deltas via performance.now() and
// only repaint at ~10Hz with rAF — fast enough to look smooth, cheap enough
// to ignore. visibilitychange pauses the wall clock so a backgrounded tab
// can't bank silent seconds.
//
// Internal mutation lives in refs (rAF handle, accumulators, perf.now()
// snapshots) — never read during render. Anything the caller needs to
// observe (elapsedMs, running, paused) is stored in useState so React
// re-renders correctly when it changes.

const PAINT_INTERVAL_MS = 100;

export type Stopwatch = {
  elapsedMs: number;
  running: boolean;
  paused: boolean;
  start: () => void;
  pause: (reason?: "manual" | "blur") => void;
  resume: () => void;
  stop: () => number;
  reset: () => void;
};

export type StopwatchOptions = {
  // When set, the rAF loop fires `onLimit` exactly once when total elapsed
  // (including any externally-tracked penalty) crosses this threshold. The
  // stopwatch keeps running so the caller can read the final elapsed.
  // Returning a fresh `extraMs` each frame lets callers fold a skip-penalty
  // counter into the limit check without lifting it into stopwatch state.
  limitMs?: number;
  getExtraMs?: () => number;
  onLimit?: () => void;
};

export const useStopwatch = (options: StopwatchOptions = {}): Stopwatch => {
  const [elapsedMs, setElapsedMs] = useState(0);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);

  // Internal mutable state — never read during render.
  const accumulatedRef = useRef(0);
  const startedAtRef = useRef<number | null>(null);
  const pauseSourceRef = useRef<"manual" | "blur" | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastPaintRef = useRef(0);
  const limitFiredRef = useRef(false);

  // Capture options in a ref so the rAF loop reads the latest callbacks
  // without re-creating itself every render. Mirroring happens inside an
  // effect to satisfy react-hooks/refs (refs aren't write-during-render).
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const cancelRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const computeElapsed = useCallback(() => {
    return (
      accumulatedRef.current +
      (startedAtRef.current !== null
        ? performance.now() - startedAtRef.current
        : 0)
    );
  }, []);

  const scheduleRaf = useCallback(() => {
    if (rafRef.current !== null) return;
    const loop = () => {
      rafRef.current = null;
      const now = performance.now();
      if (now - lastPaintRef.current >= PAINT_INTERVAL_MS) {
        lastPaintRef.current = now;
        setElapsedMs(computeElapsed());
      }
      // Limit check happens here (rAF callback context), so it's not a
      // setState-from-effect violation; React treats this like an event.
      const opts = optionsRef.current;
      if (
        opts.limitMs !== undefined &&
        opts.onLimit &&
        !limitFiredRef.current
      ) {
        const extra = opts.getExtraMs ? opts.getExtraMs() : 0;
        if (computeElapsed() + extra >= opts.limitMs) {
          limitFiredRef.current = true;
          opts.onLimit();
        }
      }
      if (startedAtRef.current !== null) {
        rafRef.current = requestAnimationFrame(loop);
      }
    };
    rafRef.current = requestAnimationFrame(loop);
  }, [computeElapsed]);

  const start = useCallback(() => {
    accumulatedRef.current = 0;
    startedAtRef.current = performance.now();
    pauseSourceRef.current = null;
    lastPaintRef.current = 0;
    limitFiredRef.current = false;
    setElapsedMs(0);
    setRunning(true);
    setPaused(false);
    scheduleRaf();
  }, [scheduleRaf]);

  const pause = useCallback(
    (reason: "manual" | "blur" = "manual") => {
      if (startedAtRef.current === null) return;
      accumulatedRef.current += performance.now() - startedAtRef.current;
      startedAtRef.current = null;
      pauseSourceRef.current = reason;
      cancelRaf();
      setElapsedMs(accumulatedRef.current);
      setRunning(false);
      setPaused(true);
    },
    [cancelRaf],
  );

  const resume = useCallback(() => {
    if (startedAtRef.current !== null) return;
    startedAtRef.current = performance.now();
    pauseSourceRef.current = null;
    setRunning(true);
    setPaused(false);
    scheduleRaf();
  }, [scheduleRaf]);

  const stop = useCallback((): number => {
    if (startedAtRef.current !== null) {
      accumulatedRef.current += performance.now() - startedAtRef.current;
      startedAtRef.current = null;
    }
    cancelRaf();
    setElapsedMs(accumulatedRef.current);
    setRunning(false);
    setPaused(false);
    return accumulatedRef.current;
  }, [cancelRaf]);

  const reset = useCallback(() => {
    cancelRaf();
    accumulatedRef.current = 0;
    startedAtRef.current = null;
    pauseSourceRef.current = null;
    limitFiredRef.current = false;
    setElapsedMs(0);
    setRunning(false);
    setPaused(false);
  }, [cancelRaf]);

  // Tab visibility: pause on hide, but only auto-resume if we paused for
  // that reason (so a manual pause stays manual).
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (startedAtRef.current !== null) {
          pause("blur");
        }
      } else if (
        startedAtRef.current === null &&
        pauseSourceRef.current === "blur"
      ) {
        resume();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [pause, resume]);

  useEffect(() => () => cancelRaf(), [cancelRaf]);

  return { elapsedMs, running, paused, start, pause, resume, stop, reset };
};

export const formatStopwatch = (ms: number): string => {
  const totalTenths = Math.max(0, Math.floor(ms / 100));
  const totalSeconds = Math.floor(totalTenths / 10);
  const tenths = totalTenths % 10;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(1, "0")}:${String(seconds).padStart(2, "0")}.${tenths}`;
};

export const formatCountdown = (ms: number): string => {
  const totalTenths = Math.max(0, Math.ceil(ms / 100));
  const totalSeconds = Math.floor(totalTenths / 10);
  const tenths = totalTenths % 10;
  return `${String(totalSeconds).padStart(2, "0")}.${tenths}`;
};
