import { useEffect, useState } from 'react';

/** Time to place over-stats bets before the simulated next over starts */
export const OVER_BETTING_WINDOW_SECONDS = 28;

/** Simulated over in progress — betting stays closed until this ends */
export const OVER_IN_PROGRESS_SECONDS = 62;

export type OverPhase = 'betting' | 'over';

type State = { phase: OverPhase; s: number };

/**
 * Two-phase cycle: open betting before "next over", then lock for the full simulated over,
 * then repeat. Resets when `overKey` changes (e.g. live match moves to a new over).
 */
export function useOverBettingCountdown(overKey: string) {
  const [state, setState] = useState<State>({
    phase: 'betting',
    s: OVER_BETTING_WINDOW_SECONDS,
  });

  useEffect(() => {
    setState({ phase: 'betting', s: OVER_BETTING_WINDOW_SECONDS });
  }, [overKey]);

  useEffect(() => {
    const id = setInterval(() => {
      setState((prev) => {
        if (prev.s <= 1) {
          if (prev.phase === 'betting') {
            return { phase: 'over', s: OVER_IN_PROGRESS_SECONDS };
          }
          return { phase: 'betting', s: OVER_BETTING_WINDOW_SECONDS };
        }
        return { ...prev, s: prev.s - 1 };
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const bettingOpen = state.phase === 'betting';

  return {
    bettingOpen,
    phase: state.phase,
    /** Seconds left in the current phase */
    secondsLeft: state.s,
  };
}
