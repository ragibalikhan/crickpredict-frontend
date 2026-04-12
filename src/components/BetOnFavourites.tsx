'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { API_BASE } from '../lib/api';
import { formatInr } from '../lib/moneyDisplay';
import { useStore } from '../store/store';
import { clampStakeAmount, MAX_STAKE_COINS, MIN_STAKE_COINS } from '../lib/betLimits';

type HomeItem = {
  matchId: string;
  teamA: string;
  teamB: string;
  scheduledStartAt?: string;
  bettingOpen: boolean;
  market: {
    id: string;
    teamName: string;
    playerName: string;
    statType: string;
    threshold: number;
    multiplier: number;
    label: string;
    playerImageUrl: string | null;
  };
};

function formatMultiplierLabel(n: number): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const rounded = Math.round(n * 10) / 10;
  return `${Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)}×`;
}

/**
 * Logged-in dashboard: pre-match player props with stake + Place bet (no match-page tab).
 */
export default function BetOnFavourites() {
  const { token, user, updateCoins } = useStore();
  const [items, setItems] = useState<HomeItem[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [stakeInput, setStakeInput] = useState(String(MIN_STAKE_COINS));
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const loadFeed = useCallback(() => {
    fetch(`${API_BASE}/player-props/home`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { items?: HomeItem[] } | null) => {
        if (!data) {
          setLoadState('error');
          return;
        }
        setItems(Array.isArray(data.items) ? data.items : []);
        setLoadState('ok');
      })
      .catch(() => setLoadState('error'));
  }, []);

  useEffect(() => {
    loadFeed();
    const t = setInterval(loadFeed, 15_000);
    return () => clearInterval(t);
  }, [loadFeed]);

  useEffect(() => {
    if (!toast) return;
    const x = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(x);
  }, [toast]);

  const placeBet = async (marketId: string, label: string) => {
    if (!token) return;
    const stake = clampStakeAmount(Number(stakeInput) || 0);
    setStakeInput(String(stake));
    setBusyId(marketId);
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
        setToast(`Bet placed: ${formatInr(stake)} on ${label}`);
        loadFeed();
      } else {
        alert((data as { message?: string })?.message || 'Could not place bet.');
      }
    } catch {
      alert('Could not reach the server.');
    } finally {
      setBusyId(null);
    }
  };

  if (loadState === 'loading') {
    return (
      <section className="w-full mb-10 sm:mb-12">
        <h2 className="text-2xl md:text-3xl font-black text-white text-center mb-8">Bet on Favourites</h2>
        <div className="flex justify-center py-12">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        </div>
      </section>
    );
  }

  if (loadState === 'error') {
    return (
      <section className="w-full mb-10 sm:mb-12 rounded-2xl border border-amber-600/30 bg-amber-950/20 px-4 py-6 text-center text-amber-100 text-sm">
        Could not load Bet on Favourites. Check that the API is running.
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="w-full mb-10 sm:mb-12 rounded-2xl border border-gray-700/50 bg-gray-800/30 px-4 py-8">
        <h2 className="text-xl md:text-2xl font-black text-white text-center mb-2">Bet on Favourites</h2>
        <p className="text-center text-sm text-gray-500">
          No pre-match player picks right now — check back after admins publish markets.
        </p>
      </section>
    );
  }

  return (
    <section className="w-full mb-10 sm:mb-12">
      {toast && (
        <div className="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-950/50 px-4 py-3 text-center text-sm text-emerald-100">
          {toast}
        </div>
      )}

      <div className="text-center mb-6">
        <h2 className="text-2xl md:text-3xl font-black text-white mb-2">Bet on Favourites</h2>
        <p className="text-gray-400 text-sm md:text-base max-w-2xl mx-auto mb-4">
          Pre-match player picks — runs and wickets milestones. Betting closes when the match goes live.
        </p>

        {token ? (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 flex-wrap">
            <span className="text-sm text-gray-400">
              Balance:{' '}
              <span className="font-mono font-bold text-yellow-400 tabular-nums">
                {formatInr(user?.coinsBalance ?? 0)}
              </span>
            </span>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500">Stake (INR)</label>
              <input
                type="text"
                inputMode="numeric"
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
                onBlur={() => setStakeInput(String(clampStakeAmount(Number(stakeInput) || 0)))}
                className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 w-28 text-center font-mono font-bold text-white"
              />
              <span className="text-[10px] text-gray-600">
                {formatInr(MIN_STAKE_COINS)}–{formatInr(MAX_STAKE_COINS)}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            <Link href="/login" className="text-indigo-400 font-semibold hover:underline">
              Log in
            </Link>{' '}
            to place bets on player picks.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {items.map((row) => (
          <article
            key={`${row.matchId}-${row.market.id}`}
            className="rounded-2xl border border-gray-700/60 bg-gray-800/40 backdrop-blur-sm overflow-hidden flex flex-col hover:border-emerald-500/40 transition-colors"
          >
            <div className="p-4 flex gap-4 items-start">
              <div className="shrink-0 w-20 h-20 rounded-2xl bg-gray-900 border border-gray-700 overflow-hidden flex items-center justify-center">
                {row.market.playerImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={row.market.playerImageUrl}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <span className="text-3xl font-black text-gray-600" aria-hidden>
                    {row.market.playerName.slice(0, 1).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="text-lg font-black text-white leading-tight truncate">{row.market.playerName}</p>
                <p className="text-xs text-gray-500 uppercase tracking-wide truncate">{row.market.teamName}</p>
                <p className="text-sm text-gray-300 mt-1 line-clamp-2">{row.market.label}</p>
              </div>
            </div>

            <div className="px-4 pb-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <span className="capitalize">{row.teamA}</span>
              <span>vs</span>
              <span className="capitalize">{row.teamB}</span>
              {row.scheduledStartAt && (
                <span className="text-gray-600 w-full sm:w-auto">
                  · {new Date(row.scheduledStartAt).toLocaleString()}
                </span>
              )}
            </div>

            <div className="mt-auto p-4 pt-0 flex items-center justify-between gap-3">
              <span className="inline-flex rounded-full bg-amber-500/15 px-3 py-1 text-amber-200 font-mono font-black text-sm tabular-nums ring-1 ring-amber-400/30">
                {formatMultiplierLabel(row.market.multiplier)}
              </span>
              {token ? (
                <button
                  type="button"
                  disabled={busyId != null || !row.bettingOpen}
                  onClick={() => placeBet(row.market.id, row.market.label)}
                  className="shrink-0 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:pointer-events-none px-4 py-2.5 text-sm font-bold text-white transition"
                >
                  {busyId === row.market.id ? '…' : 'Place bet'}
                </button>
              ) : (
                <Link
                  href="/login"
                  className="shrink-0 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 text-sm font-bold text-white transition"
                >
                  Log in
                </Link>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
