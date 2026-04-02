import { useEffect, useState } from 'react';

/** Full countdown length until the next ball window resets. */
export const BETTING_CYCLE_SECONDS = 30;

/** Betting is closed when seconds remaining in the cycle are at or below this value. */
export const BETTING_LOCK_BEFORE_BALL_SECONDS = 10;

/**
 * Local betting window: open while countdown > BETTING_LOCK_BEFORE_BALL_SECONDS.
 * Resets when matchPhaseKey changes (e.g. new over/ball from live feed).
 */
export function useBettingCountdown(matchPhaseKey: string) {
  const [secondsLeft, setSecondsLeft] = useState(BETTING_CYCLE_SECONDS);

  useEffect(() => {
    setSecondsLeft(BETTING_CYCLE_SECONDS);
  }, [matchPhaseKey]);

  useEffect(() => {
    const id = setInterval(() => {
      setSecondsLeft((s) => (s <= 1 ? BETTING_CYCLE_SECONDS : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const bettingOpen = secondsLeft > BETTING_LOCK_BEFORE_BALL_SECONDS;

  return {
    /** True while user may place bets (more than 10s before end of cycle). */
    bettingOpen,
    /** Seconds until this cycle ends / next ball (1..30). */
    nextBallInSeconds: secondsLeft,
    /** Seconds left in the open betting window (0 when locked). */
    secondsUntilLock: Math.max(0, secondsLeft - BETTING_LOCK_BEFORE_BALL_SECONDS),
  };
}
