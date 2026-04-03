import { useEffect, useRef, useState } from 'react';

/** After the feed advances to a new ball, users have this many seconds to bet. */
export const BALL_BET_WINDOW_SECONDS = 15;

const BALL_BET_WINDOW_MS = BALL_BET_WINDOW_SECONDS * 1000;

/**
 * Ball betting: when the live feed updates current over/ball (delivery in progress),
 * open betting for a fixed window, then close until the next feed update.
 */
export function useBallBettingWindow(
  currentOver: number,
  currentBall: number,
  enabled: boolean,
  matchId: string,
) {
  const lastPhaseRef = useRef<{ o: number; b: number } | null>(null);
  const betOpenUntilRef = useRef<number>(0);
  const [, setTick] = useState(0);

  useEffect(() => {
    lastPhaseRef.current = null;
    betOpenUntilRef.current = 0;
  }, [matchId]);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const prev = lastPhaseRef.current;
    if (prev !== null && prev.o === currentOver && prev.b === currentBall) {
      return;
    }

    const now = Date.now();
    betOpenUntilRef.current = now + BALL_BET_WINDOW_MS;
    lastPhaseRef.current = { o: currentOver, b: currentBall };
  }, [currentOver, currentBall, enabled]);

  useEffect(() => {
    if (!enabled) {
      lastPhaseRef.current = null;
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
