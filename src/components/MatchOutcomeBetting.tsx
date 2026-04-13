'use client';

import { useCallback, useEffect, useState } from 'react';
import { API_BASE } from '../lib/api';
import { formatInr } from '../lib/moneyDisplay';

type OutcomeOddsPayload = {
  teamA: string;
  teamB: string;
  status: string;
  tossWinnerSide?: string | null;
  betting: {
    toss: { open: boolean; multiplier: number };
    matchWinner: {
      open: boolean;
      probA: number;
      probB: number;
      multiplierA: number;
      multiplierB: number;
    };
    liveMatchWinner: {
      open: boolean;
      probA: number;
      probB: number;
      multiplierA: number;
      multiplierB: number;
    };
  };
};

function fmtMult(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const r = Math.round(n * 10) / 10;
  return `${Number.isInteger(r) ? String(r) : r.toFixed(1)}×`;
}

export default function MatchOutcomeBetting(props: {
  matchId: string;
  teamA: string;
  teamB: string;
  status: string;
  token: string | null;
  stake: number;
  onBalance: (coins: number) => void;
}) {
  const { matchId, teamA, teamB, status, token, stake, onBalance } = props;
  const [odds, setOdds] = useState<OutcomeOddsPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`${API_BASE}/predictions/match/${matchId}/outcome-odds`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: OutcomeOddsPayload | null) => {
        if (data?.betting) setOdds(data);
      })
      .catch(() => {});
  }, [matchId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  const place = async (kind: 'toss' | 'match_winner' | 'live_match_winner', side: 'A' | 'B') => {
    if (!token) {
      alert('Please log in to place a bet.');
      return;
    }
    setBusy(`${kind}-${side}`);
    setErr(null);
    try {
      const res = await fetch(`${API_BASE}/predictions/outcome-bet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          matchId,
          kind,
          side,
          amountStaked: stake,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && typeof data.coinsBalance === 'number') {
        onBalance(data.coinsBalance);
      } else {
        setErr(typeof data?.message === 'string' ? data.message : 'Could not place bet.');
      }
    } catch {
      setErr('Network error — try again.');
    } finally {
      setBusy(null);
    }
  };

  if (!odds) return null;

  const b = odds.betting;
  const showAny =
    (status === 'upcoming' && (b.toss.open || b.matchWinner.open)) ||
    (status === 'live' && b.liveMatchWinner.open);

  if (!showAny) return null;

  return (
    <section className="mb-8 rounded-2xl border border-emerald-700/40 bg-emerald-950/20 p-5 md:p-6">
      <h3 className="text-lg font-black text-emerald-200 mb-1">Match markets</h3>
      <p className="text-xs text-gray-500 mb-4">
        Toss &amp; pre-match winner close before start. Live match-winner uses live win % — your multiplier is{' '}
        <strong className="text-gray-300">locked at bet time</strong>.
      </p>

      {err && (
        <p className="text-sm text-red-300 mb-3" role="alert">
          {err}
        </p>
      )}

      {status === 'upcoming' && b.toss.open && (
        <div className="mb-5 pb-5 border-b border-gray-700/50">
          <p className="text-sm font-bold text-white mb-2">🪙 Toss winner</p>
          <p className="text-xs text-gray-500 mb-3">Fixed {fmtMult(b.toss.multiplier)} · pick a side</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!!busy}
              onClick={() => place('toss', 'A')}
              className="flex-1 min-w-[8rem] rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-600 py-2.5 px-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy === 'toss-A' ? '…' : `${teamA} · ${fmtMult(b.toss.multiplier)}`}
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => place('toss', 'B')}
              className="flex-1 min-w-[8rem] rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-600 py-2.5 px-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy === 'toss-B' ? '…' : `${teamB} · ${fmtMult(b.toss.multiplier)}`}
            </button>
          </div>
        </div>
      )}

      {status === 'upcoming' && b.matchWinner.open && (
        <div className="mb-2">
          <p className="text-sm font-bold text-white mb-2">🏆 Match winner (pre-match)</p>
          <p className="text-xs text-gray-500 mb-3">
            Est. {(b.matchWinner.probA * 100).toFixed(1)}% / {(b.matchWinner.probB * 100).toFixed(1)}% — multipliers from odds
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!!busy}
              onClick={() => place('match_winner', 'A')}
              className="flex-1 min-w-[8rem] rounded-xl bg-indigo-900/50 hover:bg-indigo-800/60 border border-indigo-600/50 py-2.5 px-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy === 'match_winner-A' ? '…' : `${teamA} · ${fmtMult(b.matchWinner.multiplierA)}`}
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => place('match_winner', 'B')}
              className="flex-1 min-w-[8rem] rounded-xl bg-indigo-900/50 hover:bg-indigo-800/60 border border-indigo-600/50 py-2.5 px-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy === 'match_winner-B' ? '…' : `${teamB} · ${fmtMult(b.matchWinner.multiplierB)}`}
            </button>
          </div>
        </div>
      )}

      {status === 'live' && b.liveMatchWinner.open && (
        <div className="mt-4">
          <p className="text-sm font-bold text-white mb-2">📊 Live match winner</p>
          <p className="text-xs text-gray-500 mb-3">
            Live ~{(b.liveMatchWinner.probA * 100).toFixed(1)}% / {(b.liveMatchWinner.probB * 100).toFixed(1)}% — bet locks current multiplier
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!!busy}
              onClick={() => place('live_match_winner', 'A')}
              className="flex-1 min-w-[8rem] rounded-xl bg-amber-900/40 hover:bg-amber-800/50 border border-amber-600/40 py-2.5 px-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy === 'live_match_winner-A' ? '…' : `${teamA} · ${fmtMult(b.liveMatchWinner.multiplierA)}`}
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => place('live_match_winner', 'B')}
              className="flex-1 min-w-[8rem] rounded-xl bg-amber-900/40 hover:bg-amber-800/50 border border-amber-600/40 py-2.5 px-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy === 'live_match_winner-B' ? '…' : `${teamB} · ${fmtMult(b.liveMatchWinner.multiplierB)}`}
            </button>
          </div>
        </div>
      )}

      <p className="text-[10px] text-gray-600 mt-4">
        Stake for these buttons uses the same amount as ball betting: {formatInr(stake)} (wallet / INR display).
      </p>
    </section>
  );
}
