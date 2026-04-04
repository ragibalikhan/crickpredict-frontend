import { useEffect, useRef, useState } from 'react';

/** After the feed advances to a new ball, users have this many seconds to bet. */
export const BALL_BET_WINDOW_SECONDS = 15;

const BALL_BET_WINDOW_MS = BALL_BET_WINDOW_SECONDS * 1000;

/**
 * Ball betting: open a fixed window when either:
 * - The live **overs counter** moves forward (legal delivery completed), or
 * - The server records **any new delivery row** (`lastBallRecordedAt` changes), including
 *   wides/no-balls where the API often does **not** advance over/ball.
 *
 * Initial load only baselines (no free 15s on refresh).
 */
export function useBallBettingWindow(
  currentInnings: number,
  currentOver: number,
  currentBall: number,
  /** ISO time of last Ball row — updates on extras even when over/ball is unchanged */
  lastBallRecordedAt: string | null | undefined,
  enabled: boolean,
  matchId: string,
) {
  const lastProgressRef = useRef<number>(-1);
  const lastRecordedAtRef = useRef<string | null>(null);
  const betOpenUntilRef = useRef<number>(0);
  const [, setTick] = useState(0);

  useEffect(() => {
    lastProgressRef.current = -1;
    lastRecordedAtRef.current = null;
    betOpenUntilRef.current = 0;
  }, [matchId]);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const currentProgress = (currentInnings * 1000) + (currentOver * 6) + currentBall;
    const prevProgress = lastProgressRef.current;
    const prevRecordedAt = lastRecordedAtRef.current;

    if (prevProgress === -1) {
      lastProgressRef.current = currentProgress;
      lastRecordedAtRef.current = lastBallRecordedAt ?? null;
      return;
    }

    let shouldOpen = false;

    if (currentProgress > prevProgress) {
      shouldOpen = true;
      lastProgressRef.current = currentProgress;
    } else if (currentProgress < prevProgress) {
      lastProgressRef.current = currentProgress;
    }

    const recordedNewer =
      lastBallRecordedAt &&
      prevRecordedAt &&
      lastBallRecordedAt !== prevRecordedAt &&
      new Date(lastBallRecordedAt).getTime() > new Date(prevRecordedAt).getTime();

    if (recordedNewer && !shouldOpen) {
      shouldOpen = true;
    }

    if (lastBallRecordedAt) {
      lastRecordedAtRef.current = lastBallRecordedAt;
    }

    if (shouldOpen) {
      betOpenUntilRef.current = Date.now() + BALL_BET_WINDOW_MS;
    }
  }, [currentInnings, currentOver, currentBall, lastBallRecordedAt, enabled]);

  useEffect(() => {
    if (!enabled) {
      lastProgressRef.current = -1;
      lastRecordedAtRef.current = null;
    }
  }, [enabled]);

  const now = Date.now();
  const bettingOpen = enabled && now < betOpenUntilRef.current;
  const lockedWaitingForBall = enabled && !bettingOpen;

  const secondsLeftInWindow = Math.max(
    0,
    Math.floor((betOpenUntilRef.current - now) / 1000),
  );

  return {
    bettingOpen,
    lockedWaitingForBall,
    secondsLeftInWindow,
  };
}
