'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useStore } from '../../store/store';
import { API_BASE } from '../../lib/api';

type UserBetRow = {
  id: string;
  matchId: string;
  match: { teamA: string; teamB: string; status: string } | null;
  type: string;
  predictionValue: string;
  amountStaked: number;
  multiplier: number;
  comboMultiplier: number;
  status: string;
  payoutCoins: number | null;
  createdAt: string;
  updatedAt?: string;
};

export default function Dashboard() {
  const { user, token } = useStore();
  const [myBets, setMyBets] = useState<UserBetRow[]>([]);
  const [betsLoading, setBetsLoading] = useState(false);
  const [betsError, setBetsError] = useState<string | null>(null);
  const betsSilentRefresh = useRef(false);
  const [matches, setMatches] = useState<
    Array<{
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
    }>
  >([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    const load = () =>
      fetch(`${API_BASE}/matches`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((data) => {
          const list = Array.isArray(data) ? data : [];
          setMatches(list);
          setLoadError(null);
        })
        .catch(() => {
          setLoadError(
            'Cannot reach the API. Start the backend (Nest on port 3000) and refresh, or set NEXT_PUBLIC_API_URL.',
          );
        });
    load();
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [token]);

  useEffect(() => {
    if (!token) {
      setMyBets([]);
      betsSilentRefresh.current = false;
      return;
    }
    betsSilentRefresh.current = false;
    let cancelled = false;
    const loadBets = () => {
      setBetsLoading(!betsSilentRefresh.current);
      fetch(`${API_BASE}/predictions/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((data: UserBetRow[]) => {
          if (cancelled) return;
          setMyBets(Array.isArray(data) ? data : []);
          setBetsError(null);
        })
        .catch(() => {
          if (cancelled) return;
          setBetsError('Could not load your bet history.');
        })
        .finally(() => {
          if (cancelled) return;
          setBetsLoading(false);
          betsSilentRefresh.current = true;
        });
    };
    loadBets();
    const bt = setInterval(loadBets, 30000);
    return () => {
      cancelled = true;
      clearInterval(bt);
    };
  }, [token]);

  const betStats = useMemo(() => {
    let won = 0;
    let lost = 0;
    let pending = 0;
    for (const b of myBets) {
      if (b.status === 'won') won += 1;
      else if (b.status === 'lost') lost += 1;
      else pending += 1;
    }
    return { won, lost, pending };
  }, [myBets]);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
        <header className="mb-12 flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <h1 className="text-4xl font-black mb-2">Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">{user?.username}</span></h1>
            <p className="text-gray-400">Ready to make some predictions? Check out the live matches below.</p>
          </div>
          
          <div className="bg-gray-800/80 p-4 rounded-2xl border border-gray-700/50 flex gap-6 shadow-xl backdrop-blur-sm shadow-indigo-900/20">
             <div className="text-center">
               <p className="text-sm text-gray-400 font-medium">Rank</p>
               <p className="text-2xl font-black text-white">#{user?.rank || '--'}</p>
             </div>
             <div className="w-px bg-gray-700"></div>
             <div className="text-center">
               <p className="text-sm text-gray-400 font-medium">Win Streak</p>
               <p className="text-2xl font-black text-emerald-400">{user?.currentStreak || 0} 🔥</p>
             </div>
          </div>
        </header>

        {token && (
          <section className="mb-12 rounded-3xl border border-gray-700/60 bg-gray-800/40 overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-6 py-5 border-b border-gray-700/50">
              <div>
                <h2 className="text-xl font-black text-white">Your bets</h2>
                <p className="text-sm text-gray-400 mt-1">
                  Wins, losses, and open bets across all matches
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-sm">
                <span className="rounded-full bg-emerald-500/15 text-emerald-300 px-3 py-1.5 border border-emerald-500/25 font-semibold">
                  Won {betStats.won}
                </span>
                <span className="rounded-full bg-red-500/15 text-red-300 px-3 py-1.5 border border-red-500/25 font-semibold">
                  Lost {betStats.lost}
                </span>
                <span className="rounded-full bg-amber-500/15 text-amber-200 px-3 py-1.5 border border-amber-500/25 font-semibold">
                  Pending {betStats.pending}
                </span>
              </div>
            </div>
            {betsError && (
              <div className="mx-6 mt-4 rounded-xl border border-amber-600/40 bg-amber-950/30 px-4 py-2 text-amber-100 text-sm">
                {betsError}
              </div>
            )}
            {betsLoading && myBets.length === 0 && !betsError ? (
              <div className="px-6 py-12 text-center text-gray-500 text-sm">Loading your bets…</div>
            ) : myBets.length === 0 && !betsError ? (
              <div className="px-6 py-10 text-center text-gray-500 text-sm">
                No bets yet. Join a live match and place a prediction.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm min-w-[720px]">
                  <thead>
                    <tr className="border-b border-gray-700/60 text-gray-500 uppercase tracking-wide text-xs">
                      <th className="px-6 py-3 font-semibold">When</th>
                      <th className="px-4 py-3 font-semibold">Match</th>
                      <th className="px-4 py-3 font-semibold">Type</th>
                      <th className="px-4 py-3 font-semibold">Pick</th>
                      <th className="px-4 py-3 font-semibold text-right">Stake</th>
                      <th className="px-4 py-3 font-semibold text-right">Odds</th>
                      <th className="px-4 py-3 font-semibold">Result</th>
                      <th className="px-6 py-3 font-semibold text-right">Coins</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700/40">
                    {myBets.map((b) => {
                      const when = b.createdAt
                        ? new Date(b.createdAt).toLocaleString(undefined, {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })
                        : '—';
                      const matchLabel = b.match
                        ? `${b.match.teamA} vs ${b.match.teamB}`
                        : 'Match';
                      const resultBadge =
                        b.status === 'won' ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 text-xs font-bold border border-emerald-500/30">
                            Win
                          </span>
                        ) : b.status === 'lost' ? (
                          <span className="inline-flex items-center rounded-full bg-red-500/20 text-red-300 px-2.5 py-0.5 text-xs font-bold border border-red-500/30">
                            Loss
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-amber-500/20 text-amber-200 px-2.5 py-0.5 text-xs font-bold border border-amber-500/30">
                            Pending
                          </span>
                        );
                      const coinsCell =
                        b.status === 'won' && b.payoutCoins != null ? (
                          <span className="text-emerald-400 font-mono font-bold">
                            +{b.payoutCoins.toLocaleString()}
                          </span>
                        ) : b.status === 'lost' ? (
                          <span className="text-red-400/90 font-mono font-bold">
                            −{b.amountStaked.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-gray-500 font-mono">—</span>
                        );
                      return (
                        <tr key={b.id} className="hover:bg-gray-800/50">
                          <td className="px-6 py-3.5 text-gray-400 whitespace-nowrap">{when}</td>
                          <td className="px-4 py-3.5">
                            <Link
                              href={`/matches/${b.matchId}`}
                              className="text-indigo-300 hover:text-indigo-200 font-medium underline-offset-2 hover:underline"
                            >
                              {matchLabel}
                            </Link>
                          </td>
                          <td className="px-4 py-3.5 text-gray-300 capitalize">{b.type}</td>
                          <td className="px-4 py-3.5 text-white font-medium">{b.predictionValue}</td>
                          <td className="px-4 py-3.5 text-right font-mono text-gray-200">
                            {b.amountStaked.toLocaleString()}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono text-gray-400">
                            {b.multiplier.toFixed(2)}×
                            {b.comboMultiplier > 1 && (
                              <span className="text-amber-400/90"> · {b.comboMultiplier.toFixed(1)}× combo</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5">{resultBadge}</td>
                          <td className="px-6 py-3.5 text-right">{coinsCell}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></span>
          IPL matches (live &amp; upcoming)
        </h2>

        {loadError && (
          <div className="mb-6 rounded-2xl border border-amber-600/40 bg-amber-950/30 px-4 py-3 text-amber-100 text-sm">
            {loadError}
          </div>
        )}

        {matches.length === 0 && !loadError ? (
           <div className="text-center p-12 bg-gray-800/50 rounded-3xl border border-gray-700/50 border-dashed">
             <p className="text-gray-400 mb-2">No matches synced yet.</p>
             <p className="text-gray-600 text-sm max-w-md mx-auto">
               Ensure the backend is running with MongoDB. The IPL poller fills this list from CricAPI or the Cricbuzz scraper (about every 2s).
             </p>
           </div>
        ) : matches.length === 0 ? null : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {matches.map((match) => (
              <Link href={`/matches/${match._id}`} key={match._id} className="block group">
                <div className="bg-gray-800/60 hover:bg-gray-800 border border-gray-700/50 hover:border-indigo-500/50 p-6 rounded-3xl transition-all transform hover:-translate-y-2 hover:shadow-2xl hover:shadow-indigo-500/10">
                  <div className="flex justify-between items-center mb-4">
                    <span
                      className={
                        match.status === 'live'
                          ? 'bg-red-500/10 text-red-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-red-500/20'
                          : 'bg-slate-500/10 text-slate-300 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-slate-500/20'
                      }
                    >
                      {match.status === 'live' ? 'Live' : 'Upcoming'}
                    </span>
                    <span className="text-gray-400 text-sm">
                      Over: {match.currentOver}.{match.currentBall}
                    </span>
                  </div>
                  <h3 className="text-2xl font-black text-white mb-6 flex justify-between items-center">
                    <span className="capitalize">{match.teamA}</span> 
                    <span className="text-gray-500 text-lg font-normal">vs</span> 
                    <span className="capitalize">{match.teamB}</span>
                  </h3>
                  <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700/50 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-400 capitalize truncate max-w-[55%]">{match.teamA}</span>
                      <span className="font-mono text-lg font-bold text-white">
                        {match.scoreA}/{match.wicketsA}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-400 capitalize truncate max-w-[55%]">{match.teamB}</span>
                      <span className="font-mono text-lg font-bold text-white">
                        {match.scoreB}/{match.wicketsB}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
