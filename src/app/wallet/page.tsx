'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useStore } from '../../store/store';
import { API_BASE } from '../../lib/api';
import { formatInr, publicUploadUrl } from '../../lib/moneyDisplay';

type DepositInfo = {
  coinsPerInr: number;
  accounts: {
    _id: string;
    label: string;
    kind: string;
    upiId?: string;
    upiQrPath?: string;
    bankName?: string;
    accountNumber?: string;
    ifsc?: string;
    accountHolderName?: string;
    isPrimary?: boolean;
  }[];
};

export default function WalletPage() {
  const { user, token } = useStore();
  const [amountInr, setAmountInr] = useState(100);
  const [upiId, setUpiId] = useState('');
  const [loading, setLoading] = useState(false);
  const [transactionType, setTransactionType] = useState<'deposit' | 'withdraw'>('deposit');
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [depositRequests, setDepositRequests] = useState<any[]>([]);
  const [depositInfo, setDepositInfo] = useState<DepositInfo | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [utrReference, setUtrReference] = useState('');
  const [activeHistoryTab, setActiveHistoryTab] = useState<'transactions' | 'withdrawals' | 'deposits'>('transactions');

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const fetchDepositInfo = useCallback(async () => {
    if (!token) return;
    const res = await fetch(`${API_BASE}/users/wallet/deposit-info`, {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    if (res.ok) setDepositInfo(await res.json());
  }, [token]);

  const fetchHistory = useCallback(async () => {
    if (!token) return;
    const [wRes, tRes, dRes] = await Promise.all([
      fetch(`${API_BASE}/users/wallet/withdrawals`, { headers }),
      fetch(`${API_BASE}/users/wallet/transactions`, { headers }),
      fetch(`${API_BASE}/users/wallet/deposits`, { headers }),
    ]);
    if (wRes.ok) setWithdrawals(await wRes.json());
    if (tRes.ok) setTransactions(await tRes.json());
    if (dRes.ok) setDepositRequests(await dRes.json());
  }, [token]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    if (token) fetchDepositInfo();
  }, [token, fetchDepositInfo]);

  useEffect(() => {
    if (!depositInfo?.accounts?.length) return;
    setSelectedAccountId((prev) => {
      if (prev && depositInfo.accounts.some((a) => a._id === prev)) return prev;
      const primary = depositInfo.accounts.find((a) => a.isPrimary) || depositInfo.accounts[0];
      return primary._id;
    });
  }, [depositInfo]);

  const expectedCoins = useMemo(() => {
    const rate = depositInfo?.coinsPerInr ?? 10;
    return Math.floor(amountInr * rate);
  }, [amountInr, depositInfo?.coinsPerInr]);

  const handleDepositRequest = async () => {
    if (!token || !user) return;
    if (amountInr < 1) return alert('Enter at least ₹1');
    if (!selectedAccountId) return alert('Select a platform payment account');
    if (utrReference.trim().length < 4) return alert('Enter payment reference / UTR (min 4 characters)');

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/users/wallet/deposit-request`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          amountInr,
          paymentAccountId: selectedAccountId,
          utrReference: utrReference.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setUtrReference('');
        alert(data.message || 'Deposit request submitted. It will be reviewed shortly.');
        fetchHistory();
      } else {
        alert(data.message || 'Request failed');
      }
    } catch {
      alert('Error connecting to server');
    }
    setLoading(false);
  };

  const handleWithdraw = async () => {
    if (!token || !user) return;
    if (amountInr <= 0) return alert('Enter a valid amount');
    if (!upiId || !upiId.includes('@')) return alert('Please enter a valid UPI ID (e.g. name@okhdfcbank)');

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/users/wallet/withdraw`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ amount: amountInr, upiId }),
      });
      const data = await res.json();
      if (res.ok) {
        setUpiId('');
        alert(data.message || 'Withdrawal request submitted!');
        fetchHistory();
      } else {
        alert(data.message || 'Transaction failed');
      }
    } catch {
      alert('Error connecting to server');
    }
    setLoading(false);
  };

  const statusColor = (s: string) =>
    s === 'approved' ? 'text-emerald-400 bg-emerald-500/10' :
    s === 'rejected' ? 'text-red-400 bg-red-500/10' :
    'text-yellow-400 bg-yellow-500/10';

  const txIcon = (type: string) =>
    ({
      deposit: '⬇️',
      withdrawal: '⬆️',
      prediction_stake: '🎯',
      prediction_win: '🏆',
      admin_adjustment: '⚙️',
    }[type] || '💫');

  const pendingDeposits = depositRequests.filter((d) => d.status === 'pending').length;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 md:p-10 pb-mobile-nav">
      <div className="max-w-5xl mx-auto space-y-8">
        <h1 className="text-4xl font-black border-b border-gray-800 pb-4">Wallet & Payments</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-gradient-to-br from-indigo-900 to-purple-900 rounded-3xl p-8 shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-56">
            <div className="absolute top-0 right-[-10%] w-64 h-64 bg-white/5 rounded-full blur-3xl" />
            <div>
              <h3 className="text-indigo-200/80 font-medium tracking-wider uppercase text-xs mb-3">Wallet balance (INR)</h3>
              <div className="text-5xl sm:text-6xl font-black text-white flex items-center gap-3 tabular-nums">
                {formatInr(user?.coinsBalance ?? 0)}
              </div>
              {(user?.creditsBalance ?? 0) > 0 && (
                <p className="text-indigo-200/90 mt-2 text-sm">Credits: ✨ {user?.creditsBalance?.toLocaleString()}</p>
              )}
            </div>
            <div className="flex gap-3 mt-6 relative z-10">
              {[100, 500, 1000].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    setAmountInr(v);
                    setTransactionType('deposit');
                  }}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition cursor-pointer"
                >
                  ₹{v}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-gray-800/80 rounded-3xl p-8 shadow-xl border border-gray-700/50 backdrop-blur-sm flex flex-col justify-between">
            <div className="flex bg-gray-900/50 p-1 rounded-xl mb-5">
              <button
                type="button"
                onClick={() => setTransactionType('deposit')}
                className={`flex-1 py-2 font-bold text-sm rounded-lg transition ${transactionType === 'deposit' ? 'bg-indigo-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
              >
                ⬇️ Add Money
              </button>
              <button
                type="button"
                onClick={() => setTransactionType('withdraw')}
                className={`flex-1 py-2 font-bold text-sm rounded-lg transition ${transactionType === 'withdraw' ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-white'}`}
              >
                ⬆️ Withdraw
              </button>
            </div>

            {transactionType === 'withdraw' && (
              <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-400 text-xs">
                ⚠️ Withdrawals are reviewed before payout (usually within 24 hours). Your balance is debited only after approval.
              </div>
            )}

            {transactionType === 'deposit' && (
              <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-300 text-xs">
                Pay the amount below to our UPI/bank using the selected account, then submit your UTR. Your wallet is credited in INR after we verify your payment.
              </div>
            )}

            <div className="space-y-4">
              {transactionType === 'deposit' ? (
                <>
                  <div>
                    <label className="text-gray-400 text-xs font-medium mb-1.5 block">Amount (INR)</label>
                    <div className="flex items-center gap-3 bg-gray-900/80 py-3 px-4 rounded-xl border border-gray-700 focus-within:border-indigo-500 transition-colors">
                      <span>₹</span>
                      <input
                        type="number"
                        min={1}
                        value={amountInr}
                        onChange={(e) => setAmountInr(Number(e.target.value))}
                        className="bg-transparent w-full text-2xl font-black text-white outline-none"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1.5">
                      Credit multiplier: {depositInfo?.coinsPerInr ?? '—'}× wallet INR per ₹1 paid → you will receive{' '}
                      <span className="text-yellow-400 font-bold">{formatInr(expectedCoins)}</span> after approval.
                    </p>
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs font-medium mb-1.5 block">Pay to (platform account)</label>
                    <select
                      value={selectedAccountId}
                      onChange={(e) => setSelectedAccountId(e.target.value)}
                      className="w-full bg-gray-900/80 p-3 rounded-xl border border-gray-700 text-white outline-none"
                    >
                      {!depositInfo?.accounts?.length ? (
                        <option value="">No payment accounts available — try again later or contact support</option>
                      ) : (
                        depositInfo.accounts.map((a) => (
                          <option key={a._id} value={a._id}>
                            {a.isPrimary ? '★ ' : ''}
                            {a.label} ({a.kind === 'upi' ? a.upiId : `${a.bankName || 'Bank'} …${a.accountNumber?.slice(-4) || ''}`})
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                  {selectedAccountId && depositInfo?.accounts && (
                    <div className="p-3 rounded-xl bg-gray-900/50 border border-gray-700/50 text-sm space-y-1">
                      {(() => {
                        const a = depositInfo.accounts.find((x) => x._id === selectedAccountId);
                        if (!a) return null;
                        return a.kind === 'upi' ? (
                          <>
                            <p className="text-gray-400 text-xs">UPI ID</p>
                            <p className="font-mono font-bold text-white break-all">{a.upiId}</p>
                            {publicUploadUrl(a.upiQrPath) && (
                              <div className="mt-3">
                                <p className="text-gray-400 text-xs mb-1">Scan to pay</p>
                                <img
                                  src={publicUploadUrl(a.upiQrPath)}
                                  alt="UPI QR code"
                                  className="max-w-[200px] rounded-lg border border-gray-600 bg-white p-1"
                                />
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <p className="text-gray-400 text-xs">Bank details</p>
                            <p>{a.bankName}</p>
                            <p className="font-mono">{a.accountNumber}</p>
                            <p className="font-mono text-xs">IFSC {a.ifsc}</p>
                            {a.accountHolderName && <p className="text-gray-400 text-xs">{a.accountHolderName}</p>}
                          </>
                        );
                      })()}
                    </div>
                  )}
                  <div>
                    <label className="text-gray-400 text-xs font-medium mb-1.5 block">UTR / reference (after you pay)</label>
                    <input
                      type="text"
                      value={utrReference}
                      onChange={(e) => setUtrReference(e.target.value)}
                      placeholder="Bank UTR or transaction ID"
                      className="w-full bg-gray-900/80 p-3 rounded-xl border border-gray-700 focus:border-indigo-500 transition text-white outline-none"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-gray-400 text-xs font-medium mb-1.5 block">Amount (INR)</label>
                    <div className="flex items-center gap-3 bg-gray-900/80 py-3 px-4 rounded-xl border border-gray-700 focus-within:border-indigo-500 transition-colors">
                      <span>₹</span>
                      <input
                        type="number"
                        value={amountInr}
                        onChange={(e) => setAmountInr(Number(e.target.value))}
                        className="bg-transparent w-full text-2xl font-black text-white outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs font-medium mb-1.5 block">Your UPI ID (receive INR)</label>
                    <input
                      type="text"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      placeholder="e.g. mobilenumber@ybl"
                      className="w-full bg-gray-900/80 p-3 rounded-xl border border-gray-700 focus:border-indigo-500 transition text-white outline-none"
                    />
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={transactionType === 'deposit' ? handleDepositRequest : handleWithdraw}
              disabled={loading}
              className={`mt-6 w-full font-black py-4 rounded-xl transition tracking-wide uppercase disabled:opacity-50 flex items-center justify-center gap-2 ${
                transactionType === 'deposit' ? 'bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/20' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : transactionType === 'deposit' ? (
                'Submit deposit request'
              ) : (
                'Request withdrawal'
              )}
            </button>
          </div>
        </div>

        <div className="bg-gray-800/40 rounded-3xl border border-gray-700/30 overflow-hidden">
          <div className="flex border-b border-gray-700/50 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveHistoryTab('transactions')}
              className={`flex-1 min-w-[33%] py-4 text-sm font-bold transition ${activeHistoryTab === 'transactions' ? 'text-white border-b-2 border-indigo-500' : 'text-gray-500 hover:text-gray-300'}`}
            >
              Transactions
            </button>
            <button
              type="button"
              onClick={() => setActiveHistoryTab('deposits')}
              className={`flex-1 min-w-[33%] py-4 text-sm font-bold transition ${activeHistoryTab === 'deposits' ? 'text-white border-b-2 border-indigo-500' : 'text-gray-500 hover:text-gray-300'}`}
            >
              INR deposits {pendingDeposits > 0 && <span className="ml-1 bg-yellow-500 text-black text-xs px-1.5 py-0.5 rounded-full">{pendingDeposits}</span>}
            </button>
            <button
              type="button"
              onClick={() => setActiveHistoryTab('withdrawals')}
              className={`flex-1 min-w-[33%] py-4 text-sm font-bold transition ${activeHistoryTab === 'withdrawals' ? 'text-white border-b-2 border-indigo-500' : 'text-gray-500 hover:text-gray-300'}`}
            >
              Withdrawals {withdrawals.filter((w) => w.status === 'pending').length > 0 && (
                <span className="ml-1 bg-yellow-500 text-black text-xs px-1.5 py-0.5 rounded-full">{withdrawals.filter((w) => w.status === 'pending').length}</span>
              )}
            </button>
          </div>

          <div className="divide-y divide-gray-700/30">
            {activeHistoryTab === 'transactions' &&
              (transactions.length === 0 ? (
                <p className="text-center py-12 text-gray-500">No transactions yet</p>
              ) : (
                transactions.map((t: any) => (
                  <div key={t._id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-700/20 transition">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{txIcon(t.type)}</span>
                      <div>
                        <p className="font-medium text-white capitalize">{t.type?.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-gray-400">{t.description}</p>
                        <p className="text-xs text-gray-600">{new Date(t.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                    <div
                      className={`font-black text-lg tabular-nums ${
                        t.type === 'deposit' || t.type === 'prediction_win' ? 'text-emerald-400' : t.type === 'admin_adjustment' ? 'text-cyan-400' : 'text-red-400'
                      }`}
                    >
                      {t.type === 'deposit' || t.type === 'prediction_win' || t.type === 'admin_adjustment' ? '+' : '−'}
                      {formatInr(t.amount ?? 0)}
                    </div>
                  </div>
                ))
              ))}

            {activeHistoryTab === 'deposits' &&
              (depositRequests.length === 0 ? (
                <p className="text-center py-12 text-gray-500">No deposit requests yet</p>
              ) : (
                depositRequests.map((d: any) => (
                  <div key={d._id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-700/20 transition">
                    <div>
                      <p className="font-medium text-white">
                        ₹{d.amountInr?.toLocaleString('en-IN')} → {formatInr(d.coinsToCredit ?? 0)} credited
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Ref: {d.utrReference} · {d.paymentAccountId?.label || 'Account'}
                      </p>
                      <p className="text-xs text-gray-600">{new Date(d.createdAt).toLocaleString()}</p>
                      {d.adminNote && <p className="text-xs text-gray-400 mt-1 italic">Note: {d.adminNote}</p>}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${statusColor(d.status)}`}>{d.status?.toUpperCase()}</span>
                  </div>
                ))
              ))}

            {activeHistoryTab === 'withdrawals' &&
              (withdrawals.length === 0 ? (
                <p className="text-center py-12 text-gray-500">No withdrawal requests yet</p>
              ) : (
                withdrawals.map((w: any) => (
                  <div key={w._id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-700/20 transition">
                    <div>
                      <p className="font-medium text-white">🏦 Withdrawal to {w.upiId}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{new Date(w.createdAt).toLocaleString()}</p>
                      {w.adminNote && <p className="text-xs text-gray-400 mt-1 italic">Admin: {w.adminNote}</p>}
                    </div>
                    <div className="text-right">
                      <p className="font-black text-lg text-red-300 tabular-nums">−{formatInr(w.amount ?? 0)}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${statusColor(w.status)}`}>{w.status?.toUpperCase()}</span>
                    </div>
                  </div>
                ))
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
