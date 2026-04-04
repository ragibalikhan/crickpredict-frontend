'use client';

import { useEffect } from 'react';
import { useStore } from '../store/store';
import { API_BASE } from '../lib/api';
import { handlePredictionResultEvent } from '../lib/predictionResultHandler';

/** Only consider outcomes this fresh so we don't replay ancient history on every poll */
const MAX_SETTLEMENT_AGE_MS = 120_000;

/**
 * If Socket.IO misses `prediction_result`, poll recent predictions and show the same win/lose popup
 * after coins are updated on the server.
 */
export default function SettlementRecovery() {
  const token = useStore((s) => s.token);
  const userId = useStore((s) => s.user?.id);

  useEffect(() => {
    if (!token || !userId) return;

    const tick = async () => {
      try {
        const [predRes, profRes] = await Promise.all([
          fetch(`${API_BASE}/predictions/me`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE}/users/profile`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        if (!predRes.ok) return;
        const predictions = (await predRes.json()) as Array<{
          id: string;
          status: string;
          amountStaked: number;
          payoutCoins: number | null;
          type: string;
          updatedAt?: string;
        }>;
        const profile = profRes.ok ? await profRes.json() : null;
        const balance = typeof profile?.coinsBalance === 'number' ? profile.coinsBalance : undefined;
        const now = Date.now();

        for (const p of predictions) {
          if (p.status !== 'won' && p.status !== 'lost') continue;
          const uAt = p.updatedAt ? new Date(p.updatedAt).getTime() : 0;
          if (!uAt || now - uAt > MAX_SETTLEMENT_AGE_MS) continue;

          handlePredictionResultEvent({
            won: p.status === 'won',
            coinsBalance: balance ?? useStore.getState().user?.coinsBalance ?? 0,
            predictionId: p.id,
            stake: p.amountStaked,
            payout: p.payoutCoins ?? 0,
            predictionType: p.type,
            targetUserId: userId,
          });
        }
      } catch {
        /* ignore */
      }
    };

    const iv = setInterval(tick, 5000);
    tick();
    return () => clearInterval(iv);
  }, [token, userId]);

  return null;
}
