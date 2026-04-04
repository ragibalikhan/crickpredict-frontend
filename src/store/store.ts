import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const isNewerMatch = (current: MatchState | null, incoming: any) => {
  if (!current) return true;

  // Innings advanced (e.g. chase started) — always accept so UI/scores are not stuck on 1st innings
  const incInn = Number(incoming.currentInnings);
  const curInn = Number(current.currentInnings);
  if (Number.isFinite(incInn) && Number.isFinite(curInn) && incInn > curInn) return true;

  // 1. Check updatedAt
  if (incoming.updatedAt && current.updatedAt) {
    const nextTime = new Date(incoming.updatedAt).getTime();
    const currTime = new Date(current.updatedAt).getTime();
    if (nextTime > currTime) return true;
    if (nextTime < currTime) return false;
    // if equal, proceed to progression check
  }

  // 2. Progression check (better for sports)
  // currentInnings * 1000 + currentOver * 6 + currentBall
  const nextProgress = (incoming.currentInnings || 1) * 1000 + (incoming.currentOver || 0) * 6 + (incoming.currentBall || 0);
  const currProgress = (current.currentInnings || 1) * 1000 + (current.currentOver || 0) * 6 + (current.currentBall || 0);
  
  return nextProgress >= currProgress; 
};


export interface User {
  id: string;
  username: string;
  coinsBalance: number;
  /** Bonus / secondary balance (admin-adjustable). */
  creditsBalance?: number;
  rank: number;
  role: 'user' | 'admin';
  currentStreak?: number;
  highestStreak?: number;
  totalWins?: number;
  totalLosses?: number;
  // Referral & Bonus fields
  referralCode?: string;
  referredBy?: string | null;
  signupBonusStatus?: 'none' | 'locked' | 'unlocked' | 'wagering' | 'withdrawable' | 'expired';
  signupBonusAmount?: number;
}

export interface BallSlot {
  ballNumber: number;
  /** 0 = legal; 1+ = extras (wide/no-ball) on same ball slot */
  subBallNumber?: number;
  outcome: string;
  runs?: number;
  isWicket?: boolean;
  createdAt?: string;
}

export interface MatchState {
  _id: string;
  teamA: string;
  teamB: string;
  status: string;
  scoreA: number;
  scoreB: number;
  wicketsA: number;
  wicketsB: number;
  currentOver: number;
  currentBall: number;
  predictionsLocked: boolean;
  ballsThisOver?: BallSlot[];
  /** From DB: mean ms between recorded balls (last ~24 deliveries). */
  avgBallIntervalMs?: number | null;
  /** ISO time of latest Ball row — anchors betting window to server clock. */
  lastBallRecordedAt?: string | null;
  scheduledStartAt?: string | null;
  completedAt?: string | null;
  /** ISO timestamp from the server for synchronization. */
  updatedAt?: string;
  currentInnings?: number;
}

export interface BetSettlementResult {
  won: boolean;
  stake: number;
  payout: number;
  predictionId: string;
  predictionType?: string;
}

interface AppState {
  user: User | null;
  token: string | null;
  liveMatch: MatchState | null;
  notifications: any[];
  betSettlementResult: BetSettlementResult | null;
  setUser: (user: User, token: string) => void;
  logout: () => void;
  setLiveMatch: (match: any) => void;
  updateCoins: (newBalance: number) => void;
  updateCredits: (newBalance: number) => void;
  setPredictionsLocked: (locked: boolean) => void;
  updateBall: (matchData: any) => void;
  addNotification: (notif: any) => void;
  markAllRead: () => void;
  setBetSettlementResult: (r: BetSettlementResult | null) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      liveMatch: null,
      notifications: [],
      betSettlementResult: null,
      setUser: (user, token) => set({ user, token }),
      logout: () =>
        set({
          user: null,
          token: null,
          liveMatch: null,
          notifications: [],
          betSettlementResult: null,
        }),
      setLiveMatch: (match) => 
        set((state) => {
          if (!state.liveMatch || isNewerMatch(state.liveMatch, match)) {
            return { liveMatch: { ...match, predictionsLocked: false } };
          }
          return state;
        }),
      updateCoins: (newBalance) => set((state) => ({ user: state.user ? { ...state.user, coinsBalance: newBalance } : null })),
      updateCredits: (newBalance) => set((state) => ({ user: state.user ? { ...state.user, creditsBalance: newBalance } : null })),
      setPredictionsLocked: (locked) => set((state) => ({ liveMatch: state.liveMatch ? { ...state.liveMatch, predictionsLocked: locked } : null })),
      updateBall: (matchData) => 
        set((state) => {
          if (!state.liveMatch || isNewerMatch(state.liveMatch, matchData)) {
            return { liveMatch: { ...matchData, predictionsLocked: false } };
          }
          return state;
        }),
      addNotification: (notif) => set((state) => ({ notifications: [notif, ...state.notifications].slice(0, 50) })),
      markAllRead: () => set((state) => ({ notifications: state.notifications.map(n => ({ ...n, read: true })) })),
      setBetSettlementResult: (r) => set({ betSettlementResult: r }),
    }),
    {
      name: 'crickpredict-storage',
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
);
