import { useStore } from '../store/store';
import { formatInr } from './moneyDisplay';

const handledIds = new Set<string>();
const STORAGE_KEY = 'crickpredict_settlement_ids_v1';
let loadedFromStorage = false;

function loadHandledFromStorage() {
  if (typeof window === 'undefined' || loadedFromStorage) return;
  loadedFromStorage = true;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw) as string[];
      arr.forEach((id) => handledIds.add(id));
    }
  } catch {
    /* ignore */
  }
}

function persistHandledIds() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...handledIds].slice(-400)));
  } catch {
    /* ignore */
  }
}

export type PredictionResultPayload = {
  won: boolean;
  coinsBalance: number;
  predictionId: string;
  stake: number;
  payout: number;
  predictionType: string;
  /** Present when event is broadcast on match_* — only this user should react */
  targetUserId?: string;
  matchId?: string;
};

/**
 * Single entry for settlement: updates balance, opens global BetSettlementModal (same UX as “Bet placed”),
 * and pushes a notification. Deduplicates when both Socket.IO connections receive the same event.
 */
export function handlePredictionResultEvent(data: PredictionResultPayload): void {
  loadHandledFromStorage();

  const me = useStore.getState().user?.id;
  if (data.targetUserId != null && me != null && String(data.targetUserId) !== String(me)) {
    return;
  }

  const id = String(data.predictionId || '');
  if (!id || handledIds.has(id)) return;
  handledIds.add(id);
  persistHandledIds();
  if (handledIds.size > 400) {
    const it = handledIds.values();
    for (let i = 0; i < 100; i++) {
      const v = it.next();
      if (v.done) break;
      handledIds.delete(v.value);
    }
    persistHandledIds();
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
      ? `+${formatInr(payout)}. Balance: ${formatInr(bal)}`
      : `Stake ${formatInr(stake)} not returned. Balance: ${formatInr(bal)}`,
    type: won ? 'success' : 'warning',
    read: false,
    createdAt: new Date().toISOString(),
  });
}
