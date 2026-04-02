import { useEffect, useRef, useState } from 'react';

/** Lock betting this many ms before we expect the next ball (15s). */
export const LOCK_BEFORE_NEXT_BALL_MS = 15_000;

/** Default gap if we have no samples yet. */
export const DEFAULT_EXPECTED_GAP_MS = 30_000;

const MIN_SAMPLE_GAP_MS = 5_000;
const MAX_SAMPLE_GAP_MS = 180_000;

/** Floor so there is always a short open window after each ball. */
const MIN_EFFECTIVE_GAP_MS = 20_000;

const MAX_SAMPLES = 10;

function mean(nums: number[]): number {
  if (!nums.length) return DEFAULT_EXPECTED_GAP_MS;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function effectiveGapMs(
  intervals: number[],
  serverAvgMs: number | null | undefined,
): number {
  if (intervals.length > 0) {
    return Math.max(mean(intervals), MIN_EFFECTIVE_GAP_MS);
  }
  const base = serverAvgMs ?? DEFAULT_EXPECTED_GAP_MS;
  return Math.max(base, MIN_EFFECTIVE_GAP_MS);
}

/**
 * Betting window: learns gaps from live co/cb changes, and uses server-computed
 * `avgBallIntervalMs` (from Ball.createdAt in DB) + `lastBallRecordedAt` when available.
 */
export function useBallBettingWindow(
  currentOver: number,
  currentBall: number,
  enabled: boolean,
  matchId: string,
  /** Mean ms between balls from backend (last ~24 deliveries). */
  serverAvgBallIntervalMs?: number | null,
  /** ISO time of latest Ball row — syncs schedule to server. */
  lastBallRecordedAt?: string | null,
) {
  const intervalsRef = useRef<number[]>([]);
  const lastBallTsRef = useRef<number>(Date.now());
  const lastPhaseRef = useRef<{ o: number; b: number } | null>(null);
  const lockAtRef = useRef<number>(Date.now() + DEFAULT_EXPECTED_GAP_MS - LOCK_BEFORE_NEXT_BALL_MS);

  const [, setTick] = useState(0);

  useEffect(() => {
    intervalsRef.current = [];
    lastPhaseRef.current = null;
    lastBallTsRef.current = Date.now();
    lockAtRef.current = Date.now() + DEFAULT_EXPECTED_GAP_MS - LOCK_BEFORE_NEXT_BALL_MS;
  }, [matchId]);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  /** Re-anchor from server timestamps / DB average (poll + socket). */
  useEffect(() => {
    if (!enabled) return;
    const gap = effectiveGapMs(intervalsRef.current, serverAvgBallIntervalMs);
    if (lastBallRecordedAt) {
      lastBallTsRef.current = new Date(lastBallRecordedAt).getTime();
    }
    lockAtRef.current = lastBallTsRef.current + gap - LOCK_BEFORE_NEXT_BALL_MS;
  }, [lastBallRecordedAt, serverAvgBallIntervalMs, enabled]);

  useEffect(() => {
    if (!enabled) return;

    const prev = lastPhaseRef.current;
    if (prev !== null && prev.o === currentOver && prev.b === currentBall) {
      return;
    }

    const now = Date.now();

    if (prev === null) {
      lastBallTsRef.current = lastBallRecordedAt
        ? new Date(lastBallRecordedAt).getTime()
        : now;
      const gap = effectiveGapMs(intervalsRef.current, serverAvgBallIntervalMs);
      lockAtRef.current = lastBallTsRef.current + gap - LOCK_BEFORE_NEXT_BALL_MS;
      lastPhaseRef.current = { o: currentOver, b: currentBall };
      return;
    }

    if (lastBallTsRef.current > 0) {
      const rawGap = now - lastBallTsRef.current;
      if (rawGap >= MIN_SAMPLE_GAP_MS && rawGap <= MAX_SAMPLE_GAP_MS) {
        intervalsRef.current.push(rawGap);
        while (intervalsRef.current.length > MAX_SAMPLES) {
          intervalsRef.current.shift();
        }
      }
    }

    lastBallTsRef.current = now;
    const gap = effectiveGapMs(intervalsRef.current, serverAvgBallIntervalMs);
    lockAtRef.current = now + gap - LOCK_BEFORE_NEXT_BALL_MS;
    lastPhaseRef.current = { o: currentOver, b: currentBall };
  }, [currentOver, currentBall, enabled, lastBallRecordedAt, serverAvgBallIntervalMs]);

  useEffect(() => {
    if (!enabled) {
      lastPhaseRef.current = null;
    }
  }, [enabled]);

  const now = Date.now();
  const lockAt = lockAtRef.current;
  const bettingOpen = enabled ? now < lockAt : false;

  const gapMs = effectiveGapMs(intervalsRef.current, serverAvgBallIntervalMs);
  const secondsToExpectedNextBall = Math.max(
    0,
    Math.floor((lastBallTsRef.current + gapMs - now) / 1000),
  );
  const secondsUntilLock = Math.max(0, Math.floor((lockAt - now) / 1000));

  const avgSource: 'live' | 'database' | 'default' =
    intervalsRef.current.length > 0
      ? 'live'
      : serverAvgBallIntervalMs != null && serverAvgBallIntervalMs > 0
        ? 'database'
        : 'default';

  return {
    bettingOpen,
    lockedWaitingForBall: enabled && !bettingOpen,
    avgSecondsBetweenBalls: Math.round(gapMs / 1000),
    avgSource,
    sampleCount: intervalsRef.current.length,
    secondsUntilLock: bettingOpen ? secondsUntilLock : 0,
    nextBallInSeconds: secondsToExpectedNextBall,
  };
}
