'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useStore } from '../../store/store';
import { API_BASE } from '../../lib/api';
import TeamAvatar from '../../components/TeamAvatar';

export default function Dashboard() {
  const { user, token } = useStore();
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
    if (typeof window !== 'undefined' && sessionStorage.getItem('signup_bonus_toast')) {
      // Small delay to ensure the UI is rendered
      setTimeout(() => {
        alert('🎉 You received 50 coins signup bonus! Deposit ₹100 to unlock it.');
        sessionStorage.removeItem('signup_bonus_toast');
      }, 500);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:p-6 md:p-12 touch-manipulation">
      <div className="max-w-6xl mx-auto w-full min-w-0">
        <header className="mb-8 sm:mb-12 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-6">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {matches.map((match) => (
              <Link href={`/matches/${match._id}`} key={match._id} className="block group min-w-0">
                <div className="bg-gray-800/60 hover:bg-gray-800 border border-gray-700/50 hover:border-indigo-500/50 p-4 sm:p-6 rounded-2xl sm:rounded-3xl transition-all sm:transform sm:hover:-translate-y-2 sm:hover:shadow-2xl sm:hover:shadow-indigo-500/10 active:scale-[0.99]">
                  <div className="flex justify-between items-center mb-3 sm:mb-4 gap-2">
                    <span
                      className={
                        match.status === 'live'
                          ? 'bg-red-500/10 text-red-400 px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider border border-red-500/20 shrink-0'
                          : 'bg-slate-500/10 text-slate-300 px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider border border-slate-500/20 shrink-0'
                      }
                    >
                      {match.status === 'live' ? 'Live' : 'Upcoming'}
                    </span>
                    <span className="text-gray-400 text-xs sm:text-sm truncate">
                      Over {match.currentOver}.{match.currentBall}
                    </span>
                  </div>
                  <div className="flex items-center justify-center gap-2 sm:gap-4 mb-4 sm:mb-6 min-w-0">
                    <TeamAvatar teamName={match.teamA} size={44} className="sm:w-12 sm:h-12 shrink-0" />
                    <span className="text-gray-500 text-sm sm:text-lg font-medium shrink-0">vs</span>
                    <TeamAvatar teamName={match.teamB} size={44} className="sm:w-12 sm:h-12 shrink-0" />
                  </div>
                  <h3 className="text-base sm:text-xl font-black text-white mb-4 text-center leading-snug line-clamp-2 min-h-[2.5rem]">
                    <span className="capitalize">{match.teamA}</span>
                    <span className="text-gray-500 font-normal mx-1.5">vs</span>
                    <span className="capitalize">{match.teamB}</span>
                  </h3>
                  <div className="bg-gray-900/50 p-3 sm:p-4 rounded-xl border border-gray-700/50 space-y-2.5 sm:space-y-3">
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-xs sm:text-sm text-gray-400 capitalize truncate min-w-0 flex items-center gap-2">
                        <TeamAvatar teamName={match.teamA} size={28} className="shrink-0" />
                        {match.teamA}
                      </span>
                      <span className="font-mono text-base sm:text-lg font-bold text-white tabular-nums shrink-0">
                        {match.scoreA}/{match.wicketsA}
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-xs sm:text-sm text-gray-400 capitalize truncate min-w-0 flex items-center gap-2">
                        <TeamAvatar teamName={match.teamB} size={28} className="shrink-0" />
                        {match.teamB}
                      </span>
                      <span className="font-mono text-base sm:text-lg font-bold text-white tabular-nums shrink-0">
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
