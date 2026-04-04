'use client';
import { useEffect, useMemo, useState } from 'react';
import { useSocket, type MatchBetActivity } from '../../../hooks/useSocket';
import { useBallBettingWindow } from '../../../hooks/useBallBettingWindow';
import { useOverBettingCountdown } from '../../../hooks/useOverBettingCountdown';
import { useStore, type BallSlot } from '../../../store/store';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { API_BASE } from '../../../lib/api';
import TeamAvatar from '../../../components/TeamAvatar';
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
  const [predictionAmount, setPredictionAmount] = useState(10);
  const [activeTab, setActiveTab] = useState<'ball' | 'over' | 'batsman'>('ball');
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
    let cancelled = false;
    const load = () =>
      fetch(`${API_BASE}/matches/${matchId}`)
        .then((res) => {
          if (!res.ok) throw new Error('not_found');
          return res.json();
        })
        .then((data) => {
          if (cancelled) return;
          if (!data) {
            setMatchLoad('error');
            return;
          }
          setLiveMatch(data);
          setMatchLoad('ok');
        })
        .catch(() => {
          if (!cancelled) setMatchLoad('error');
        });
    setMatchLoad('loading');
    load();
    const poll = setInterval(load, MATCH_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(poll);
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

  const placePrediction = async (type: string, value: string) => {
    if (!token) return alert('Please login first to use real coins!');

    const stake = clampStakeAmount(predictionAmount);
    if (stake !== predictionAmount) setPredictionAmount(stake);

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
        const msg = `You placed your bet: ${stake} coins on "${value}"`;
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
        alert(data?.message || 'Failed to place prediction. Check your coins or if predictions are locked.');
      }
    } catch {
       alert('Failed to connect to backend, predicting locally in demo mode.');
    }
  }

  const displayMatch = liveMatch;

  const ballsThisOver: BallSlot[] = displayMatch?.ballsThisOver || [];
  const deliveries = [...ballsThisOver].sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (ta !== tb) return ta - tb;
    return (a.subBallNumber ?? 0) - (b.subBallNumber ?? 0);
  });
  const legalCount = deliveries.filter(b => (b.subBallNumber ?? 0) === 0).length;
  const placeholders = Array.from({ length: Math.max(0, 6 - legalCount) });

  const co = displayMatch?.currentOver ?? 0;
  const cb = displayMatch?.currentBall ?? 0;
  const nextBallInOver = cb < 6 ? cb + 1 : 1;

  const formatBallChip = (b: BallSlot) => {
    if (b.isWicket) return 'W';
    if (b.outcome === 'Wicket') return 'W';
    if (b.outcome === 'Dot' || (b.runs === 0 && !b.isWicket)) return '•';
    if (b.outcome === 'Extras') {
      if (b.runs != null && b.runs > 1) return `Wd+${b.runs}`;
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
    if (b.outcome === '4 Runs' || b.runs === 4) {
      return 'border-amber-500/70 bg-amber-950/45 text-amber-200';
    }
    if (b.outcome === '6 Runs' || b.runs === 6) {
      return 'border-violet-500/70 bg-violet-950/45 text-violet-200';
    }
    if (b.outcome === '1-2 Runs' || (b.runs != null && b.runs > 0 && b.runs <= 2)) {
      return 'border-sky-500/55 bg-sky-950/35 text-sky-100';
    }
    if (b.outcome === 'Extras') {
      return 'border-orange-500/55 bg-orange-950/35 text-orange-200';
    }
    if (b.outcome === 'Dot' || (b.runs === 0 && !b.isWicket)) {
      return 'border-slate-500/55 bg-slate-900/60 text-slate-200';
    }
    return 'border-emerald-500/50 bg-emerald-950/40 text-emerald-200';
  };

  const overPhaseKey = String(displayMatch?.currentOver ?? 0);

  const ballBet = useBallBettingWindow(
    displayMatch?.currentInnings ?? 1,
    displayMatch?.currentOver ?? 0,
    displayMatch?.currentBall ?? 0,
    matchLoad === 'ok' && displayMatch?.status === 'live',
    matchId,
  );
  const overTimer = useOverBettingCountdown(overPhaseKey);

  const ballMultiplierMap = useMemo(
    () => ({ ...DEFAULT_BALL_MULTIPLIERS, ...gameMultipliers?.ballMultipliers }),
    [gameMultipliers],
  );
  const nonBallRange = gameMultipliers?.nonBallMultiplierRange ?? { min: 1.5, max: 5.0 };
  const nonBallRangeLabel = `${nonBallRange.min}×–${nonBallRange.max}×`;

  const isOverTab = activeTab === 'over';
  const matchIsLive = displayMatch?.status === 'live';
  const canPlaceBet = isOverTab
    ? overTimer.bettingOpen && !displayMatch?.predictionsLocked && matchIsLive
    : ballBet.bettingOpen && !displayMatch?.predictionsLocked && matchIsLive;

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
      if (isOverTab) {
        alert(
          overTimer.phase === 'over'
            ? 'Betting is closed while this over is in progress. It reopens before the next over starts.'
            : 'Betting window for the next over is closed — wait for the next cycle.',
        );
      } else {
        alert('Betting is closed until the next ball is released on the live feed (then you get 15 seconds to bet).');
      }
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

  const ballsLogged = displayMatch.ballsThisOver?.length ?? 0;
  const feedBowled = displayMatch.currentBall ?? 0;
  const shownBowled = Math.max(feedBowled, ballsLogged);

  return (
    <div className="min-h-screen bg-gray-900 text-white px-3 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-4 md:p-8 font-sans touch-manipulation">
      <div className="max-w-4xl mx-auto w-full min-w-0">
        <header className="mb-6 sm:mb-8 bg-gray-800 p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl shadow-2xl border border-gray-700/50 relative overflow-hidden">
          <div className="absolute top-[-40px] right-[-40px] w-40 h-40 bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 pointer-events-none" />
          <div className="absolute bottom-[-40px] left-[-40px] w-40 h-40 bg-emerald-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 pointer-events-none" />

          <div className="relative z-10 flex flex-col gap-4 sm:gap-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <TeamAvatar teamName={displayMatch.teamA} size={52} className="ring-2 ring-white/10" />
                <div className="min-w-0 flex-1">
                  <h1 className="text-lg sm:text-2xl md:text-3xl font-black text-white capitalize truncate leading-tight">
                    {displayMatch.teamA}
                  </h1>
                  <div className="mt-1 flex items-center gap-2 flex-wrap text-[11px] sm:text-xs text-gray-500">
                    {displayMatch.status === 'live' && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-2 py-0.5 text-red-300 font-bold uppercase tracking-wide border border-red-500/25">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                        Live
                      </span>
                    )}
                    {displayMatch.status === 'completed' && (
                      <span className="text-gray-400 uppercase tracking-wide">Completed</span>
                    )}
                    {displayMatch.status === 'upcoming' && (
                      <span className="text-sky-300 uppercase tracking-wide">Upcoming</span>
                    )}
                    {displayMatch.completedAt && (
                      <span className="text-gray-600 normal-case">
                        {new Date(displayMatch.completedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="hidden sm:flex items-center justify-center px-3 text-gray-600 font-light text-xl shrink-0">
                vs
              </div>

              <div className="flex items-center gap-3 min-w-0 flex-1 sm:flex-row-reverse">
                <TeamAvatar teamName={displayMatch.teamB} size={52} className="ring-2 ring-white/10" />
                <div className="min-w-0 flex-1 sm:text-right">
                  <h1 className="text-lg sm:text-2xl md:text-3xl font-black text-white capitalize truncate leading-tight sm:ml-auto">
                    {displayMatch.teamB}
                  </h1>
                  {displayMatch.status === 'upcoming' && displayMatch.scheduledStartAt && (
                    <p className="mt-1 text-[11px] text-sky-300/90">
                      Starts {new Date(displayMatch.scheduledStartAt).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="flex items-center gap-3 rounded-2xl bg-gray-900/60 border border-gray-700/60 px-3 py-3 sm:p-4 min-w-0">
                <TeamAvatar teamName={displayMatch.teamA} size={44} />
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
                <TeamAvatar teamName={displayMatch.teamB} size={44} />
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
                ? 'Scores refresh every 2s · socket + poll'
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
                  className="text-lg font-bold text-white hover:text-indigo-300"
                >
                  {scheduleInfo.nextMatch.teamA} vs {scheduleInfo.nextMatch.teamB}
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
                      <Link href={`/matches/${m._id}`} className="text-indigo-400 hover:underline">
                        {m.teamA} vs {m.teamB}
                        {m.scheduledStartAt && (
                          <span className="text-gray-500 ml-2">
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
              {ballsLogged < feedBowled && feedBowled > 0 && (
                <p className="text-xs text-amber-400/90 mt-1">
                  Catching up ball-by-ball log ({ballsLogged}/{feedBowled} recorded)…
                </p>
              )}
              <p className="text-xs text-gray-600 mt-2">
                Dots, runs, and wickets appear here as the live feed records each ball (socket + poll).
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-2">
            This over — live result per ball (updates in real time)
          </p>
          <div className="flex flex-wrap gap-3 mb-3 text-[11px] text-gray-500">
            <span>
              <span className="inline-block w-3 h-3 rounded bg-orange-600 align-middle mr-1" /> Wd (wide / extras)
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
          <div className="flex flex-wrap gap-2 md:gap-3">
            {/* 1. Render all recorded deliveries (legal + extras) chronologically */}
            {deliveries.map((b, idx) => (
              <div
                key={`${b.ballNumber}-${b.subBallNumber ?? 0}-${idx}`}
                className={`relative flex aspect-square w-[calc(25%-8px)] sm:w-[calc(16.66%-12px)] md:w-20 lg:w-24 flex-col items-center justify-center rounded-2xl border-2 text-center transition duration-300 overflow-hidden ${ballSlotClass(b, true)}`}
              >
                <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-tighter text-white/40 mb-0.5">
                  {(b.subBallNumber ?? 0) > 0 ? 'Extra' : `Ball ${b.ballNumber}`}
                </span>
                <div className="flex items-center justify-center px-1">
                  <span className={`${b.outcome === 'Extras' ? 'text-xs md:text-sm font-bold opacity-90 px-1.5 py-0.5 rounded bg-black/20' : 'text-xl md:text-2xl font-black tabular-nums'}`}>
                    {formatBallChip(b)}
                  </span>
                </div>
              </div>
            ))}

            {/* 2. Render placeholders for the remaining legal balls in the over */}
            {placeholders.map((_, idx) => (
              <div
                key={`empty-${idx}`}
                className={`relative flex aspect-square w-[calc(25%-8px)] sm:w-[calc(16.66%-12px)] md:w-20 lg:w-24 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-600 bg-gray-900/40 text-gray-600 text-center transition duration-300 overflow-hidden`}
              >
                <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-tighter opacity-40 mb-0.5">
                  Ball {legalCount + idx + 1}
                </span>
                <span className="text-gray-600 opacity-30 text-lg">—</span>
              </div>
            ))}
          </div>
        </section>
        )}

        <div className="bg-gray-800/80 backdrop-blur-md p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl shadow-xl border border-gray-700 mb-8 relative">
          {matchIsLive ? (
          <>
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center mb-6 sm:mb-8 gap-4 border-b border-gray-700/50 pb-4 sm:pb-6">
            <h2 className="text-xl sm:text-2xl font-bold flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="p-2 bg-yellow-500/10 rounded-lg"><span className="text-2xl leading-none">🪙</span></div>
              <span className="text-gray-300">Balance:</span> 
              <span className="text-yellow-400 font-black tabular-nums transition-all duration-300">
                {(user?.coinsBalance ?? 0).toLocaleString()}
              </span>
              {user?.currentStreak && user.currentStreak >= 3 && (
                <span className="text-xs bg-emerald-500 text-white px-2 py-1 rounded-md ml-2 animate-bounce">
                   {user.currentStreak}x Streak Active!
                </span>
              )}
            </h2>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between sm:justify-end gap-2 bg-gray-900/50 py-2.5 px-3 sm:px-4 rounded-xl border border-gray-700/50 w-full sm:w-auto">
              <label className="text-gray-400 font-medium text-sm sm:text-base shrink-0">Stake (coins)</label>
              <div className="flex flex-col items-end gap-0.5 w-full sm:w-auto">
              <input 
                type="number" 
                min={MIN_STAKE_COINS}
                max={MAX_STAKE_COINS}
                step={1}
                value={predictionAmount} 
                onChange={(e) => setPredictionAmount(clampStakeAmount(Number(e.target.value)))} 
                className="bg-gray-700 px-3 sm:px-4 py-2 rounded-lg w-full max-w-[8rem] sm:w-28 text-center text-lg sm:text-xl font-bold font-mono focus:outline-none focus:ring-2 focus:ring-yellow-500 transition-all border border-gray-600" 
                inputMode="numeric"
              />
              <span className="text-[10px] text-gray-500 text-right w-full sm:w-auto">
                Min {MIN_STAKE_COINS.toLocaleString()} · Max {MAX_STAKE_COINS.toLocaleString()}
              </span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-end mb-3 sm:mb-4">
             <div className="flex flex-wrap gap-1.5 sm:gap-2">
                 <button type="button" onClick={() => setActiveTab('ball')} className={`flex-1 min-w-[5.5rem] sm:flex-none px-3 sm:px-4 py-2 text-sm sm:text-base font-bold transition rounded-lg ${activeTab === 'ball' ? 'bg-indigo-600 text-white' : 'text-gray-400 bg-gray-700/30 hover:bg-gray-700 hover:text-white'}`}>Ball</button>
                 <button type="button" onClick={() => setActiveTab('over')} className={`flex-1 min-w-[5.5rem] sm:flex-none px-3 sm:px-4 py-2 text-sm sm:text-base font-bold transition rounded-lg ${activeTab === 'over' ? 'bg-indigo-600 text-white' : 'text-gray-400 bg-gray-700/30 hover:bg-gray-700 hover:text-white'}`}>Over</button>
                 <button type="button" onClick={() => setActiveTab('batsman')} className={`flex-1 min-w-[5.5rem] sm:flex-none px-3 sm:px-4 py-2 text-sm sm:text-base font-bold transition rounded-lg ${activeTab === 'batsman' ? 'bg-indigo-600 text-white' : 'text-gray-400 bg-gray-700/30 hover:bg-gray-700 hover:text-white'}`}>Batsman</button>
             </div>
             <span className="hidden md:inline-block text-sm font-medium text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full border border-emerald-400/20">
               Over / batsman {nonBallRangeLabel}
             </span>
          </div>
          <p className="md:hidden mb-3 text-center text-[11px] text-emerald-400/90">
            Over &amp; batsman bets use <span className="font-mono font-bold">{nonBallRangeLabel}</span> (set at place)
          </p>

          {!displayMatch?.predictionsLocked && (
            <div
              className={`mb-6 rounded-2xl border p-4 md:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
                (isOverTab ? overTimer.bettingOpen : ballBet.bettingOpen)
                  ? 'bg-emerald-950/40 border-emerald-500/30'
                  : 'bg-amber-950/40 border-amber-500/35'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl font-mono text-2xl font-black ${
                    (isOverTab ? overTimer.bettingOpen : ballBet.bettingOpen)
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-amber-500/20 text-amber-200'
                  }`}
                >
                  {isOverTab
                    ? String(overTimer.secondsLeft).padStart(2, '0')
                    : ballBet.bettingOpen
                      ? String(ballBet.secondsLeftInWindow).padStart(2, '0')
                      : '—'}
                </div>
                <div>
                  {isOverTab ? (
                    <>
                      <p
                        className={`text-lg font-black ${
                          overTimer.bettingOpen ? 'text-emerald-300' : 'text-amber-200'
                        }`}
                      >
                        {overTimer.phase === 'betting'
                          ? 'Place your bet (next over)'
                          : 'Over in progress'}
                      </p>
                      <p className="text-sm text-gray-400">
                        {overTimer.phase === 'betting'
                          ? `Betting closes when the over starts · ${overTimer.secondsLeft}s left in this window`
                          : `Betting stays closed until this over completes · ${overTimer.secondsLeft}s until the next over window`}
                      </p>
                    </>
                  ) : (
                    <>
                      <p
                        className={`text-lg font-black ${
                          ballBet.bettingOpen ? 'text-emerald-300' : 'text-amber-200'
                        }`}
                      >
                        {ballBet.bettingOpen ? 'Place your bet' : 'Session closed — wait for next ball'}
                      </p>
                      <p className="text-sm text-gray-400">
                        {ballBet.bettingOpen
                          ? `You have ${ballBet.secondsLeftInWindow}s left — betting closes when this window ends.`
                          : 'When the live feed advances to the next ball, a new 15s betting window opens.'}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {displayMatch?.predictionsLocked ? (
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4">
                  {(
                    [
                      { label: 'Over 10.5 Runs', val: 'Over_10.5', color: 'bg-indigo-600 hover:brightness-110' },
                      { label: 'Under 10.5 Runs', val: 'Under_10.5', color: 'bg-cyan-600 hover:brightness-110' },
                      { label: 'Wicket in Over', val: 'Over_Wicket_Yes', color: 'bg-red-600 hover:brightness-110' },
                      { label: 'Maiden Over', val: 'Over_Maiden', color: 'bg-gray-600 hover:brightness-110' },
                    ] as const
                  ).map((outcome) => (
                    <button
                      key={outcome.val}
                      type="button"
                      onClick={() => placePredictionGuarded('over', outcome.val)}
                      disabled={!canPlaceBet}
                      className={`${outcome.color} text-white min-h-[4.75rem] sm:min-h-[5.5rem] py-3 px-3 sm:py-6 rounded-xl sm:rounded-2xl font-black text-base sm:text-xl transition-all border border-white/10 flex flex-col items-center justify-center gap-1 disabled:pointer-events-none disabled:opacity-40 active:scale-[0.98]`}
                    >
                      <span className="text-center leading-tight">{outcome.label}</span>
                      <span className="inline-flex items-center rounded-full bg-black/25 px-2.5 py-0.5 text-amber-200 font-mono text-xs sm:text-sm font-black tabular-nums ring-1 ring-amber-400/30">
                        {nonBallRangeLabel}
                      </span>
                      <span className="text-[10px] text-white/70 font-medium">Random at place</span>
                    </button>
                  ))}
                </div>
              )}

              {activeTab === 'batsman' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4">
                  {(
                    [
                      { label: 'Hit Six Next 5 Balls', val: 'Batsman_Six' },
                      { label: 'Get Out Next 5 Balls', val: 'Batsman_Out' },
                      { label: 'Score 10+ Next 5 Balls', val: 'Batsman_10+' },
                    ] as const
                  ).map((outcome) => (
                    <button
                      key={outcome.val}
                      type="button"
                      onClick={() => placePredictionGuarded('batsman', outcome.val)}
                      disabled={!canPlaceBet}
                      className="bg-emerald-600 text-white hover:bg-emerald-500 min-h-[4.75rem] sm:min-h-[5.5rem] py-3 px-3 sm:py-6 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-lg transition-all border border-white/10 flex flex-col items-center justify-center gap-1 disabled:pointer-events-none disabled:opacity-40 active:scale-[0.98]"
                    >
                      <span className="text-center leading-snug">{outcome.label}</span>
                      <span className="inline-flex items-center rounded-full bg-black/25 px-2.5 py-0.5 text-amber-200 font-mono text-xs sm:text-sm font-black tabular-nums ring-1 ring-amber-400/30">
                        {nonBallRangeLabel}
                      </span>
                      <span className="text-[10px] text-emerald-100/80 font-medium">Random at place</span>
                    </button>
                  ))}
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
                          <span className="font-mono text-yellow-400/90">{b.amountStaked} 🪙</span>
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
