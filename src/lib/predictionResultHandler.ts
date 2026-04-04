import { useStore } from '../store/store';

const handledIds = new Set<string>();

export type PredictionResultPayload = {
  won: boolean;
  coinsBalance: number;
  predictionId: string;
  stake: number;
  payout: number;
  predictionType: string;
};

/**
 * Single entry for settlement: updates balance, opens global BetSettlementModal (same UX as “Bet placed”),
 * and pushes a notification. Deduplicates when both Socket.IO connections receive the same event.
 */
export function handlePredictionResultEvent(data: PredictionResultPayload): void {
  const id = String(data.predictionId || '');
  if (!id || handledIds.has(id)) return;
  handledIds.add(id);
  if (handledIds.size > 400) {
    const it = handledIds.values();
    for (let i = 0; i < 100; i++) {
      const v = it.next();
      if (v.done) break;
      handledIds.delete(v.value);
    }
  }

  if (typeof data.coinsBalance === 'number' && Number.isFinite(data.coinsBalance)) {
    useStore.getState().updateCoins(data.coinsBalance);
  }

  const won = !!data.won;
  const payout = Number(data.payout) || 0;
  const stake = Number(data.stake) || 0;

  useStore.getState().setBetSettlementResult({
    won,
    stake,
    payout,
    predictionId: id,
    predictionType: data.predictionType,
  });

  const bal =
    typeof data.coinsBalance === 'number' && Number.isFinite(data.coinsBalance)
      ? data.coinsBalance
      : useStore.getState().user?.coinsBalance ?? 0;

  useStore.getState().addNotification({
    _id: `pred-result-${id}`,
    title: won ? 'You won the bet!' : 'You lost the bet',
    message: won
      ? `+${payout.toLocaleString()} coins. Balance: ${bal.toLocaleString()}`
      : `Stake ${stake.toLocaleString()} not returned. Balance: ${bal.toLocaleString()}`,
    type: won ? 'success' : 'warning',
    read: false,
    createdAt: new Date().toISOString(),
  });
}
