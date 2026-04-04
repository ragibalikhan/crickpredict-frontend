export const MIN_STAKE_COINS = 10;
export const MAX_STAKE_COINS = 10_000;

export function clampStakeAmount(raw: number): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n)) return MIN_STAKE_COINS;
  return Math.min(MAX_STAKE_COINS, Math.max(MIN_STAKE_COINS, n));
}
