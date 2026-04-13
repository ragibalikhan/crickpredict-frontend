'use client';
import { useEffect, useMemo, useState } from 'react';
import { useSocket, type MatchBetActivity } from '../../../hooks/useSocket';
import { useBallBettingWindow } from '../../../hooks/useBallBettingWindow';
import { useStore, type BallSlot } from '../../../store/store';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { API_BASE } from '../../../lib/api';
import { formatInr } from '../../../lib/moneyDisplay';
import TeamAvatar from '../../../components/TeamAvatar';
import MatchOutcomeBetting from '../../../components/MatchOutcomeBetting';
import { clampStakeAmount, MAX_STAKE_COINS, MIN_STAKE_COINS } from '../../../lib/betLimits';

/** Poll interval for score + match state (HTTP); socket still pushes faster when connected. */
const MATCH_POLL_MS = 2000;

const DEFAULT_BALL_MULTIPLIERS: Record<string, number> = {
  Dot: 1.5,
  '1-2 Runs': 2.0,
  '4 Runs': 3.0,
  '6 Runs': 4.0,
  Wicket: 5.0,
  Extras: 2.0,
};

function formatMultiplierLabel(n: number | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const rounded = Math.round(n * 10) / 10;
  return `${Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)}×`;
}

type SchedulePayload = {
  nextMatch: {
    _id: string;
    teamA: string;
    teamB: string;
    scheduledStartAt?: string;
    status?: string;
  } | null;
  tomorrowMatches: Array<{
    _id: string;
    teamA: string;
    teamB: string;
    scheduledStartAt?: string;
  }>;
};

type PrematchOddsPayload = {
  betting?: {
    toss?: { open: boolean; multiplier: number };
    teamVsTeam?: {
      open: boolean;
      multiplierA: number;
      multiplierB: number;
    };
    matchWinner?: {
      open: boolean;
      multiplierA: number;
      multiplierB: number;
    };
  };
};

type PlayerPropHomeItem = {
  matchId: string;
  bettingOpen: boolean;
  market: {
    id: string;
    label: string;
    multiplier: number;
  };
};

export default function MatchPage() {
  const params = useParams();
  const matchId = params.id as string;
  const [betActivity, setBetActivity] = useState<MatchBetActivity | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [betPlacedPopup, setBetPlacedPopup] = useState<string | null>(null);
  const [matchLoad, setMatchLoad] = useState<'loading' | 'ok' | 'error'>('loading');
  const [scheduleInfo, setScheduleInfo] = useState<SchedulePayload | null>(null);
  useSocket(matchId, setBetActivity);
  const { liveMatch, user, token, setLiveMatch, updateCoins, addNotification } = useStore();
  /** Raw string so users can clear/replace digits; clamp only on blur / place bet (avoid 10→1010 bugs). */
  const [stakeInput, setStakeInput] = useState(String(MIN_STAKE_COINS));
  const [activeTab, setActiveTab] = useState<'ball' | 'prematch' | 'over'>('ball');
  const [prematchOdds, setPrematchOdds] = useState<PrematchOddsPayload | null>(null);
  const [prematchBusy, setPrematchBusy] = useState<string | null>(null);
  const [tossBetPlaced, setTossBetPlaced] = useState(false);
  const [riskMatchBetsToday, setRiskMatchBetsToday] = useState(0);
  const [playerPropItems, setPlayerPropItems] = useState<PlayerPropHomeItem[]>([]);
  const [gameMultipliers, setGameMultipliers] = useState<{
    ballMultipliers: Record<string, number>;
    nonBallMultiplierRange: { min: number; max: number };
  } | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/predictions/game-multipliers`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { ballMultipliers?: Record<string, number>; nonBallMultiplierRange?: { min: number; max: number } } | null) => {
        if (data?.ballMultipliers && typeof data.ballMultipliers === 'object') {
          setGameMultipliers({
            ballMultipliers: data.ballMultipliers,
            nonBallMultiplierRange: data.nonBallMultiplierRange ?? { min: 1.5, max: 5.0 },
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!matchId) return;
    let controller: AbortController | null = null;
    const load = () => {
      controller?.abort();
      controller = new AbortController();
      fetch(`${API_BASE}/matches/${matchId}`, { signal: controller.signal })
        .then((res) => {
          if (!res.ok) throw new Error('not_found');
          return res.json();
        })
        .then((data) => {
          if (!data) {
            setMatchLoad('error');
            return;
          }
          setLiveMatch(data);
          setMatchLoad('ok');
        })
        .catch((err) => {
          if (err?.name === 'AbortError') return;
          setMatchLoad('error');
        });
    };
    setMatchLoad('loading');
    load();
    const poll = setInterval(load, MATCH_POLL_MS);
    return () => {
      clearInterval(poll);
      controller?.abort();
    };
  }, [matchId, setLiveMatch]);

  useEffect(() => {
    if (!matchId) return;
    fetch(`${API_BASE}/predictions/match/${matchId}/activity`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: MatchBetActivity | null) => {
        if (data) setBetActivity(data);
      })
      .catch(() => {});
  }, [matchId]);

  useEffect(() => {
    if (!matchId) return;
    fetch(`${API_BASE}/predictions/match/${matchId}/outcome-odds`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: PrematchOddsPayload | null) => setPrematchOdds(data))
      .catch(() => setPrematchOdds(null));
  }, [matchId]);

  useEffect(() => {
    if (!matchId) return;
    fetch(`${API_BASE}/player-props/home`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { items?: PlayerPropHomeItem[] } | null) => {
        const all = Array.isArray(data?.items) ? data!.items : [];
        setPlayerPropItems(all.filter((row) => String(row.matchId) === String(matchId)).slice(0, 3));
      })
      .catch(() => setPlayerPropItems([]));
  }, [matchId]);

  useEffect(() => {
    if (!token || !matchId) {
      setTossBetPlaced(false);
      setRiskMatchBetsToday(0);
      return;
    }
    fetch(`${API_BASE}/predictions/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: Array<{ type?: string; matchId?: string; createdAt?: string }> | null) => {
        const placed = (rows ?? []).some(
          (row) => row?.type === 'toss' && String(row?.matchId) === String(matchId),
        );
        setTossBetPlaced(placed);
        const dayStart = new Date();
        dayStart.setHours(0, 0, 0, 0);
        const riskCount = (rows ?? []).filter((row) => {
          if (row?.type !== 'team_vs_team') return false;
          if (String(row?.matchId) !== String(matchId)) return false;
          const createdAt = row?.createdAt ? new Date(row.createdAt).getTime() : 0;
          return Number.isFinite(createdAt) && createdAt >= dayStart.getTime();
        }).length;
        setRiskMatchBetsToday(riskCount);
      })
      .catch(() => {
        setTossBetPlaced(false);
        setRiskMatchBetsToday(0);
      });
  }, [token, matchId]);

  useEffect(() => {
    fetch(`${API_BASE}/matches/schedule`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: SchedulePayload | null) => {
        if (data) setScheduleInfo(data);
      })
      .catch(() => setScheduleInfo(null));
  }, []);

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 4500);
    return () => clearTimeout(t);
  }, [toastMsg]);

  useEffect(() => {
    if (!betPlacedPopup) return;
    const t = setTimeout(() => setBetPlacedPopup(null), 5000);
    return () => clearTimeout(t);
  }, [betPlacedPopup]);

  useEffect(() => {
    setStakeInput(String(MIN_STAKE_COINS));
    setActiveTab('ball');
  }, [matchId]);

  const placePrediction = async (type: string, value: string) => {
    if (!token) return alert('Please log in to place a bet.');

    const stake = clampStakeAmount(Number(stakeInput) || 0);
    setStakeInput(String(stake));

    try {
      const res = await fetch(`${API_BASE}/predictions`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          matchId,
          type,
          predictionValue: value,
          amountStaked: stake
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && typeof data.coinsBalance === 'number') {
        updateCoins(data.coinsBalance);
        if (data.activity) setBetActivity(data.activity);
        const msg = `You placed your bet: ${formatInr(stake)} on "${value}"`;
        setToastMsg(msg);
        setBetPlacedPopup(msg);
        addNotification({
          _id: `bet-${Date.now()}`,
          title: 'Bet placed',
          message: msg,
          type: 'success',
          read: false,
          createdAt: new Date().toISOString(),
        });
      } else {
        alert(data?.message || 'Failed to place prediction. Check your balance (INR) or if predictions are locked.');
      }
    } catch {
      alert(
        'Could not reach the server. Check your connection and that the API is running, then try again.',
      );
    }
  };

  const placeOutcomeBet = async (kind: 'toss' | 'team_vs_team' | 'match_winner', side: 'A' | 'B') => {
    if (!token) return alert('Please log in to place a bet.');
    const stake = clampStakeAmount(Number(stakeInput) || 0);
    setStakeInput(String(stake));
    setPrematchBusy(`${kind}-${side}`);
    try {
      const res = await fetch(`${API_BASE}/predictions/outcome-bet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ matchId, kind, side, amountStaked: stake }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && typeof data.coinsBalance === 'number') {
        updateCoins(data.coinsBalance);
        if (kind === 'toss') setTossBetPlaced(true);
        const marketLabel =
          kind === 'toss'
            ? 'Toss'
            : kind === 'team_vs_team'
              ? 'Team vs Team'
              : 'Favourite team';
        const msg = `You placed your bet: ${formatInr(stake)} on ${marketLabel}`;
        setToastMsg(msg);
        setBetPlacedPopup(msg);
        if (kind === 'team_vs_team') {
          setRiskMatchBetsToday((n) => Math.min(3, n + 1));
        }
      } else {
        alert(data?.message || 'Failed to place pre-match bet.');
      }
    } catch {
      alert('Could not reach the server. Please try again.');
    } finally {
      setPrematchBusy(null);
    }
  };

  const placePlayerPropBet = async (marketId: string, label: string) => {
    if (!token) return alert('Please log in to place a bet.');
    const stake = clampStakeAmount(Number(stakeInput) || 0);
    setStakeInput(String(stake));
    setPrematchBusy(`prop-${marketId}`);
    try {
      const res = await fetch(`${API_BASE}/player-props/bet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ marketId, amountStaked: stake }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && typeof data.coinsBalance === 'number') {
        updateCoins(data.coinsBalance);
        const msg = `You placed your player prop bet: ${formatInr(stake)} on "${label}"`;
        setToastMsg(msg);
        setBetPlacedPopup(msg);
      } else {
        alert(data?.message || 'Failed to place player prop bet.');
      }
    } catch {
      alert('Could not reach the server. Please try again.');
    } finally {
      setPrematchBusy(null);
    }
  };

  const displayMatch = liveMatch;

  const ballsThisOver: BallSlot[] = displayMatch?.ballsThisOver || [];
  /** Chronological order: extras (wides) appear when they happened, not by server ball index */
  const deliveries = [...ballsThisOver].sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (ta !== tb) return ta - tb;
    if ((a.ballNumber ?? 0) !== (b.ballNumber ?? 0)) return (a.ballNumber ?? 0) - (b.ballNumber ?? 0);
    return (a.subBallNumber ?? 0) - (b.subBallNumber ?? 0);
  });
  const co = displayMatch?.currentOver ?? 0;
  /** Legal deliveries completed in this over per the live feed (0–6). Trust this over inferred DB rows. */
  const feedLegalBalls = Math.min(6, Math.max(0, displayMatch?.currentBall ?? 0));

  const visibleDeliveries = deliveries.filter((b) => {
    const bn = b.ballNumber ?? 0;
    if ((b.subBallNumber ?? 0) > 0) {
      return bn <= feedLegalBalls + 1;
    }
    return bn <= feedLegalBalls;
  });

  const legalCount = visibleDeliveries.filter((b) => (b.subBallNumber ?? 0) === 0).length;
  const placeholders = Array.from({ length: Math.max(0, 6 - feedLegalBalls) });

  const cb = displayMatch?.currentBall ?? 0;
  const nextBallInOver = cb < 6 ? cb + 1 : 1;

  const formatBallChip = (b: BallSlot) => {
    if (b.isWicket) return 'W';
    if (b.outcome === 'Wicket') return 'W';
    if (b.outcome === 'Dot' || (b.runs === 0 && !b.isWicket)) return '•';
    if (b.outcome === 'Extras') {
      // 1+ penalty runs (wide/no-ball/byes lumped as "extras" in feed) — show Wd+1, Wd+2, …
      if (b.runs != null && b.runs > 0) return `Wd+${b.runs}`;
      return 'Wd';
    }
    if (b.runs != null && b.runs > 0) return String(b.runs);
    return b.outcome?.replace(/\s*Runs?$/i, '').slice(0, 4) || '?';
  };

  const ballSlotClass = (b: BallSlot | undefined, filled: boolean) => {
    if (!filled) return 'border-dashed border-gray-600 bg-gray-900/40 text-gray-600';
    if (!b) return 'border-emerald-500/50 bg-emerald-950/40 text-emerald-200';
    if (b.isWicket || b.outcome === 'Wicket') {
      return 'border-red-500/70 bg-red-950/55 text-red-100 shadow-[0_0_20px_rgba(239,68,68,0.12)]';
    }
    if (b.outcome === 'Extras') {
      return 'border-orange-500/55 bg-orange-950/35 text-orange-200';
    }
    if (b.outcome === '4 Runs' || b.runs === 4) {
      return 'border-amber-500/70 bg-amber-950/45 text-amber-200';
    }
    if (b.outcome === '6 Runs' || b.runs === 6) {
      return 'border-violet-500/70 bg-violet-950/45 text-violet-200';
    }
    if (b.outcome === '1-2 Runs' || (b.runs != null && b.runs > 0 && b.runs <= 2)) {
      return 'border-sky-500/55 bg-sky-950/35 text-sky-100';
    }
    if (b.outcome === 'Dot' || (b.runs === 0 && !b.isWicket)) {
      return 'border-slate-500/55 bg-slate-900/60 text-slate-200';
    }
    return 'border-emerald-500/50 bg-emerald-950/40 text-emerald-200';
  };

  const ballBet = useBallBettingWindow(
    displayMatch?.currentInnings ?? 1,
    displayMatch?.currentOver ?? 0,
    displayMatch?.currentBall ?? 0,
    displayMatch?.lastBallRecordedAt,
    matchLoad === 'ok' && displayMatch?.status === 'live',
    matchId,
  );
  const ballMultiplierMap = useMemo(
    () => ({ ...DEFAULT_BALL_MULTIPLIERS, ...gameMultipliers?.ballMultipliers }),
    [gameMultipliers],
  );
  const isComingSoonTab = activeTab === 'over';
  const matchIsLive = displayMatch?.status === 'live';
  const showBettingCard =
    displayMatch?.status === 'upcoming' || displayMatch?.status === 'live';
  const canPlaceBet =
    activeTab === 'ball' &&
    ballBet.bettingOpen &&
    !displayMatch?.predictionsLocked &&
    matchIsLive;

  const placePredictionGuarded = async (type: string, value: string) => {
    if (!canPlaceBet) {
      if (displayMatch?.status === 'completed') {
        alert('This match has ended. Betting is closed.');
        return;
      }
      if (displayMatch?.status === 'upcoming') {
        alert('This match has not started yet.');
        return;
      }
      if (displayMatch?.predictionsLocked) {
        alert('Predictions are locked for this ball.');
        return;
      }
      if (isComingSoonTab) {
        alert('Over markets are coming soon.');
        return;
      }
      alert(
        'Betting is closed until the next delivery is recorded (legal ball or extra). You will get 15 seconds when that happens.',
      );
      return;
    }
    await placePrediction(type, value);
  };

  if (matchLoad === 'loading') {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-8">
        <div className="text-center">
          <div className="inline-block h-10 w-10 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent mb-4" />
          <p className="text-gray-400">Loading match from the server…</p>
        </div>
      </div>
    );
  }

  if (matchLoad === 'error' || !displayMatch) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-8">
        <div className="max-w-md rounded-3xl border border-red-500/30 bg-gray-800/80 p-8 text-center">
          <h1 className="text-xl font-bold text-white mb-2">Match not available</h1>
          <p className="text-gray-400 text-sm mb-4">
            We could not load this match. Check that the Nest API is running and the match id is valid.
          </p>
          <a href="/dashboard" className="text-indigo-400 font-semibold hover:underline">
            Back to dashboard
          </a>
        </div>
      </div>
    );
  }

  const feedBowled = displayMatch.currentBall ?? 0;
  /** Legal balls completed per feed — do not inflate with DB extras or over-inferred rows */
  const shownBowled = feedLegalBalls;

  return (
    <div className="min-h-screen bg-gray-900 text-white px-3 pt-4 pb-mobile-nav sm:p-4 md:p-8 font-sans touch-manipulation">
      <div className="max-w-4xl mx-auto w-full min-w-0">
        <header className="mb-6 sm:mb-8 bg-gray-800 p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl shadow-2xl border border-gray-700/50 relative overflow-hidden">
          <div className="absolute top-[-40px] right-[-40px] w-40 h-40 bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 pointer-events-none" />
          <div className="absolute bottom-[-40px] left-[-40px] w-40 h-40 bg-emerald-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 pointer-events-none" />

          <div className="relative z-10 flex flex-col gap-4 sm:gap-5">
            <div className="grid grid-cols-[1fr_auto_1fr] gap-x-2 sm:gap-x-4 md:gap-6 items-start">
              <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 min-w-0">
                <TeamAvatar teamName={displayMatch.teamA} size={56} className="ring-2 ring-white/10 shrink-0" />
                <div className="min-w-0 flex-1 text-center sm:text-left w-full">
                  <h1 className="text-[15px] leading-snug sm:text-2xl md:text-3xl font-black text-white capitalize text-balance sm:truncate">
                    {displayMatch.teamA}
                  </h1>
                </div>
              </div>

              <div className="flex flex-col items-center justify-start gap-1.5 px-0.5 pt-1 sm:pt-2 min-w-[2.75rem] sm:min-w-[3rem]">
                <span className="text-[10px] sm:text-xs font-black text-gray-500 uppercase tracking-[0.2em]">
                  vs
                </span>
                {displayMatch.status === 'live' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] sm:text-xs text-red-300 font-bold uppercase tracking-wide border border-red-500/25">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                    Live
                  </span>
                )}
                {displayMatch.status === 'completed' && (
                  <span className="text-[9px] sm:text-xs text-gray-400 uppercase tracking-wide text-center leading-tight">
                    Completed
                  </span>
                )}
                {displayMatch.status === 'upcoming' && (
                  <span className="text-[9px] sm:text-xs text-sky-300 uppercase tracking-wide text-center leading-tight">
                    Upcoming
                  </span>
                )}
                {displayMatch.completedAt && (
                  <span className="text-[9px] sm:text-[10px] text-gray-600 text-center max-w-[5.5rem] sm:max-w-none leading-tight">
                    {new Date(displayMatch.completedAt).toLocaleString()}
                  </span>
                )}
                {displayMatch.status === 'upcoming' && displayMatch.scheduledStartAt && (
                  <p className="text-[9px] sm:text-[10px] text-sky-300/90 text-center max-w-[6rem] sm:max-w-[10rem] leading-tight">
                    {new Date(displayMatch.scheduledStartAt).toLocaleString()}
                  </p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row-reverse items-center gap-2 sm:gap-4 min-w-0">
                <TeamAvatar teamName={displayMatch.teamB} size={56} className="ring-2 ring-white/10 shrink-0" />
                <div className="min-w-0 flex-1 text-center sm:text-right w-full">
                  <h1 className="text-[15px] leading-snug sm:text-2xl md:text-3xl font-black text-white capitalize text-balance sm:truncate sm:ml-auto">
                    {displayMatch.teamB}
                  </h1>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="flex items-center gap-3 rounded-2xl bg-gray-900/60 border border-gray-700/60 px-3 py-3 sm:p-4 min-w-0">
                <TeamAvatar teamName={displayMatch.teamA} size={48} />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider truncate">
                    {displayMatch.teamA}
                  </p>
                  <p className="text-2xl sm:text-4xl font-black tabular-nums text-white tracking-tight">
                    {displayMatch.scoreA}
                    <span className="text-gray-500 mx-0.5 sm:mx-1">/</span>
                    <span className="text-red-400">{displayMatch.wicketsA}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl bg-gray-900/60 border border-gray-700/60 px-3 py-3 sm:p-4 min-w-0 flex-row-reverse text-right">
                <TeamAvatar teamName={displayMatch.teamB} size={48} />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider truncate">
                    {displayMatch.teamB}
                  </p>
                  <p className="text-2xl sm:text-4xl font-black tabular-nums text-white tracking-tight">
                    {displayMatch.scoreB}
                    <span className="text-gray-500 mx-0.5 sm:mx-1">/</span>
                    <span className="text-red-400">{displayMatch.wicketsB}</span>
                  </p>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-center sm:text-left text-gray-500">
              {displayMatch.status === 'live'
                ? `Scores refresh every 2s · socket + poll${
                    (displayMatch.currentInnings ?? 1) >= 2 ? ' · 2nd innings (chase)' : ''
                  }`
                : 'Fixture synced from feed'}
            </p>
          </div>
        </header>

        {displayMatch.status === 'completed' && (
          <div className="mb-8 rounded-3xl border border-slate-600/60 bg-slate-900/40 p-6 md:p-8">
            <p className="text-2xl font-black text-white mb-2">Match closed</p>
            <p className="text-gray-400 text-sm mb-6">
              Betting is off for this fixture. Final scores are shown above.
            </p>
            {scheduleInfo?.nextMatch && String(scheduleInfo.nextMatch._id) !== String(displayMatch._id) && (
              <div className="rounded-2xl border border-indigo-500/30 bg-indigo-950/30 p-4 text-left">
                <p className="text-xs font-bold uppercase tracking-widest text-indigo-300 mb-2">Next scheduled</p>
                <Link
                  href={`/matches/${scheduleInfo.nextMatch._id}`}
                  className="inline-flex flex-wrap items-center gap-2 text-lg font-bold text-white hover:text-indigo-300"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <TeamAvatar teamName={scheduleInfo.nextMatch.teamA} size={28} />
                    <span className="capitalize">{scheduleInfo.nextMatch.teamA}</span>
                  </span>
                  <span className="text-gray-500 font-normal">vs</span>
                  <span className="inline-flex items-center gap-1.5">
                    <TeamAvatar teamName={scheduleInfo.nextMatch.teamB} size={28} />
                    <span className="capitalize">{scheduleInfo.nextMatch.teamB}</span>
                  </span>
                </Link>
                {scheduleInfo.nextMatch.scheduledStartAt && (
                  <p className="text-sm text-gray-400 mt-1">
                    {new Date(scheduleInfo.nextMatch.scheduledStartAt).toLocaleString()}
                  </p>
                )}
              </div>
            )}
            {scheduleInfo?.tomorrowMatches && scheduleInfo.tomorrowMatches.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Tomorrow</p>
                <ul className="space-y-2">
                  {scheduleInfo.tomorrowMatches.map((m) => (
                    <li key={m._id}>
                      <Link
                        href={`/matches/${m._id}`}
                        className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-indigo-400 hover:underline"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <TeamAvatar teamName={m.teamA} size={24} />
                          <span className="capitalize">{m.teamA}</span>
                        </span>
                        <span className="text-gray-500">vs</span>
                        <span className="inline-flex items-center gap-1.5">
                          <TeamAvatar teamName={m.teamB} size={24} />
                          <span className="capitalize">{m.teamB}</span>
                        </span>
                        {m.scheduledStartAt && (
                          <span className="text-gray-500 w-full sm:w-auto sm:ml-2">
                            {new Date(m.scheduledStartAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {displayMatch.status === 'upcoming' && (
          <div className="mb-8 rounded-3xl border border-sky-600/40 bg-sky-950/20 p-6">
            <p className="text-lg font-bold text-sky-200">Match not started yet</p>
            <p className="text-gray-400 text-sm mt-1">
              {displayMatch.scheduledStartAt
                ? `Scheduled: ${new Date(displayMatch.scheduledStartAt).toLocaleString()}`
                : 'Start time will appear when the feed provides it.'}
            </p>
          </div>
        )}

        {displayMatch.status === 'live' && (
        <section className="mb-8 rounded-3xl border border-gray-700/80 bg-gray-800/60 p-5 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-indigo-400/90 mb-1">
                Current over &amp; ball
              </p>
              <p className="text-2xl md:text-3xl font-black text-white">
                Over <span className="text-indigo-300">{co}</span>
                <span className="text-gray-500 mx-2">·</span>
                <span className="text-gray-300">
                  {shownBowled === 0
                    ? 'No balls bowled yet'
                    : `${shownBowled} ball${shownBowled === 1 ? '' : 's'} bowled`}
                </span>
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Next delivery: ball <span className="text-white font-mono font-bold">{nextBallInOver}</span> of 6 in
                this over
                {feedBowled > 0 && (
                  <span className="text-gray-600"> · Feed over reading {co}.{feedBowled}</span>
                )}
              </p>
              {legalCount < feedBowled && feedBowled > 0 && (
                <p className="text-xs text-amber-400/90 mt-1">
                  Catching up ball-by-ball log ({legalCount}/{feedBowled} legal deliveries recorded)…
                </p>
              )}
              <p className="text-xs text-gray-600 mt-2">
                Dots, runs, and wickets appear here as the live feed records each ball (socket + poll).
              </p>
              <p className="text-xs text-amber-200/80 mt-2 leading-snug max-w-xl">
                <span className="font-semibold text-amber-300/90">Extras:</span> wides, no-balls, and penalty runs
                add to the team score but are <span className="text-white/90">not</span> a legal delivery —{' '}
                <span className="font-mono">Wd+1</span> means one run added from an extra, not “one run off the bat.”
                {' '}<span className="text-gray-500">Ball 1–6 labels count only legal deliveries in order; extras sit in the timeline between them.</span>
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-2">
            This over — live result per ball (updates in real time)
          </p>
          <div className="flex flex-wrap gap-3 mb-3 text-[11px] text-gray-500">
            <span>
              <span className="inline-block w-3 h-3 rounded bg-orange-600 align-middle mr-1" /> Wd+ = extras (not a legal ball)
            </span>
            <span>
              <span className="inline-block w-3 h-3 rounded bg-slate-600 align-middle mr-1" /> Dot
            </span>
            <span>
              <span className="inline-block w-3 h-3 rounded bg-sky-600 align-middle mr-1" /> 1–2
            </span>
            <span>
              <span className="inline-block w-3 h-3 rounded bg-amber-600 align-middle mr-1" /> 4
            </span>
            <span>
              <span className="inline-block w-3 h-3 rounded bg-violet-600 align-middle mr-1" /> 6
            </span>
            <span>
              <span className="inline-block w-3 h-3 rounded bg-red-600 align-middle mr-1" /> W
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 md:gap-3">
            {/* 1. Render all recorded deliveries (legal + extras) chronologically */}
            {visibleDeliveries.map((b, idx) => {
              const isExtra = (b.subBallNumber ?? 0) > 0;
              /** 1..n = nth legal delivery this over (feed ball indices can skip after wides) */
              const legalSeq = isExtra
                ? null
                : visibleDeliveries.slice(0, idx + 1).filter((x) => (x.subBallNumber ?? 0) === 0).length;
              return (
              <div
                key={`${b.ballNumber}-${b.subBallNumber ?? 0}-${idx}`}
                className={`relative flex aspect-square w-full flex-col items-center justify-center rounded-2xl border-2 text-center transition duration-300 overflow-hidden ${ballSlotClass(b, true)}`}
              >
                <span
                  className="text-[9px] md:text-[10px] font-bold uppercase tracking-tighter text-white/40 mb-0.5"
                  title={
                    isExtra
                      ? 'Wide / no-ball / penalty — does not count as a legal ball in this over'
                      : undefined
                  }
                >
                  {isExtra ? 'Extra' : `Ball ${legalSeq}`}
                </span>
                <div className="flex flex-col items-center justify-center px-1 gap-0.5">
                  <span className={`${b.outcome === 'Extras' ? 'text-xs md:text-sm font-bold opacity-90 px-1.5 py-0.5 rounded bg-black/20' : 'text-xl md:text-2xl font-black tabular-nums'}`}>
                    {formatBallChip(b)}
                  </span>
                  {(b.subBallNumber ?? 0) > 0 && b.outcome === 'Extras' && (
                    <span className="text-[8px] leading-none text-orange-200/70 font-medium normal-case">
                      to team score
                    </span>
                  )}
                </div>
              </div>
            );
            })}

            {/* 2. Render placeholders for the remaining legal balls in the over */}
            {placeholders.map((_, idx) => (
              <div
                key={`empty-${idx}`}
                className={`relative flex aspect-square w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-600 bg-gray-900/40 text-gray-600 text-center transition duration-300 overflow-hidden`}
              >
                <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-tighter opacity-40 mb-0.5">
                  Ball {feedLegalBalls + idx + 1}
                </span>
                <span className="text-gray-600 opacity-30 text-lg">—</span>
              </div>
            ))}
          </div>
        </section>
        )}

        {showBettingCard && displayMatch && (
          <MatchOutcomeBetting
            matchId={matchId}
            teamA={displayMatch.teamA}
            teamB={displayMatch.teamB}
            status={displayMatch.status}
            token={token}
            stake={clampStakeAmount(Number(stakeInput) || 0)}
            onBalance={(coins) => updateCoins(coins)}
          />
        )}

        <div className="bg-gray-800/80 backdrop-blur-md p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl shadow-xl border border-gray-700 mb-8 relative">
          {showBettingCard ? (
          <>
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center mb-6 sm:mb-8 gap-4 border-b border-gray-700/50 pb-4 sm:pb-6">
            <h2 className="text-xl sm:text-2xl font-bold flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="p-2 bg-yellow-500/10 rounded-lg text-yellow-400 font-black text-sm px-2">₹</div>
              <span className="text-gray-300">Balance:</span>
              <span className="text-yellow-400 font-black tabular-nums transition-all duration-300">
                {formatInr(user?.coinsBalance ?? 0)}
              </span>
              {user?.currentStreak && user.currentStreak >= 3 && (
                <span className="text-xs bg-emerald-500 text-white px-2 py-1 rounded-md ml-2 animate-bounce">
                   {user.currentStreak}x Streak Active!
                </span>
              )}
            </h2>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between sm:justify-end gap-2 bg-gray-900/50 py-2.5 px-3 sm:px-4 rounded-xl border border-gray-700/50 w-full sm:w-auto">
              <label className="text-gray-400 font-medium text-sm sm:text-base shrink-0">Stake (INR)</label>
              <div className="flex flex-col items-end gap-0.5 w-full sm:w-auto">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={stakeInput}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '') {
                    setStakeInput('');
                    return;
                  }
                  if (!/^\d+$/.test(v)) return;
                  if (v.length > 8) return;
                  setStakeInput(v);
                }}
                onBlur={() => {
                  const n = clampStakeAmount(Number(stakeInput) || 0);
                  setStakeInput(String(n));
                }}
                className="bg-gray-700 px-3 sm:px-4 py-2 rounded-lg w-full max-w-[8rem] sm:w-28 text-center text-lg sm:text-xl font-bold font-mono focus:outline-none focus:ring-2 focus:ring-yellow-500 transition-all border border-gray-600"
              />
              <span className="text-[10px] text-gray-500 text-right w-full sm:w-auto">
                Min {formatInr(MIN_STAKE_COINS)} · Max {formatInr(MAX_STAKE_COINS)}
              </span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-end mb-3 sm:mb-4">
             <div className="flex flex-wrap gap-1.5 sm:gap-2">
                 <button type="button" onClick={() => setActiveTab('ball')} className={`flex-1 min-w-[5.5rem] sm:flex-none px-3 sm:px-4 py-2 text-sm sm:text-base font-bold transition rounded-lg inline-flex items-center justify-center gap-1.5 ${activeTab === 'ball' ? 'bg-indigo-600 text-white' : 'text-gray-400 bg-gray-700/30 hover:bg-gray-700 hover:text-white'}`}>
                   Ball
                 </button>
                 <button type="button" onClick={() => setActiveTab('prematch')} className={`flex-1 min-w-[5.5rem] sm:flex-none px-3 sm:px-4 py-2 text-sm sm:text-base font-bold transition rounded-lg inline-flex items-center justify-center gap-1.5 ${activeTab === 'prematch' ? 'bg-indigo-600 text-white' : 'text-gray-400 bg-gray-700/30 hover:bg-gray-700 hover:text-white'}`}>
                   Prematch
                 </button>
                 <button type="button" onClick={() => setActiveTab('over')} className={`flex-1 min-w-[5.5rem] sm:flex-none px-3 sm:px-4 py-2 text-sm sm:text-base font-bold transition rounded-lg inline-flex items-center justify-center gap-1.5 ${activeTab === 'over' ? 'bg-indigo-600 text-white' : 'text-gray-400 bg-gray-700/30 hover:bg-gray-700 hover:text-white'}`}>
                   Over
                   <span className="text-[10px] font-black uppercase tracking-wide bg-white/15 px-1.5 py-0.5 rounded">Soon</span>
                 </button>
             </div>
             <span className="hidden md:inline-block text-sm font-medium text-indigo-300/90 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
               Ball outcomes use the multipliers on each button
             </span>
          </div>
          <p className="md:hidden mb-3 text-center text-[11px] text-indigo-300/80">
            Multipliers are shown on each ball outcome below.
          </p>

          {displayMatch?.status === 'upcoming' && activeTab === 'ball' && (
            <div className="mb-4 rounded-xl border border-sky-500/30 bg-sky-950/30 px-4 py-3 text-sm text-sky-100">
              Ball-by-ball betting opens when this match goes live. Pre-match <strong>Bet on Favourites</strong> picks
              are on your <strong>Dashboard</strong>.
            </div>
          )}

          {!displayMatch?.predictionsLocked && activeTab === 'ball' && (
            <div
              className={`mb-6 rounded-2xl border p-4 md:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
                ballBet.bettingOpen
                  ? 'bg-emerald-950/40 border-emerald-500/30'
                  : 'bg-amber-950/40 border-amber-500/35'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl font-mono text-2xl font-black ${
                    ballBet.bettingOpen
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-amber-500/20 text-amber-200'
                  }`}
                >
                  {ballBet.bettingOpen
                    ? String(ballBet.secondsLeftInWindow).padStart(2, '0')
                    : '—'}
                </div>
                <div>
                  <p
                    className={`text-lg font-black ${
                      ballBet.bettingOpen ? 'text-emerald-300' : 'text-amber-200'
                    }`}
                  >
                    {ballBet.bettingOpen ? 'Place your bet' : 'Session closed — wait for next event'}
                  </p>
                  <p className="text-sm text-gray-400">
                    {ballBet.bettingOpen
                      ? `You have ${ballBet.secondsLeftInWindow}s left — betting closes when this window ends.`
                      : 'A new 15s window opens after each legal ball or after an extra (wide/no-ball) is recorded — even if the over counter does not move.'}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {displayMatch?.predictionsLocked && activeTab === 'ball' ? (
            <div className="bg-red-900/30 text-red-400 p-8 rounded-2xl text-center font-black text-2xl animate-pulse border-2 border-red-500/30 shadow-[0_0_30px_rgba(239,68,68,0.15)] flex flex-col items-center justify-center gap-4 mt-6">
              <svg className="w-12 h-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Predictions Locked for Current Ball
            </div>
          ) : (
            <div className="mt-6">
              {activeTab === 'ball' && (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4">
                  {(
                    [
                      {
                        label: 'Dot Ball',
                        val: 'Dot',
                        color: 'bg-gray-700 hover:bg-gray-600',
                        text: 'text-gray-100',
                      },
                      {
                        label: 'Single/Double',
                        val: '1-2 Runs',
                        color: 'bg-blue-600 hover:bg-blue-500',
                        text: 'text-white',
                      },
                      {
                        label: 'Boundary (4)',
                        val: '4 Runs',
                        color: 'bg-fuchsia-600 hover:bg-fuchsia-500',
                        text: 'text-white',
                      },
                      {
                        label: 'Six (6)',
                        val: '6 Runs',
                        color: 'bg-purple-600 hover:bg-purple-500',
                        text: 'text-white',
                      },
                      {
                        label: 'Wicket',
                        val: 'Wicket',
                        color: 'bg-red-600 hover:bg-red-500',
                        text: 'text-white',
                      },
                      {
                        label: 'Wide / No Ball',
                        val: 'Extras',
                        color: 'bg-orange-600 hover:bg-orange-500',
                        text: 'text-white',
                      },
                    ] as const
                  ).map((outcome) => {
                    const mx =
                      ballMultiplierMap[outcome.val] ??
                      ballMultiplierMap['Dot'] ??
                      DEFAULT_BALL_MULTIPLIERS.Dot;
                    return (
                      <button
                        key={outcome.val}
                        type="button"
                        onClick={() => placePredictionGuarded('ball', outcome.val)}
                        disabled={!canPlaceBet}
                        className={`${outcome.color} ${outcome.text} min-h-[5.25rem] sm:min-h-[6.5rem] py-3 sm:py-6 px-2 rounded-xl sm:rounded-2xl font-black text-sm sm:text-lg transition-all sm:hover:-translate-y-1 sm:hover:shadow-[0_10px_20px_rgba(0,0,0,0.3)] active:scale-[0.98] border border-white/10 flex flex-col items-center justify-center gap-1 sm:gap-2 disabled:pointer-events-none disabled:opacity-40`}
                      >
                        <span className="text-center leading-snug">{outcome.label}</span>
                        <span className="inline-flex items-center rounded-full bg-black/25 px-2.5 py-0.5 text-amber-200 font-mono text-xs sm:text-base font-black tabular-nums ring-1 ring-amber-400/30">
                          {formatMultiplierLabel(mx)}
                        </span>
                        <span className="text-[10px] sm:text-xs font-semibold opacity-75 uppercase tracking-wide">
                          Bet
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {activeTab === 'over' && (
                <div className="rounded-2xl border border-indigo-500/25 bg-indigo-950/30 px-6 py-14 text-center">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-300/80 mb-2">Over markets</p>
                  <p className="text-2xl sm:text-3xl font-black text-white mb-2">Coming soon</p>
                  <p className="text-sm text-gray-400 max-w-md mx-auto">
                    Totals, maidens, and wicket-in-over props will launch here after settlement logic is wired to live overs.
                  </p>
                </div>
              )}

              {activeTab === 'prematch' && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-cyan-500/25 bg-cyan-950/20 p-4">
                    <p className="text-sm font-black text-cyan-200 mb-1">Toss betting</p>
                    {tossBetPlaced ? (
                      <p className="text-sm text-emerald-200 font-semibold">You have placed bet on toss.</p>
                    ) : (
                      <p className="text-xs text-gray-400 mb-3">
                        You can bet on toss only one time.
                      </p>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={tossBetPlaced || prematchBusy != null || displayMatch.status !== 'upcoming'}
                        onClick={() => placeOutcomeBet('toss', 'A')}
                        className="rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40 disabled:pointer-events-none"
                      >
                        {prematchBusy === 'toss-A'
                          ? 'Placing...'
                          : `${displayMatch.teamA} · ${formatMultiplierLabel(
                              prematchOdds?.betting?.toss?.multiplier,
                            )}`}
                      </button>
                      <button
                        type="button"
                        disabled={tossBetPlaced || prematchBusy != null || displayMatch.status !== 'upcoming'}
                        onClick={() => placeOutcomeBet('toss', 'B')}
                        className="rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40 disabled:pointer-events-none"
                      >
                        {prematchBusy === 'toss-B'
                          ? 'Placing...'
                          : `${displayMatch.teamB} · ${formatMultiplierLabel(
                              prematchOdds?.betting?.toss?.multiplier,
                            )}`}
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-indigo-500/25 bg-indigo-950/20 p-4">
                    <p className="text-sm font-black text-indigo-200 mb-1">Favourite team (pre-match)</p>
                    <p className="text-xs text-gray-400 mb-3">Choose your favourite before match starts.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={prematchBusy != null || displayMatch.status !== 'upcoming'}
                        onClick={() => placeOutcomeBet('match_winner', 'A')}
                        className="rounded-xl bg-indigo-900/50 hover:bg-indigo-800/60 border border-indigo-600/50 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40 disabled:pointer-events-none"
                      >
                        {prematchBusy === 'match_winner-A'
                          ? 'Placing...'
                          : `${displayMatch.teamA} · ${formatMultiplierLabel(
                              prematchOdds?.betting?.matchWinner?.multiplierA,
                            )}`}
                      </button>
                      <button
                        type="button"
                        disabled={prematchBusy != null || displayMatch.status !== 'upcoming'}
                        onClick={() => placeOutcomeBet('match_winner', 'B')}
                        className="rounded-xl bg-indigo-900/50 hover:bg-indigo-800/60 border border-indigo-600/50 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40 disabled:pointer-events-none"
                      >
                        {prematchBusy === 'match_winner-B'
                          ? 'Placing...'
                          : `${displayMatch.teamB} · ${formatMultiplierLabel(
                              prematchOdds?.betting?.matchWinner?.multiplierB,
                            )}`}
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-violet-500/25 bg-violet-950/20 p-4">
                    <p className="text-sm font-black text-violet-200 mb-1">Risk Match vs Match</p>
                    {riskMatchBetsToday >= 3 ? (
                      <p className="text-xs text-emerald-200 font-semibold mb-3">
                        You have done for today on this.
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400 mb-3">
                        Multiplier is controlled from admin panel. You can bet 3 times per day on this market.
                      </p>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={prematchBusy != null || displayMatch.status !== 'upcoming' || riskMatchBetsToday >= 3}
                        onClick={() => placeOutcomeBet('team_vs_team', 'A')}
                        className="rounded-xl bg-violet-900/50 hover:bg-violet-800/60 border border-violet-600/50 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40 disabled:pointer-events-none"
                      >
                        {prematchBusy === 'team_vs_team-A'
                          ? 'Placing...'
                          : `${displayMatch.teamA} · ${formatMultiplierLabel(
                              prematchOdds?.betting?.teamVsTeam?.multiplierA,
                            )}`}
                      </button>
                      <button
                        type="button"
                        disabled={prematchBusy != null || displayMatch.status !== 'upcoming' || riskMatchBetsToday >= 3}
                        onClick={() => placeOutcomeBet('team_vs_team', 'B')}
                        className="rounded-xl bg-violet-900/50 hover:bg-violet-800/60 border border-violet-600/50 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40 disabled:pointer-events-none"
                      >
                        {prematchBusy === 'team_vs_team-B'
                          ? 'Placing...'
                          : `${displayMatch.teamB} · ${formatMultiplierLabel(
                              prematchOdds?.betting?.teamVsTeam?.multiplierB,
                            )}`}
                      </button>
                    </div>
                    <p className="text-[11px] text-violet-200/80 mt-2">
                      Attempts used today: {riskMatchBetsToday}/3
                    </p>
                  </div>

                  <div className="rounded-2xl border border-emerald-500/25 bg-emerald-950/20 p-4">
                    <p className="text-sm font-black text-emerald-200 mb-1">Player prop favourites</p>
                    {playerPropItems.length === 0 ? (
                      <p className="text-xs text-gray-400">
                        No player prop market available for this match yet. You can also check{' '}
                        <Link href="/dashboard" className="text-indigo-300 hover:underline">Dashboard</Link>.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {playerPropItems.map((row) => (
                          <button
                            key={row.market.id}
                            type="button"
                            disabled={prematchBusy != null || !row.bettingOpen}
                            onClick={() => placePlayerPropBet(row.market.id, row.market.label)}
                            className="w-full rounded-xl bg-emerald-900/40 hover:bg-emerald-800/50 border border-emerald-600/40 px-3 py-2.5 text-left text-sm text-white disabled:opacity-40 disabled:pointer-events-none"
                          >
                            <span className="font-semibold">{row.market.label}</span>
                            <span className="ml-2 text-amber-200 font-mono">
                              {formatMultiplierLabel(row.market.multiplier)}
                            </span>
                            {prematchBusy === `prop-${row.market.id}` && (
                              <span className="ml-2 text-xs text-gray-300">Placing...</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          )}
          </>
          ) : (
            <div className="text-center py-8 px-4 text-gray-400">
              <p className="text-lg font-bold text-white mb-2">Predictions closed</p>
              <p className="text-sm">
                {displayMatch?.status === 'completed'
                  ? 'This match has ended. Check the schedule above for the next game.'
                  : 'Betting opens when this match goes live.'}
              </p>
            </div>
          )}

          {betActivity && (
            <div className="mt-8 pt-8 border-t border-gray-700/50">
              <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  Live bets on this match
                </h3>
                <div className="flex gap-4 text-sm">
                  <div className="rounded-xl bg-gray-900/80 border border-gray-700 px-4 py-2">
                    <span className="text-gray-500">Users betting</span>
                    <span className="ml-2 font-mono font-bold text-cyan-300">
                      {betActivity.usersBetting}
                    </span>
                  </div>
                  <div className="rounded-xl bg-gray-900/80 border border-gray-700 px-4 py-2">
                    <span className="text-gray-500">Open bets</span>
                    <span className="ml-2 font-mono font-bold text-amber-300">
                      {betActivity.totalBets}
                    </span>
                  </div>
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto rounded-2xl border border-gray-700/60 bg-gray-900/40 divide-y divide-gray-800">
                {betActivity.recentBets.length === 0 ? (
                  <p className="p-6 text-center text-gray-500 text-sm">No bets yet — be the first.</p>
                ) : (
                  betActivity.recentBets.map((b) => {
                    const isYou =
                      !!user?.id && String(b.userId) === String(user.id);
                    return (
                      <div
                        key={b.id}
                        className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm ${
                          isYou ? 'bg-indigo-950/40' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`font-semibold truncate ${
                              isYou ? 'text-indigo-300' : 'text-gray-200'
                            }`}
                          >
                            {isYou ? 'You' : b.username}
                          </span>
                          <span className="text-gray-500 text-xs uppercase">{b.type}</span>
                        </div>
                        <div className="flex items-center gap-3 text-gray-300">
                          <span className="text-gray-400 truncate max-w-[140px]">{b.predictionValue}</span>
                          <span className="font-mono text-yellow-400/90">{formatInr(b.amountStaked)}</span>
                          <span className="text-gray-600 text-xs">
                            {b.multiplier?.toFixed?.(1) ?? b.multiplier}x
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {toastMsg && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 max-w-md px-5 py-4 rounded-2xl bg-emerald-950/95 border border-emerald-500/40 text-emerald-100 shadow-2xl shadow-emerald-900/40 text-center font-semibold"
        >
          {toastMsg}
        </div>
      )}

      {betPlacedPopup && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="bet-placed-title"
        >
          <div className="w-full max-w-md rounded-3xl border border-emerald-500/40 bg-gray-900 p-8 shadow-2xl shadow-emerald-900/30 text-center">
            <div className="text-5xl mb-3">✓</div>
            <h2 id="bet-placed-title" className="text-2xl font-black text-white mb-2">
              Bet placed
            </h2>
            <p className="text-emerald-100/90 text-sm leading-relaxed">{betPlacedPopup}</p>
            <p className="text-gray-500 text-xs mt-4">
              Your bet appears in the live list below with other players.
            </p>
            <button
              type="button"
              onClick={() => setBetPlacedPopup(null)}
              className="mt-6 w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 py-3 font-bold text-white transition"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
