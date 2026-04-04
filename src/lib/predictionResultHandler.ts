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
 * Single entry for settlement: updates balance, shows native alert + in-app modal, notification.
 * Deduplicates when both global and match Socket.IO connections receive the same event.
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
  const bal =
    typeof data.coinsBalance === 'number' && Number.isFinite(data.coinsBalance)
      ? data.coinsBalance
      : useStore.getState().user?.coinsBalance ?? 0;

  const alertMsg = won
    ? `You won!\n+${payout.toLocaleString()} coins paid out.\nNew balance: ${bal.toLocaleString()} coins.`
    : `You lost this bet.\nStake ${stake.toLocaleString()} coins was not returned.\nBalance: ${bal.toLocaleString()} coins.`;

  if (typeof window !== 'undefined') {
    window.alert(alertMsg);
  }

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
