import { useEffect, useRef, useState } from 'react';

/** After the feed advances to a new ball, users have this many seconds to bet. */
export const BALL_BET_WINDOW_SECONDS = 15;

const BALL_BET_WINDOW_MS = BALL_BET_WINDOW_SECONDS * 1000;

/**
 * Ball betting: when the live feed **advances** over/ball vs what we last saw,
 * open a fixed window. Initial page load / refresh only records the current phase
 * (no free 15s — avoids resetting the window on every reload).
 */
export function useBallBettingWindow(
  currentInnings: number,
  currentOver: number,
  currentBall: number,
  enabled: boolean,
  matchId: string,
) {
  const lastProgressRef = useRef<number>(-1);
  const betOpenUntilRef = useRef<number>(0);
  const [, setTick] = useState(0);

  useEffect(() => {
    lastProgressRef.current = -1;
    betOpenUntilRef.current = 0;
  }, [matchId]);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // Numerical progression value to ensure we only trigger on actual "forward" movement.
    const currentProgress = (currentInnings * 1000) + (currentOver * 6) + currentBall;
    const prevProgress = lastProgressRef.current;

    if (prevProgress !== -1 && currentProgress <= prevProgress) {
      // If we haven't moved forward, don't reset the timer.
      return;
    }

    if (prevProgress === -1) {
      // First baseline: don't open the 15s window on mount/initial load.
      lastProgressRef.current = currentProgress;
      return;
    }

    // New ball detected! Start the 15s window.
    const now = Date.now();
    betOpenUntilRef.current = now + BALL_BET_WINDOW_MS;
    lastProgressRef.current = currentProgress;
  }, [currentInnings, currentOver, currentBall, enabled]);

  useEffect(() => {
    if (!enabled) {
      lastProgressRef.current = -1;
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
