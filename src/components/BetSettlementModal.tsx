'use client';

import { useStore } from '../store/store';

/**
 * Win/lose overlay — same pattern as the match page “Bet placed” popup (fixed backdrop + card + OK).
 * Rendered from the root layout so it appears on every route when the socket settles a bet.
 */
export default function BetSettlementModal() {
  const betSettlementResult = useStore((s) => s.betSettlementResult);
  const setBetSettlementResult = useStore((s) => s.setBetSettlementResult);
  const coinsBalance = useStore((s) => s.user?.coinsBalance);

  if (!betSettlementResult) return null;

  const { won, stake, payout, predictionType } = betSettlementResult;
  const typeLabel =
    predictionType === 'ball'
      ? 'Ball'
      : predictionType === 'over'
        ? 'Over'
        : predictionType === 'batsman'
          ? 'Batsman'
          : predictionType || 'Bet';

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="settlement-title"
    >
      <div
        key={betSettlementResult.predictionId}
        className={`w-full max-w-md rounded-3xl border bg-gray-900 p-8 shadow-2xl text-center ${
          won
            ? 'border-emerald-500/40 shadow-emerald-900/30'
            : 'border-amber-600/50 shadow-amber-950/30'
        }`}
      >
        <div className="text-5xl mb-3">{won ? '🎉' : '📉'}</div>
        <h2 id="settlement-title" className="text-2xl font-black text-white mb-2">
          {won ? 'You won!' : 'You lost'}
        </h2>
        <p className="text-gray-300 text-sm leading-relaxed mb-1">
          {won
            ? `Your ${typeLabel} prediction was correct.`
            : `Your ${typeLabel} prediction did not land this time.`}
        </p>
        <div className="mt-4 rounded-2xl bg-gray-800/80 border border-gray-700/80 p-4 space-y-2 text-center">
          {won ? (
            <p className="text-emerald-300 font-mono text-lg font-bold">
              +{payout.toLocaleString()} <span className="text-yellow-400">🪙</span> paid out
            </p>
          ) : (
            <p className="text-amber-200/90 font-mono text-lg font-bold">
              −{stake.toLocaleString()} <span className="text-yellow-400">🪙</span> stake
            </p>
          )}
          {typeof coinsBalance === 'number' && (
            <p className="text-gray-500 text-xs font-medium">
              New balance:{' '}
              <span className="text-gray-200 font-mono tabular-nums">{coinsBalance.toLocaleString()}</span> coins
            </p>
          )}
        </div>
        <p className="text-gray-500 text-xs mt-4">
          {won ? 'Winnings are added to your balance.' : 'Better luck on the next delivery.'}
        </p>
        <button
          type="button"
          onClick={() => setBetSettlementResult(null)}
          className={`mt-6 w-full rounded-xl py-3 font-bold text-white transition ${
            won ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-amber-700 hover:bg-amber-600'
          }`}
        >
          OK
        </button>
      </div>
    </div>
  );
}
