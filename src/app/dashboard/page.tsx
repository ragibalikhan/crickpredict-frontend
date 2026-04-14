'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useStore } from '../../store/store';
import { API_BASE } from '../../lib/api';
import TeamAvatar from '../../components/TeamAvatar';

const DASHBOARD_RECENTLY_ENDED_MS = 6 * 60 * 60 * 1000;

function getEffectiveCompletedAtIso(match: DashboardMatch): string | undefined {
  if (match.status !== 'completed') return match.completedAt;
  const completedMs = match.completedAt ? new Date(match.completedAt).getTime() : NaN;
  const schedMs = match.scheduledStartAt ? new Date(match.scheduledStartAt).getTime() : NaN;
  if (!Number.isNaN(schedMs)) {
    const estMs = schedMs + 4 * 60 * 60 * 1000;
    if (!Number.isNaN(completedMs)) {
      // Feed/poller flaps can keep rewriting completedAt to "now"; clamp to realistic end estimate.
      if (completedMs > estMs + 60 * 60 * 1000) return new Date(estMs).toISOString();
      return match.completedAt;
    }
    if (estMs <= Date.now()) return new Date(estMs).toISOString();
  }
  return match.completedAt;
}

function formatEndedMeta(
  completedAtIso: string | undefined,
  nowMs: number,
): { absolute: string; relative: string; dropsIn?: string } | null {
  if (!completedAtIso) return null;
  const t = new Date(completedAtIso).getTime();
  if (Number.isNaN(t)) return null;
  const absolute = new Date(completedAtIso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const agoMs = nowMs - t;
  const sec = Math.max(0, Math.floor(agoMs / 1000));
  let relative: string;
  if (sec < 60) relative = `${sec}s ago`;
  else if (sec < 3600) relative = `${Math.floor(sec / 60)}m ago`;
  else relative = `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m ago`;
  const leftMs = Math.max(0, DASHBOARD_RECENTLY_ENDED_MS - agoMs);
  const dropsIn =
    leftMs > 0
      ? leftMs < 60000
        ? '<1m'
        : leftMs < 3600000
          ? `${Math.ceil(leftMs / 60000)}m`
          : `${Math.ceil(leftMs / 3600000)}h`
      : undefined;
  return { absolute, relative: `Ended ${relative}`, dropsIn };
}

type DashboardMatch = {
  _id: string;
  teamA: string;
  teamB: string;
  currentOver: number;
  currentBall: number;
  scoreA: number;
  scoreB: number;
  wicketsA: number;
  wicketsB: number;
  status?: string;
  scheduledStartAt?: string;
  completedAt?: string;
};

type ScheduleSummary = {
  nextMatch: DashboardMatch | null;
  tomorrowMatches: DashboardMatch[];
};

export default function Dashboard() {
  const { user } = useStore();
  const [matches, setMatches] = useState<DashboardMatch[]>([]);
  const [scheduleSummary, setScheduleSummary] = useState<ScheduleSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  /**
   * GET /matches is public on the API — do not gate on JWT. If we only fetched when `token` was set,
   * a missing/expired token (while persisted `user` still showed) produced an empty list with no error.
   * Poll with optional Authorization so lists load for everyone.
   */
  useEffect(() => {
    let controller: AbortController | null = null;
    const load = () => {
      controller?.abort();
      controller = new AbortController();
      const tok = useStore.getState().token;
      const headers: HeadersInit = {};
      if (tok) headers.Authorization = `Bearer ${tok}`;
      Promise.all([
        fetch(`${API_BASE}/matches`, { headers, signal: controller.signal }).then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        }),
        fetch(`${API_BASE}/matches/schedule`, { headers, signal: controller.signal })
          .then((res) => (res.ok ? res.json() : null))
          .catch(() => null),
      ])
        .then(([data, sched]) => {
          const list = Array.isArray(data) ? data : [];
          setMatches(list);
          if (sched && typeof sched === 'object') {
            setScheduleSummary({
              nextMatch: sched.nextMatch ?? null,
              tomorrowMatches: Array.isArray(sched.tomorrowMatches) ? sched.tomorrowMatches : [],
            });
          } else {
            setScheduleSummary(null);
          }
          setLoadError(null);
        })
        .catch((err) => {
          if (err?.name === 'AbortError') return;
          setLoadError(
            'Cannot reach the API. Start the backend (Nest on port 3000) and refresh, or set NEXT_PUBLIC_API_URL.',
          );
        });
    };
    load();
    const t = setInterval(load, 2000);
    return () => {
      clearInterval(t);
      controller?.abort();
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('signup_bonus_toast')) {
      // Small delay to ensure the UI is rendered
      setTimeout(() => {
        alert('🎉 You received ₹50 signup bonus in your wallet! Deposit ₹100 to unlock it.');
        sessionStorage.removeItem('signup_bonus_toast');
      }, 500);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white px-4 py-6 pb-mobile-nav sm:p-6 md:p-12 touch-manipulation">
      <div className="max-w-6xl mx-auto w-full min-w-0">
        <header className="mb-8 sm:mb-12 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-6">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-4xl font-black mb-2 break-words">
              Welcome back,{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
                {user?.username}
              </span>
            </h1>
            <p className="text-gray-400 text-sm sm:text-base leading-relaxed">
              Ready to make some predictions? Check out the live matches below.
            </p>
          </div>
          
          <div className="bg-gray-800/80 p-4 rounded-2xl border border-gray-700/50 flex gap-4 sm:gap-6 shadow-xl backdrop-blur-sm shadow-indigo-900/20 shrink-0 justify-center md:justify-end">
             <div className="text-center min-w-[7rem]">
               <p className="text-sm text-gray-400 font-medium">Win Streak</p>
               <p className="text-2xl font-black text-emerald-400">{user?.currentStreak || 0} 🔥</p>
             </div>
          </div>
        </header>

        <section className="mb-8 sm:mb-10 rounded-2xl border border-violet-500/25 bg-violet-950/20 p-4 sm:p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-violet-300 mb-1">Recommended</p>
          <h2 className="text-lg sm:text-xl font-black text-white mb-1">Try pre-match markets</h2>
          <p className="text-sm text-gray-300">
            Explore pre-match bets like Toss, Risk Match vs Match, and Player Props directly from each match page.
          </p>
        </section>

        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></span>
          IPL matches (live, upcoming &amp; ended in the last 6h)
        </h2>

        {scheduleSummary &&
          (scheduleSummary.nextMatch ||
            (scheduleSummary.tomorrowMatches && scheduleSummary.tomorrowMatches.length > 0)) && (
            <div className="mb-6 rounded-2xl border border-sky-500/25 bg-sky-950/20 px-4 py-3 sm:px-5 sm:py-4">
              <p className="text-sky-200/90 text-xs font-semibold uppercase tracking-wider mb-2">
                Scheduled (from feed)
              </p>
              <ul className="space-y-2 text-sm text-gray-200">
                {scheduleSummary.nextMatch && (
                  <li className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="text-sky-300 font-medium">Next up</span>
                    <Link
                      href={`/matches/${scheduleSummary.nextMatch._id}`}
                      className="text-white hover:text-sky-200 underline-offset-2 hover:underline"
                    >
                      {scheduleSummary.nextMatch.teamA} vs {scheduleSummary.nextMatch.teamB}
                    </Link>
                    {scheduleSummary.nextMatch.scheduledStartAt && (
                      <span className="text-gray-400">
                        ·{' '}
                        {new Date(scheduleSummary.nextMatch.scheduledStartAt).toLocaleString(undefined, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    )}
                  </li>
                )}
                {scheduleSummary.tomorrowMatches?.length > 0 && (
                  <li>
                    <span className="text-sky-300 font-medium">Tomorrow</span>
                    <span className="text-gray-400 ml-2">
                      {scheduleSummary.tomorrowMatches.length} fixture
                      {scheduleSummary.tomorrowMatches.length === 1 ? '' : 's'}
                    </span>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {scheduleSummary.tomorrowMatches.map((m) => (
                        <Link
                          key={m._id}
                          href={`/matches/${m._id}`}
                          className="inline-flex items-center rounded-lg bg-gray-800/80 px-2.5 py-1 text-xs text-gray-100 border border-gray-600/50 hover:border-sky-500/40 hover:text-white"
                        >
                          {m.teamA} vs {m.teamB}
                          {m.scheduledStartAt && (
                            <span className="ml-1.5 text-gray-500 tabular-nums">
                              {new Date(m.scheduledStartAt).toLocaleTimeString(undefined, {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          )}
                        </Link>
                      ))}
                    </div>
                  </li>
                )}
              </ul>
            </div>
          )}

        {loadError && (
          <div className="mb-6 rounded-2xl border border-amber-600/40 bg-amber-950/30 px-4 py-3 text-amber-100 text-sm">
            {loadError}
          </div>
        )}

        {(() => {
          const visibleMatches = matches.filter((m) => {
            if (m.status !== 'completed') return true;
            const endIso = getEffectiveCompletedAtIso(m);
            if (!endIso) return false;
            const t = new Date(endIso).getTime();
            if (Number.isNaN(t)) return false;
            return nowMs - t <= DASHBOARD_RECENTLY_ENDED_MS;
          });

          return visibleMatches.length === 0 && !loadError ? (
           <div className="text-center p-12 bg-gray-800/50 rounded-3xl border border-gray-700/50 border-dashed">
             <p className="text-gray-400 mb-2">No IPL matches to show yet.</p>
             <p className="text-gray-600 text-sm max-w-md mx-auto leading-relaxed">
               The server returned an empty list: MongoDB may have no synced fixtures yet, or rows may be filtered (e.g. demo test data). Ensure the backend can reach Cricbuzz and Mongo. In Admin, use &quot;Resync live &amp; upcoming&quot; after deploy. If the site uses a direct API URL, set <code className="text-gray-500">CORS_ORIGINS</code> on the server to include this origin.
             </p>
           </div>
          ) : visibleMatches.length === 0 ? null : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {visibleMatches.map((match) => {
              const effectiveCompletedAtIso = getEffectiveCompletedAtIso(match);
              const endedMeta =
                match.status === 'completed'
                  ? formatEndedMeta(effectiveCompletedAtIso, nowMs)
                  : null;
              return (
              <Link href={`/matches/${match._id}`} key={match._id} className="block group min-w-0">
                <div className="bg-gray-800/60 hover:bg-gray-800 border border-gray-700/50 hover:border-indigo-500/50 p-4 sm:p-6 rounded-2xl sm:rounded-3xl transition-all sm:transform sm:hover:-translate-y-2 sm:hover:shadow-2xl sm:hover:shadow-indigo-500/10 active:scale-[0.99]">
                  <div className="flex justify-between items-center mb-3 sm:mb-4 gap-2">
                    <span
                      className={
                        match.status === 'live'
                          ? 'bg-red-500/10 text-red-400 px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider border border-red-500/20 shrink-0'
                          : match.status === 'completed'
                            ? 'bg-slate-600/20 text-slate-300 px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider border border-slate-500/30 shrink-0'
                            : 'bg-slate-500/10 text-slate-300 px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider border border-slate-500/20 shrink-0'
                      }
                    >
                      {match.status === 'live'
                        ? 'Live'
                        : match.status === 'completed'
                          ? 'Match ended'
                          : 'Upcoming'}
                    </span>
                    <span className="text-gray-400 text-xs sm:text-sm truncate text-right">
                      {match.status === 'live' ? (
                        <span className="text-red-300/90 font-semibold">Watch live</span>
                      ) : match.status === 'completed' ? (
                        <span className="block text-right">
                          <span className="block">Final score</span>
                          {endedMeta && (
                            <span className="block text-[10px] sm:text-xs text-gray-500 mt-0.5 font-normal">
                              {endedMeta.absolute}
                            </span>
                          )}
                        </span>
                      ) : match.scheduledStartAt ? (
                        `Starts ${new Date(match.scheduledStartAt).toLocaleString(undefined, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}`
                      ) : (
                        'Scheduled — tap for details'
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-center gap-3 sm:gap-5 mb-4 sm:mb-6 min-w-0">
                    <TeamAvatar teamName={match.teamA} size={52} className="shrink-0 ring-2 ring-white/10" />
                    <span className="text-gray-500 text-xs sm:text-lg font-bold uppercase tracking-widest shrink-0">
                      vs
                    </span>
                    <TeamAvatar teamName={match.teamB} size={52} className="shrink-0 ring-2 ring-white/10" />
                  </div>
                  <h3 className="text-sm sm:text-xl font-black text-white mb-4 text-center leading-snug line-clamp-2 min-h-[2.5rem] px-1">
                    <span className="capitalize">{match.teamA}</span>
                    <span className="text-gray-500 font-normal mx-1.5">vs</span>
                    <span className="capitalize">{match.teamB}</span>
                  </h3>
                  {endedMeta && (
                    <p className="text-[11px] sm:text-xs text-gray-500 text-center mb-2">
                      {endedMeta.relative}
                      {endedMeta.dropsIn ? ` · off this list in ${endedMeta.dropsIn}` : ''}
                    </p>
                  )}
                  <div className="bg-gray-900/50 p-3 sm:p-4 rounded-xl border border-gray-700/50 space-y-2.5 sm:space-y-3">
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-xs sm:text-sm text-gray-400 capitalize truncate min-w-0 flex items-center gap-2">
                        <TeamAvatar teamName={match.teamA} size={32} className="shrink-0" />
                        {match.teamA}
                      </span>
                      <span className="font-mono text-base sm:text-lg font-bold text-white tabular-nums shrink-0">
                        {match.scoreA}/{match.wicketsA}
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-xs sm:text-sm text-gray-400 capitalize truncate min-w-0 flex items-center gap-2">
                        <TeamAvatar teamName={match.teamB} size={32} className="shrink-0" />
                        {match.teamB}
                      </span>
                      <span className="font-mono text-base sm:text-lg font-bold text-white tabular-nums shrink-0">
                        {match.scoreB}/{match.wicketsB}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
            })}
          </div>
          );
        })()}
      </div>
    </div>
  );
}
