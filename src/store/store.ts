import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
}

export interface BallBetResultModal {
  won: boolean;
  stake: number;
  payout: number;
  predictionId: string;
}

interface AppState {
  user: User | null;
  token: string | null;
  liveMatch: MatchState | null;
  notifications: any[];
  ballBetResult: BallBetResultModal | null;
  setUser: (user: User, token: string) => void;
  logout: () => void;
  setLiveMatch: (match: any) => void;
  updateCoins: (newBalance: number) => void;
  updateCredits: (newBalance: number) => void;
  setPredictionsLocked: (locked: boolean) => void;
  updateBall: (matchData: any) => void;
  addNotification: (notif: any) => void;
  markAllRead: () => void;
  setBallBetResult: (r: BallBetResultModal | null) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      liveMatch: null,
      notifications: [],
      ballBetResult: null,
      setUser: (user, token) => set({ user, token }),
      logout: () =>
        set({
          user: null,
          token: null,
          liveMatch: null,
          notifications: [],
          ballBetResult: null,
        }),
      setLiveMatch: (match) => set({ liveMatch: { ...match, predictionsLocked: false } }),
      updateCoins: (newBalance) => set((state) => ({ user: state.user ? { ...state.user, coinsBalance: newBalance } : null })),
      updateCredits: (newBalance) => set((state) => ({ user: state.user ? { ...state.user, creditsBalance: newBalance } : null })),
      setPredictionsLocked: (locked) => set((state) => ({ liveMatch: state.liveMatch ? { ...state.liveMatch, predictionsLocked: locked } : null })),
      updateBall: (matchData) => set((state) => ({ liveMatch: { ...matchData, predictionsLocked: false } })),
      addNotification: (notif) => set((state) => ({ notifications: [notif, ...state.notifications].slice(0, 50) })),
      markAllRead: () => set((state) => ({ notifications: state.notifications.map(n => ({ ...n, read: true })) })),
      setBallBetResult: (r) => set({ ballBetResult: r }),
    }),
    {
      name: 'crickpredict-storage',
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
);
