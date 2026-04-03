'use client';
import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../../store/store';
import Link from 'next/link';
import { API_BASE } from '../../lib/api';

export default function ProfilePage() {
  const { user, token } = useStore();
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'bets'>('overview');

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

  const [myBets, setMyBets] = useState<UserBetRow[]>([]);
  const [betsLoading, setBetsLoading] = useState(false);
  const [betsError, setBetsError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/users/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setProfileData(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    if (activeTab !== 'bets') return;

    let cancelled = false;
    setBetsLoading(true);
    setBetsError(null);

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
      })
      .catch(() => {
        if (cancelled) return;
        setBetsError('Could not load your bet history.');
      })
      .finally(() => {
        if (cancelled) return;
        setBetsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, activeTab]);

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

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6 text-white text-center">
        <h2 className="text-2xl font-bold">Please log in to view your profile.</h2>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 md:p-12 relative overflow-hidden">
      {/* Decorative background */}
      <div className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] bg-purple-600/30 rounded-full mix-blend-multiply filter blur-[150px]"></div>

      <div className="max-w-4xl mx-auto relative z-10">
        <h1 className="text-4xl font-black mb-8 border-b border-gray-800 pb-4">My Player Profile</h1>

        <div className="flex gap-3 flex-wrap mb-6">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-5 py-2 rounded-xl font-bold transition ${
              activeTab === 'overview'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'bg-gray-800/40 text-gray-300 hover:bg-gray-800/70'
            }`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('bets')}
            className={`px-5 py-2 rounded-xl font-bold transition ${
              activeTab === 'bets'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'bg-gray-800/40 text-gray-300 hover:bg-gray-800/70'
            }`}
          >
            Your Bets
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center p-24">
             <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : activeTab === 'bets' ? (
          <div className="space-y-6">
            <div className="bg-gray-800/40 rounded-3xl p-8 border border-gray-700/50 backdrop-blur-sm">
              <h3 className="text-2xl font-bold mb-2">Bet History</h3>
              <p className="text-sm text-gray-400 mb-5">Wins, losses, and pending bets across all matches.</p>

              <div className="flex flex-wrap gap-3 mb-5">
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

              {betsError && (
                <div className="mb-4 rounded-xl border border-amber-600/40 bg-amber-950/30 px-4 py-3 text-amber-100 text-sm">
                  {betsError}
                </div>
              )}

              {betsLoading && myBets.length === 0 ? (
                <div className="px-6 py-12 text-center text-gray-500 text-sm">Loading your bets…</div>
              ) : myBets.length === 0 ? (
                <div className="px-6 py-10 text-center text-gray-500 text-sm">No bets yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm min-w-[720px]">
                    <thead>
                      <tr className="border-b border-gray-700/60 text-gray-500 uppercase tracking-wide text-xs">
                        <th className="px-4 py-3 font-semibold">When</th>
                        <th className="px-4 py-3 font-semibold">Match</th>
                        <th className="px-4 py-3 font-semibold">Type</th>
                        <th className="px-4 py-3 font-semibold">Pick</th>
                        <th className="px-4 py-3 font-semibold text-right">Stake</th>
                        <th className="px-4 py-3 font-semibold text-right">Odds</th>
                        <th className="px-4 py-3 font-semibold">Result</th>
                        <th className="px-4 py-3 font-semibold text-right">Coins</th>
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
                        const matchLabel = b.match ? `${b.match.teamA} vs ${b.match.teamB}` : 'Match';
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
                            <span className="text-emerald-400 font-mono font-bold">+{b.payoutCoins.toLocaleString()}</span>
                          ) : b.status === 'lost' ? (
                            <span className="text-red-400/90 font-mono font-bold">−{b.amountStaked.toLocaleString()}</span>
                          ) : (
                            <span className="text-gray-500 font-mono">—</span>
                          );

                        return (
                          <tr key={b.id} className="hover:bg-gray-800/50">
                            <td className="px-4 py-3.5 text-gray-400 whitespace-nowrap">{when}</td>
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
                            <td className="px-4 py-3.5 text-right font-mono text-gray-200">{b.amountStaked.toLocaleString()}</td>
                            <td className="px-4 py-3.5 text-right font-mono text-gray-400">
                              {b.multiplier.toFixed(2)}×
                              {b.comboMultiplier > 1 && (
                                <span className="text-amber-400/90"> · {b.comboMultiplier.toFixed(1)}× combo</span>
                              )}
                            </td>
                            <td className="px-4 py-3.5">{resultBadge}</td>
                            <td className="px-4 py-3.5 text-right">{coinsCell}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Profile Info */}
            <div className="lg:col-span-1 border border-gray-700/50 rounded-3xl p-8 bg-gray-800/60 backdrop-blur-md shadow-xl text-center relative overflow-hidden group">
              <div className="w-32 h-32 mx-auto rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-5xl text-white font-bold mb-6 shadow-[0_0_40px_rgba(99,102,241,0.5)] border-4 border-gray-800 relative z-10 group-hover:scale-110 transition-transform duration-500">
                  {profileData?.username?.charAt(0).toUpperCase()}
              </div>
              <h2 className="text-2xl font-black text-white">{profileData?.username}</h2>
              <p className="text-gray-400 text-sm mb-6">{profileData?.email}</p>
              
              <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700/50">
                 <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-1">Global Rank</p>
                 <p className="text-3xl font-black text-white">#{profileData?.rank || '--'}</p>
              </div>

              <div className="mt-6">
                <Link href="/wallet" className="block w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition shadow-lg shadow-indigo-600/20">
                  Manage Wallet
                </Link>
              </div>
            </div>

            {/* Statistics */}
            <div className="lg:col-span-2 space-y-6">
               <div className="bg-gray-800/40 rounded-3xl p-8 border border-gray-700/50 backdrop-blur-sm">
                  <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <span className="text-2xl">📊</span> Career Statistics
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                     <div className="bg-gray-900/50 p-6 rounded-2xl border border-gray-700/30 text-center">
                        <p className="text-sm text-gray-400 font-medium tracking-wider mb-2">Total Balance</p>
                        <p className="text-4xl font-black text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.3)]">🪙 {profileData?.coinsBalance}</p>
                     </div>
                     <div className="bg-gray-900/50 p-6 rounded-2xl border border-gray-700/30 text-center">
                        <p className="text-sm text-gray-400 font-medium tracking-wider mb-2">Current Streak</p>
                        <p className="text-4xl font-black text-emerald-400">{profileData?.currentStreak || 0} 🔥</p>
                     </div>
                     <div className="bg-gray-900/50 p-6 rounded-2xl border border-gray-700/30 text-center">
                        <p className="text-sm text-gray-400 font-medium tracking-wider mb-2">Highest Streak</p>
                        <p className="text-4xl font-black text-purple-400">{profileData?.highestStreak || 0} ⭐</p>
                     </div>
                     <div className="bg-gray-900/50 p-6 rounded-2xl border border-gray-700/30 text-center">
                        <p className="text-sm text-gray-400 font-medium tracking-wider mb-2">Total Wins</p>
                        <p className="text-4xl font-black text-white">{profileData?.totalWins || 0}</p>
                     </div>
                  </div>
               </div>

               <div className="bg-gray-800/40 rounded-3xl p-8 border border-gray-700/50 backdrop-blur-sm">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <span className="text-2xl">⚡</span> Recent Activity
                  </h3>
                  <div className="flex flex-col items-center justify-center py-10 bg-gray-900/30 rounded-2xl border border-gray-700/30 border-dashed">
                      <p className="text-gray-500 mb-2">View your wins/losses in the “Your Bets” tab.</p>
                      <Link href="/dashboard" className="text-indigo-400 hover:text-indigo-300 font-medium transition">
                        View Live Matches
                      </Link>
                  </div>
               </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
