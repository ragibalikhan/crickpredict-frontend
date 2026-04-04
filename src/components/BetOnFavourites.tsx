'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { API_BASE } from '../lib/api';

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

export default function BetOnFavourites() {
  const [items, setItems] = useState<HomeItem[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'ok' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/player-props/home`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { items?: HomeItem[] } | null) => {
        if (cancelled || !data) {
          if (!cancelled) setLoadState('error');
          return;
        }
        setItems(Array.isArray(data.items) ? data.items : []);
        setLoadState('ok');
      })
      .catch(() => {
        if (!cancelled) setLoadState('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loadState === 'loading') {
    return (
      <section className="w-full max-w-6xl mx-auto px-4 py-12 md:py-16">
        <h2 className="text-2xl md:text-3xl font-black text-white text-center mb-8">Bet on Favourites</h2>
        <div className="flex justify-center py-12">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        </div>
      </section>
    );
  }

  if (loadState === 'error') {
    return null;
  }

  if (items.length === 0) {
    return (
      <section className="w-full max-w-6xl mx-auto px-4 py-10 md:py-12 border-t border-gray-800/80">
        <h2 className="text-xl md:text-2xl font-black text-white text-center mb-2">Bet on Favourites</h2>
        <p className="text-center text-sm text-gray-500">No pre-match player picks right now — check back after admins publish markets.</p>
      </section>
    );
  }

  return (
    <section className="w-full max-w-6xl mx-auto px-4 py-12 md:py-16 border-t border-gray-800/80">
      <div className="text-center mb-10">
        <h2 className="text-2xl md:text-3xl font-black text-white mb-2">Bet on Favourites</h2>
        <p className="text-gray-400 text-sm md:text-base max-w-2xl mx-auto">
          Pre-match player picks — runs and wickets milestones. Betting closes when the match goes live.
        </p>
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
              <Link
                href={`/matches/${row.matchId}?tab=player_props`}
                className="shrink-0 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white transition"
              >
                Bet now
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
