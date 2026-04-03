'use client';
import { useEffect, useState, useCallback } from 'react';
import { useStore } from '../../store/store';
import { useRouter } from 'next/navigation';
import { API_BASE } from '../../lib/api';

type Tab =
  | 'overview'
  | 'users'
  | 'deposits'
  | 'withdrawals'
  | 'accounts'
  | 'notify'
  | 'multipliers';

export default function AdminPage() {
  const { token, user } = useStore();
  const router = useRouter();

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      router.push('/dashboard');
    }
  }, [user, router]);

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [notifyForm, setNotifyForm] = useState({ title: '', message: '', type: 'info', userId: '' });
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  const [coinRateDraft, setCoinRateDraft] = useState('');
  const [ballMultiplierDraft, setBallMultiplierDraft] = useState<Record<string, string>>({
    Dot: '1.5',
    '1-2 Runs': '2.0',
    '4 Runs': '3.0',
    '6 Runs': '4.0',
    Wicket: '5.0',
    Extras: '2.0',
  });
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ coinsBalance: '', creditsBalance: '', note: '' });

  const [newAccount, setNewAccount] = useState({
    label: '',
    kind: 'upi' as 'upi' | 'bank',
    upiId: '',
    bankName: '',
    accountNumber: '',
    ifsc: '',
    accountHolderName: '',
    isPrimary: false,
  });

  const [syncForm, setSyncForm] = useState<{ id: string; increment: string; setTotal: string } | null>(null);
  const [smsPaste, setSmsPaste] = useState('');
  const [smsParseResult, setSmsParseResult] = useState<any>(null);

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const showToast = (msg: string, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchStats = useCallback(async () => {
    const res = await fetch(`${API_BASE}/admin/stats`, { headers });
    if (res.ok) {
      const s = await res.json();
      setStats(s);
      if (s.coinsPerInr != null) setCoinRateDraft(String(s.coinsPerInr));
    }
  }, [token]);

  const fetchBallMultipliers = useCallback(async () => {
    const res = await fetch(`${API_BASE}/admin/settings/ball-multipliers`, { headers });
    if (!res.ok) return;
    const d = await res.json();
    const bm = d.ballMultipliers || {};
    setBallMultiplierDraft({
      Dot: String(bm.Dot ?? 1.5),
      '1-2 Runs': String(bm['1-2 Runs'] ?? 2.0),
      '4 Runs': String(bm['4 Runs'] ?? 3.0),
      '6 Runs': String(bm['6 Runs'] ?? 4.0),
      Wicket: String(bm.Wicket ?? 5.0),
      Extras: String(bm.Extras ?? 2.0),
    });
  }, [token]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`${API_BASE}/admin/users`, { headers });
    if (res.ok) setUsers(await res.json());
    setLoading(false);
  }, [token]);

  const fetchWithdrawals = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`${API_BASE}/admin/withdrawals`, { headers });
    if (res.ok) setWithdrawals(await res.json());
    setLoading(false);
  }, [token]);

  const fetchDeposits = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`${API_BASE}/admin/deposits`, { headers });
    if (res.ok) setDeposits(await res.json());
    setLoading(false);
  }, [token]);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`${API_BASE}/admin/payment-accounts`, { headers });
    if (res.ok) setAccounts(await res.json());
    setLoading(false);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    fetchStats();
    fetchUsers();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'withdrawals') fetchWithdrawals();
    if (activeTab === 'deposits') fetchDeposits();
    if (activeTab === 'accounts') fetchAccounts();
    if (activeTab === 'multipliers') fetchBallMultipliers();
  }, [activeTab, token]);

  const saveCoinRate = async () => {
    const n = Number(coinRateDraft);
    if (!Number.isFinite(n) || n < 1) return showToast('Enter a valid coins-per-₹1 value', 'error');
    setActionLoading('coinRate');
    const res = await fetch(`${API_BASE}/admin/settings/coin-rate`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ coinsPerInr: n }),
    });
    if (res.ok) {
      showToast('Coin rate updated');
      fetchStats();
    } else {
      const d = await res.json();
      showToast(d.message || 'Failed', 'error');
    }
    setActionLoading(null);
  };

  const saveBallMultipliers = async () => {
    const payload: Record<string, number> = {};
    for (const [k, v] of Object.entries(ballMultiplierDraft)) {
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0 || n > 1000) {
        return showToast(`Invalid multiplier for ${k}`, 'error');
      }
      payload[k] = n;
    }

    setActionLoading('ballMultipliers');
    const res = await fetch(`${API_BASE}/admin/settings/ball-multipliers`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ ballMultipliers: payload }),
    });
    if (res.ok) {
      showToast('Ball multipliers updated');
      fetchBallMultipliers();
    } else {
      const d = await res.json();
      showToast(d.message || 'Failed', 'error');
    }
    setActionLoading(null);
  };

  const openEdit = (u: any) => {
    setEditingUser(u);
    setEditForm({
      coinsBalance: String(u.coinsBalance ?? 0),
      creditsBalance: String(u.creditsBalance ?? 0),
      note: '',
    });
  };

  const saveUser = async () => {
    if (!editingUser) return;
    setActionLoading('saveUser');
    const res = await fetch(`${API_BASE}/admin/users/${editingUser._id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        coinsBalance: Number(editForm.coinsBalance),
        creditsBalance: Number(editForm.creditsBalance),
        note: editForm.note || undefined,
      }),
    });
    if (res.ok) {
      showToast('User balances updated');
      setEditingUser(null);
      fetchUsers();
      fetchStats();
    } else {
      const d = await res.json();
      showToast(d.message || 'Failed', 'error');
    }
    setActionLoading(null);
  };

  const approveWithdrawal = async (id: string) => {
    setActionLoading(id + '_approve');
    const res = await fetch(`${API_BASE}/admin/withdrawals/${id}/approve`, { method: 'PATCH', headers });
    if (res.ok) {
      showToast('Withdrawal approved & user notified');
      fetchWithdrawals();
      fetchStats();
    } else {
      const d = await res.json();
      showToast(d.message || 'Failed', 'error');
    }
    setActionLoading(null);
  };

  const rejectWithdrawal = async (id: string) => {
    const note = prompt('Reason for rejection (optional):') || '';
    setActionLoading(id + '_reject');
    const res = await fetch(`${API_BASE}/admin/withdrawals/${id}/reject`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ adminNote: note }),
    });
    if (res.ok) {
      showToast('Withdrawal rejected & user notified', 'warning');
      fetchWithdrawals();
    } else {
      const d = await res.json();
      showToast(d.message || 'Failed', 'error');
    }
    setActionLoading(null);
  };

  const approveDeposit = async (id: string) => {
    setActionLoading(id + '_dapprove');
    const res = await fetch(`${API_BASE}/admin/deposits/${id}/approve`, { method: 'PATCH', headers });
    if (res.ok) {
      showToast('Deposit approved — coins credited');
      fetchDeposits();
      fetchStats();
      fetchAccounts();
    } else {
      const d = await res.json();
      showToast(d.message || 'Failed', 'error');
    }
    setActionLoading(null);
  };

  const parseBankSms = async () => {
    if (!smsPaste.trim()) return showToast('Paste a bank SMS first', 'error');
    setActionLoading('smsParse');
    const res = await fetch(`${API_BASE}/admin/payment-sync/parse-sms`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ text: smsPaste }),
    });
    const data = await res.json();
    if (res.ok) {
      setSmsParseResult(data);
      if (!data.parsed?.utr) showToast('No UTR detected — paste the full SMS', 'warning');
      else showToast(`UTR detected: ${data.parsed.utr}${data.matches?.length ? ` · ${data.matches.length} match(es)` : ''}`);
    } else showToast(data.message || 'Parse failed', 'error');
    setActionLoading(null);
  };

  const confirmDepositWithSms = async (depositId: string) => {
    if (!smsPaste.trim()) return showToast('Paste the same SMS in the box above', 'error');
    setActionLoading('smsConfirm_' + depositId);
    const res = await fetch(`${API_BASE}/admin/payment-sync/confirm-with-sms`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ depositId, text: smsPaste }),
    });
    const data = await res.json();
    if (res.ok) {
      showToast('Deposit approved via SMS UTR match');
      setSmsParseResult(null);
      fetchDeposits();
      fetchStats();
    } else showToast(data.message || 'Failed', 'error');
    setActionLoading(null);
  };

  const rejectDeposit = async (id: string) => {
    const note = prompt('Reason for rejection (optional):') || '';
    setActionLoading(id + '_dreject');
    const res = await fetch(`${API_BASE}/admin/deposits/${id}/reject`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ adminNote: note }),
    });
    if (res.ok) {
      showToast('Deposit rejected', 'warning');
      fetchDeposits();
    } else {
      const d = await res.json();
      showToast(d.message || 'Failed', 'error');
    }
    setActionLoading(null);
  };

  const createAccount = async () => {
    setActionLoading('newAcc');
    const res = await fetch(`${API_BASE}/admin/payment-accounts`, {
      method: 'POST',
      headers,
      body: JSON.stringify(newAccount),
    });
    if (res.ok) {
      showToast('Payment account added');
      setNewAccount({
        label: '',
        kind: 'upi',
        upiId: '',
        bankName: '',
        accountNumber: '',
        ifsc: '',
        accountHolderName: '',
        isPrimary: false,
      });
      fetchAccounts();
    } else {
      const d = await res.json();
      showToast(d.message || 'Failed', 'error');
    }
    setActionLoading(null);
  };

  const setPrimary = async (id: string) => {
    setActionLoading(id + '_pri');
    const res = await fetch(`${API_BASE}/admin/payment-accounts/${id}/primary`, { method: 'POST', headers });
    if (res.ok) {
      setAccounts(await res.json());
      showToast('Primary account updated');
    } else showToast('Failed', 'error');
    setActionLoading(null);
  };

  const deleteAccount = async (id: string) => {
    if (!confirm('Delete this payment account?')) return;
    setActionLoading(id + '_del');
    const res = await fetch(`${API_BASE}/admin/payment-accounts/${id}`, { method: 'DELETE', headers });
    if (res.ok) {
      showToast('Account removed');
      fetchAccounts();
    } else showToast('Failed', 'error');
    setActionLoading(null);
  };

  const applySync = async () => {
    if (!syncForm) return;
    const body: { incrementReceivedInr?: number; setTotalReceivedInr?: number } = {};
    if (syncForm.increment.trim()) body.incrementReceivedInr = Number(syncForm.increment);
    if (syncForm.setTotal.trim()) body.setTotalReceivedInr = Number(syncForm.setTotal);
    if (body.incrementReceivedInr === undefined && body.setTotalReceivedInr === undefined) {
      return showToast('Enter an amount to add or a new total', 'error');
    }
    setActionLoading('sync');
    const res = await fetch(`${API_BASE}/admin/payment-accounts/${syncForm.id}`, { method: 'PATCH', headers, body: JSON.stringify(body) });
    if (res.ok) {
      showToast('Receipt totals updated');
      setSyncForm(null);
      fetchAccounts();
    } else {
      const d = await res.json();
      showToast(d.message || 'Failed', 'error');
    }
    setActionLoading(null);
  };

  const sendNotification = async () => {
    if (!notifyForm.title || !notifyForm.message) return showToast('Fill in title and message', 'error');
    setActionLoading('notify');
    const res = await fetch(`${API_BASE}/admin/notify`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: notifyForm.title,
        message: notifyForm.message,
        type: notifyForm.type,
        userId: notifyForm.userId || undefined,
      }),
    });
    if (res.ok) {
      showToast(notifyForm.userId ? 'Notification sent to user' : 'Broadcast sent to all users!');
      setNotifyForm({ title: '', message: '', type: 'info', userId: '' });
    } else showToast('Failed to send', 'error');
    setActionLoading(null);
  };

  const tabs: { id: Tab; label: string; icon: string; badge?: number }[] = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'users', label: 'Users', icon: '👥' },
    { id: 'deposits', label: 'INR deposits', icon: '💰', badge: stats?.pendingDeposits },
    { id: 'withdrawals', label: 'Withdrawals', icon: '💸', badge: stats?.pendingWithdrawals },
    { id: 'accounts', label: 'Payment accounts', icon: '🏦' },
    { id: 'multipliers', label: 'Game Multipliers', icon: '🎯' },
    { id: 'notify', label: 'Notify Users', icon: '🔔' },
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {toast && (
        <div
          className={`fixed top-20 right-4 z-50 px-5 py-3 rounded-xl shadow-2xl font-medium transition-all ${
            toast.type === 'error' ? 'bg-red-600' : toast.type === 'warning' ? 'bg-yellow-600' : 'bg-emerald-600'
          }`}
        >
          {toast.msg}
        </div>
      )}

      {editingUser && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/70" onClick={() => setEditingUser(null)}>
          <div
            className="bg-gray-800 border border-gray-600 rounded-2xl p-6 max-w-md w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold mb-1">Edit user</h3>
            <p className="text-gray-400 text-sm mb-4">
              {editingUser.username} · {editingUser.email}
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500">Coins balance 🪙</label>
                <input
                  type="number"
                  className="w-full mt-1 bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-white"
                  value={editForm.coinsBalance}
                  onChange={(e) => setEditForm((f) => ({ ...f, coinsBalance: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Credits balance ✨</label>
                <input
                  type="number"
                  className="w-full mt-1 bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-white"
                  value={editForm.creditsBalance}
                  onChange={(e) => setEditForm((f) => ({ ...f, creditsBalance: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Note (optional, for audit)</label>
                <input
                  className="w-full mt-1 bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-white"
                  value={editForm.note}
                  onChange={(e) => setEditForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder="e.g. manual correction"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button type="button" className="flex-1 py-3 rounded-xl bg-gray-700 hover:bg-gray-600" onClick={() => setEditingUser(null)}>
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading === 'saveUser'}
                className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold disabled:opacity-50"
                onClick={saveUser}
              >
                {actionLoading === 'saveUser' ? '...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {syncForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/70" onClick={() => setSyncForm(null)}>
          <div className="bg-gray-800 border border-gray-600 rounded-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold mb-2">Sync INR received (manual)</h3>
            <p className="text-xs text-gray-400 mb-3">Use this to align totals with your bank statement. Approving deposits also adds to this account automatically.</p>
            <input
              type="number"
              placeholder="Add to total (₹)"
              className="w-full mb-2 bg-gray-900 border border-gray-700 rounded-xl px-3 py-2"
              value={syncForm.increment}
              onChange={(e) => setSyncForm((s) => (s ? { ...s, increment: e.target.value } : null))}
            />
            <input
              type="number"
              placeholder="Or set total to (₹)"
              className="w-full mb-4 bg-gray-900 border border-gray-700 rounded-xl px-3 py-2"
              value={syncForm.setTotal}
              onChange={(e) => setSyncForm((s) => (s ? { ...s, setTotal: e.target.value } : null))}
            />
            <div className="flex gap-2">
              <button type="button" className="flex-1 py-2 rounded-xl bg-gray-700" onClick={() => setSyncForm(null)}>
                Cancel
              </button>
              <button type="button" disabled={!!actionLoading} className="flex-1 py-2 rounded-xl bg-emerald-600 font-bold" onClick={applySync}>
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-white">Admin Control Panel</h1>
            <p className="text-gray-400 mt-1">Users, INR deposits, payment accounts, coin rate, withdrawals</p>
          </div>
          <span className="px-3 py-1 bg-red-500/10 border border-red-500/30 text-red-400 rounded-full text-sm font-bold tracking-wider">ADMIN</span>
        </div>

        <div className="flex gap-2 mb-8 bg-gray-800/50 p-1.5 rounded-2xl border border-gray-700/50 flex-wrap w-fit">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${
                activeTab === t.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              <span>{t.icon}</span> {t.label}
              {(t.badge ?? 0) > 0 && (
                <span className="bg-red-500 text-white text-xs min-w-[1.25rem] h-5 px-1 rounded-full flex items-center justify-center font-black">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { label: 'Total Users', value: stats.totalUsers, icon: '👤', color: 'from-blue-600 to-indigo-600' },
                { label: 'Pending deposits', value: stats.pendingDeposits, icon: '⏳', color: 'from-amber-600 to-orange-600' },
                { label: 'Pending Withdrawals', value: stats.pendingWithdrawals, icon: '⏳', color: 'from-yellow-600 to-orange-600' },
                { label: 'Total Withdrawals', value: stats.totalWithdrawals, icon: '💸', color: 'from-purple-600 to-pink-600' },
                { label: 'Coins in Circulation', value: stats.totalCoinsInCirculation.toLocaleString(), icon: '🪙', color: 'from-yellow-500 to-amber-500' },
                { label: 'Total Wins', value: stats.totalWins, icon: '✅', color: 'from-emerald-600 to-teal-600' },
                { label: 'Total Losses', value: stats.totalLosses, icon: '❌', color: 'from-red-600 to-rose-600' },
              ].map((s) => (
                <div key={s.label} className={`bg-gradient-to-br ${s.color} p-6 rounded-2xl shadow-xl`}>
                  <div className="text-3xl mb-2">{s.icon}</div>
                  <p className="text-white/70 text-sm font-medium mb-1">{s.label}</p>
                  <p className="text-3xl font-black text-white">{s.value}</p>
                </div>
              ))}
            </div>

            <div className="bg-gray-800/60 border border-gray-700/50 rounded-2xl p-6 max-w-xl">
              <h3 className="font-bold text-lg mb-1">Coin value (INR)</h3>
              <p className="text-sm text-gray-400 mb-4">How many coins users receive per ₹1 paid. Example: 10 means ₹100 → 1,000 coins.</p>
              <div className="flex gap-3 flex-wrap items-end">
                <div>
                  <label className="text-xs text-gray-500">Coins per ₹1</label>
                  <input
                    type="number"
                    min={1}
                    className="block mt-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-2 w-40 text-white"
                    value={coinRateDraft}
                    onChange={(e) => setCoinRateDraft(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  disabled={actionLoading === 'coinRate'}
                  onClick={saveCoinRate}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold disabled:opacity-50"
                >
                  {actionLoading === 'coinRate' ? '...' : 'Save rate'}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">All Users ({users.length})</h2>
              <button type="button" onClick={fetchUsers} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm transition">
                ↻ Refresh
              </button>
            </div>
            <div className="bg-gray-800/60 rounded-2xl border border-gray-700/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-900/50 text-gray-400 text-xs uppercase tracking-wider">
                      <th className="px-4 py-3 text-left">User</th>
                      <th className="px-4 py-3 text-right">Coins 🪙</th>
                      <th className="px-4 py-3 text-right">Credits</th>
                      <th className="px-4 py-3 text-right">Wins</th>
                      <th className="px-4 py-3 text-right">Losses</th>
                      <th className="px-4 py-3 text-center">Role</th>
                      <th className="px-4 py-3 text-center">Edit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700/30">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="text-center py-10 text-gray-500">
                          Loading...
                        </td>
                      </tr>
                    ) : (
                      users.map((u) => (
                        <tr key={u._id} className="hover:bg-gray-700/20 transition">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-xs font-bold">
                                {u.username?.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-semibold text-white">{u.username}</p>
                                <p className="text-gray-400 text-xs">{u.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-yellow-400">{u.coinsBalance?.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right font-mono text-cyan-300">{(u.creditsBalance ?? 0).toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-emerald-400 font-semibold">{u.totalWins || 0}</td>
                          <td className="px-4 py-3 text-right text-red-400 font-semibold">{u.totalLosses || 0}</td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                u.role === 'admin' ? 'bg-red-500/20 text-red-400' : 'bg-gray-700 text-gray-400'
                              }`}
                            >
                              {u.role || 'user'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => openEdit(u)}
                              className="px-3 py-1.5 bg-indigo-600/80 hover:bg-indigo-500 rounded-lg text-xs font-bold"
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'deposits' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">INR deposit requests</h2>
              <button type="button" onClick={fetchDeposits} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm">
                ↻ Refresh
              </button>
            </div>

            <div className="mb-8 p-5 bg-gray-800/50 border border-cyan-500/20 rounded-2xl space-y-3">
              <h3 className="font-bold text-cyan-300">Verify with bank SMS (UTR)</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Paste the <strong className="text-gray-300">credit alert SMS</strong> from your bank/UPI app. We extract the UTR and match it to pending deposits where the user entered the same reference.
                For automatic handling, configure <code className="text-gray-500">SMS_WEBHOOK_SECRET</code> and POST the SMS to{' '}
                <code className="text-gray-500">/webhooks/bank-sms</code> (e.g. Android SMS forwarder).
              </p>
              <textarea
                value={smsPaste}
                onChange={(e) => setSmsPaste(e.target.value)}
                placeholder="Paste full SMS, e.g. Rs.500.00 credited to A/c ... UTR 123456789012..."
                rows={4}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-sm text-white placeholder:text-gray-600"
              />
              <div className="flex flex-wrap gap-2 items-center">
                <button
                  type="button"
                  disabled={actionLoading === 'smsParse'}
                  onClick={parseBankSms}
                  className="px-4 py-2 bg-cyan-700 hover:bg-cyan-600 rounded-xl text-sm font-bold disabled:opacity-50"
                >
                  {actionLoading === 'smsParse' ? '...' : 'Parse & match'}
                </button>
                <span className="text-xs text-gray-500">Requires user to have submitted the same UTR on their deposit request.</span>
              </div>
              {smsParseResult && (
                <div className="text-sm space-y-2 border-t border-gray-700/50 pt-3">
                  <p className="text-gray-300">
                    Parsed UTR:{' '}
                    <span className="font-mono text-cyan-400">{smsParseResult.parsed?.utr || '—'}</span>
                    {smsParseResult.parsed?.amountInr != null && (
                      <span className="ml-3">Amount in SMS: ₹{smsParseResult.parsed.amountInr}</span>
                    )}
                  </p>
                  {smsParseResult.warnings?.length > 0 && (
                    <ul className="text-xs text-amber-400 list-disc pl-4">
                      {smsParseResult.warnings.map((w: string, i: number) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  )}
                  {smsParseResult.matches?.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-gray-400 text-xs">Matching pending deposits:</p>
                      {smsParseResult.matches.map((m: any) => (
                        <div key={m.depositId} className="flex flex-wrap items-center gap-2 bg-gray-900/60 rounded-lg px-3 py-2">
                          <span className="font-mono text-xs text-gray-500">{m.depositId}</span>
                          <span className="text-white">{m.username}</span>
                          <span>₹{m.amountInr}</span>
                          {m.amountMatchesSms === false && <span className="text-amber-500 text-xs">Amount mismatch</span>}
                          <button
                            type="button"
                            disabled={!!actionLoading}
                            onClick={() => confirmDepositWithSms(m.depositId)}
                            className="ml-auto px-3 py-1 bg-emerald-600 rounded-lg text-xs font-bold"
                          >
                            {actionLoading === 'smsConfirm_' + m.depositId ? '...' : 'Approve with this SMS'}
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    smsParseResult.parsed?.utr && (
                      <p className="text-gray-500 text-xs">No pending deposit with a matching user-entered UTR.</p>
                    )
                  )}
                </div>
              )}
            </div>

            {loading && <p className="text-center py-10 text-gray-500">Loading...</p>}
            {!loading && deposits.length === 0 && (
              <div className="text-center py-16 bg-gray-800/40 rounded-2xl border border-gray-700/30 border-dashed text-gray-400">No deposit requests</div>
            )}
            <div className="space-y-4">
              {deposits.map((d: any) => (
                <div
                  key={d._id}
                  className={`bg-gray-800/60 border rounded-2xl p-6 flex flex-col md:flex-row md:items-center gap-4 ${
                    d.status === 'pending' ? 'border-yellow-500/30' : d.status === 'approved' ? 'border-emerald-500/30' : 'border-red-500/30'
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center font-bold text-sm">
                        {(d.userId?.username || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-white">{d.userId?.username}</p>
                        <p className="text-xs text-gray-400">{d.userId?.email}</p>
                      </div>
                      <span
                        className={`ml-auto px-3 py-1 rounded-full text-xs font-bold ${
                          d.status === 'pending'
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : d.status === 'approved'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {d.status?.toUpperCase()}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3 text-sm">
                      <div className="bg-gray-900/50 rounded-xl p-3">
                        <p className="text-xs text-gray-500">INR</p>
                        <p className="font-black text-white">₹{d.amountInr?.toLocaleString()}</p>
                      </div>
                      <div className="bg-gray-900/50 rounded-xl p-3">
                        <p className="text-xs text-gray-500">Coins to credit</p>
                        <p className="font-black text-yellow-400">🪙 {d.coinsToCredit?.toLocaleString()}</p>
                      </div>
                      <div className="bg-gray-900/50 rounded-xl p-3 col-span-2 md:col-span-1">
                        <p className="text-xs text-gray-500">UTR / ref</p>
                        <p className="font-mono text-white break-all">{d.utrReference}</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Account: {d.paymentAccountId?.label || '—'} · Rate snapshot: {d.coinsPerInrSnapshot} / ₹
                    </p>
                    {d.adminNote && <p className="text-sm text-gray-400 mt-2 italic">Note: {d.adminNote}</p>}
                    <p className="text-xs text-gray-600 mt-1">{new Date(d.createdAt).toLocaleString()}</p>
                  </div>
                  {d.status === 'pending' && (
                    <div className="flex gap-3 md:flex-col">
                      <button
                        type="button"
                        onClick={() => approveDeposit(d._id)}
                        disabled={!!actionLoading}
                        className="flex-1 px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl disabled:opacity-50 text-sm"
                      >
                        {actionLoading === d._id + '_dapprove' ? '...' : '✅ Approve'}
                      </button>
                      <button
                        type="button"
                        onClick={() => rejectDeposit(d._id)}
                        disabled={!!actionLoading}
                        className="flex-1 px-5 py-3 bg-red-600/80 hover:bg-red-500 text-white font-bold rounded-xl disabled:opacity-50 text-sm"
                      >
                        {actionLoading === d._id + '_dreject' ? '...' : '❌ Reject'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'withdrawals' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Withdrawal Requests</h2>
              <button type="button" onClick={fetchWithdrawals} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm transition">
                ↻ Refresh
              </button>
            </div>
            <div className="space-y-4">
              {loading && <p className="text-center py-10 text-gray-500">Loading...</p>}
              {!loading && withdrawals.length === 0 && (
                <div className="text-center py-16 bg-gray-800/40 rounded-2xl border border-gray-700/30 border-dashed">
                  <p className="text-2xl mb-2">🎉</p>
                  <p className="text-gray-400">No withdrawal requests yet</p>
                </div>
              )}
              {withdrawals.map((w) => (
                <div
                  key={w._id}
                  className={`bg-gray-800/60 border rounded-2xl p-6 flex flex-col md:flex-row md:items-center gap-4 ${
                    w.status === 'pending' ? 'border-yellow-500/30' : w.status === 'approved' ? 'border-emerald-500/30' : 'border-red-500/30'
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center font-bold text-sm">
                        {(w.userId?.username || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-white">{w.userId?.username || 'Unknown'}</p>
                        <p className="text-xs text-gray-400">{w.userId?.email}</p>
                      </div>
                      <span
                        className={`ml-auto px-3 py-1 rounded-full text-xs font-bold ${
                          w.status === 'pending'
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : w.status === 'approved'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {w.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-3">
                      <div className="bg-gray-900/50 rounded-xl p-3">
                        <p className="text-xs text-gray-500 mb-0.5">Amount</p>
                        <p className="font-black text-yellow-400 text-xl">🪙 {w.amount?.toLocaleString()}</p>
                      </div>
                      <div className="bg-gray-900/50 rounded-xl p-3">
                        <p className="text-xs text-gray-500 mb-0.5">UPI ID</p>
                        <p className="font-medium text-white text-sm">{w.upiId}</p>
                      </div>
                    </div>
                    {w.adminNote && <p className="text-sm text-gray-400 mt-2 italic">Note: {w.adminNote}</p>}
                    <p className="text-xs text-gray-600 mt-2">{new Date(w.createdAt).toLocaleString()}</p>
                  </div>
                  {w.status === 'pending' && (
                    <div className="flex gap-3 md:flex-col">
                      <button
                        type="button"
                        onClick={() => approveWithdrawal(w._id)}
                        disabled={!!actionLoading}
                        className="flex-1 px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition shadow-lg disabled:opacity-50 text-sm whitespace-nowrap"
                      >
                        {actionLoading === w._id + '_approve' ? '...' : '✅ Approve'}
                      </button>
                      <button
                        type="button"
                        onClick={() => rejectWithdrawal(w._id)}
                        disabled={!!actionLoading}
                        className="flex-1 px-5 py-3 bg-red-600/80 hover:bg-red-500 text-white font-bold rounded-xl transition disabled:opacity-50 text-sm whitespace-nowrap"
                      >
                        {actionLoading === w._id + '_reject' ? '...' : '❌ Reject'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'accounts' && (
          <div className="space-y-8">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">Platform payment accounts ({accounts.length}/10)</h2>
              <button type="button" onClick={fetchAccounts} className="px-4 py-2 bg-gray-700 rounded-xl text-sm">
                ↻ Refresh
              </button>
            </div>

            <div className="bg-gray-800/60 border border-gray-700/50 rounded-2xl p-6">
              <h3 className="font-bold mb-4">Add account</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <input
                  className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2"
                  placeholder="Label (e.g. Main UPI)"
                  value={newAccount.label}
                  onChange={(e) => setNewAccount((a) => ({ ...a, label: e.target.value }))}
                />
                <select
                  className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2"
                  value={newAccount.kind}
                  onChange={(e) => setNewAccount((a) => ({ ...a, kind: e.target.value as 'upi' | 'bank' }))}
                >
                  <option value="upi">UPI</option>
                  <option value="bank">Bank</option>
                </select>
                {newAccount.kind === 'upi' ? (
                  <input
                    className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 md:col-span-2"
                    placeholder="UPI ID"
                    value={newAccount.upiId}
                    onChange={(e) => setNewAccount((a) => ({ ...a, upiId: e.target.value }))}
                  />
                ) : (
                  <>
                    <input
                      className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2"
                      placeholder="Bank name"
                      value={newAccount.bankName}
                      onChange={(e) => setNewAccount((a) => ({ ...a, bankName: e.target.value }))}
                    />
                    <input
                      className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2"
                      placeholder="Account number"
                      value={newAccount.accountNumber}
                      onChange={(e) => setNewAccount((a) => ({ ...a, accountNumber: e.target.value }))}
                    />
                    <input
                      className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2"
                      placeholder="IFSC"
                      value={newAccount.ifsc}
                      onChange={(e) => setNewAccount((a) => ({ ...a, ifsc: e.target.value }))}
                    />
                    <input
                      className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2"
                      placeholder="Account holder (optional)"
                      value={newAccount.accountHolderName}
                      onChange={(e) => setNewAccount((a) => ({ ...a, accountHolderName: e.target.value }))}
                    />
                  </>
                )}
                <label className="flex items-center gap-2 text-sm text-gray-400 md:col-span-2">
                  <input
                    type="checkbox"
                    checked={newAccount.isPrimary}
                    onChange={(e) => setNewAccount((a) => ({ ...a, isPrimary: e.target.checked }))}
                  />
                  Set as primary (shown first in app)
                </label>
              </div>
              <button
                type="button"
                disabled={accounts.length >= 10 || actionLoading === 'newAcc'}
                onClick={createAccount}
                className="mt-4 px-6 py-2 bg-indigo-600 rounded-xl font-bold disabled:opacity-50"
              >
                {actionLoading === 'newAcc' ? '...' : 'Add account'}
              </button>
            </div>

            {loading ? (
              <p className="text-gray-500">Loading...</p>
            ) : (
              <div className="space-y-4">
                {accounts.map((a) => (
                  <div key={a._id} className="bg-gray-800/60 border border-gray-700/50 rounded-2xl p-5 flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-bold text-lg">{a.label}</span>
                        {a.isPrimary && <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-bold">PRIMARY</span>}
                        <span className="text-xs text-gray-500 uppercase">{a.kind}</span>
                      </div>
                      {a.kind === 'upi' ? (
                        <p className="font-mono text-emerald-400">{a.upiId}</p>
                      ) : (
                        <div className="text-sm text-gray-300 space-y-0.5">
                          <p>{a.bankName}</p>
                          <p className="font-mono">{a.accountNumber}</p>
                          <p className="font-mono text-xs">IFSC {a.ifsc}</p>
                          {a.accountHolderName && <p className="text-gray-500">{a.accountHolderName}</p>}
                        </div>
                      )}
                      <p className="text-sm text-gray-400 mt-2">
                        Total INR recorded (approved deposits + manual sync):{' '}
                        <span className="text-white font-mono">₹{(a.totalReceivedInr ?? 0).toLocaleString()}</span>
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!a.isPrimary && (
                        <button type="button" onClick={() => setPrimary(a._id)} className="px-3 py-2 bg-amber-600/80 rounded-xl text-sm font-bold">
                          Set primary
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setSyncForm({ id: a._id, increment: '', setTotal: '' })}
                        className="px-3 py-2 bg-gray-700 rounded-xl text-sm"
                      >
                        Sync INR
                      </button>
                      <button type="button" onClick={() => deleteAccount(a._id)} className="px-3 py-2 bg-red-600/50 rounded-xl text-sm">
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
                {accounts.length === 0 && <p className="text-gray-500 text-center py-8">No payment accounts yet. Add one above.</p>}
              </div>
            )}
          </div>
        )}

        {activeTab === 'multipliers' && (
          <div className="max-w-2xl space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">Ball Multipliers</h2>
              <button
                type="button"
                onClick={fetchBallMultipliers}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm transition"
              >
                ↻ Refresh
              </button>
            </div>

            <div className="bg-gray-800/60 border border-gray-700/50 rounded-2xl p-8 space-y-5">
              <p className="text-sm text-gray-400">
                These multipliers are applied when resolving <code className="text-gray-300">type: 'ball'</code> predictions.
                Admin can set a fixed value for Dot / 1-2 / 4 / 6 / Wicket / Extras.
              </p>

              <div className="grid md:grid-cols-2 gap-4">
                {(
                  [
                    { k: 'Dot', label: 'Dot' },
                    { k: '1-2 Runs', label: '1-2 Runs' },
                    { k: '4 Runs', label: '4 Runs' },
                    { k: '6 Runs', label: '6 Runs' },
                    { k: 'Wicket', label: 'Wicket' },
                    { k: 'Extras', label: 'Extras' },
                  ] as const
                ).map(({ k, label }) => (
                  <div key={k}>
                    <label className="block text-xs text-gray-500 mb-2">{label}</label>
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2 text-white"
                      value={ballMultiplierDraft[k]}
                      onChange={(e) =>
                        setBallMultiplierDraft((d) => ({
                          ...d,
                          [k]: e.target.value,
                        }))
                      }
                    />
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  disabled={actionLoading === 'ballMultipliers'}
                  onClick={saveBallMultipliers}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold disabled:opacity-50"
                >
                  {actionLoading === 'ballMultipliers' ? 'Saving...' : 'Save multipliers'}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'notify' && (
          <div className="max-w-2xl">
            <h2 className="text-xl font-bold mb-6">Send Notification to Users</h2>
            <div className="bg-gray-800/60 border border-gray-700/50 rounded-2xl p-8 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Notification Type</label>
                <div className="flex gap-3 flex-wrap">
                  {[
                    { val: 'info', label: '💬 Info', cls: 'border-blue-500 bg-blue-500/10 text-blue-400' },
                    { val: 'success', label: '✅ Success', cls: 'border-emerald-500 bg-emerald-500/10 text-emerald-400' },
                    { val: 'warning', label: '⚠️ Warning', cls: 'border-yellow-500 bg-yellow-500/10 text-yellow-400' },
                    { val: 'error', label: '🚨 Alert', cls: 'border-red-500 bg-red-500/10 text-red-400' },
                  ].map((t) => (
                    <button
                      key={t.val}
                      type="button"
                      onClick={() => setNotifyForm((f) => ({ ...f, type: t.val }))}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold border transition ${
                        notifyForm.type === t.val ? t.cls : 'border-gray-700 text-gray-500 hover:border-gray-600'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Title</label>
                <input
                  value={notifyForm.title}
                  onChange={(e) => setNotifyForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Maintenance Scheduled"
                  className="w-full bg-gray-900/80 text-white p-3 rounded-xl border border-gray-700 focus:border-indigo-500 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Message</label>
                <textarea
                  value={notifyForm.message}
                  onChange={(e) => setNotifyForm((f) => ({ ...f, message: e.target.value }))}
                  placeholder="Your notification message..."
                  rows={4}
                  className="w-full bg-gray-900/80 text-white p-3 rounded-xl border border-gray-700 focus:border-indigo-500 outline-none transition resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Target User ID <span className="text-gray-600">(leave empty to broadcast to ALL users)</span>
                </label>
                <select
                  value={notifyForm.userId}
                  onChange={(e) => setNotifyForm((f) => ({ ...f, userId: e.target.value }))}
                  className="w-full bg-gray-900/80 text-white p-3 rounded-xl border border-gray-700 focus:border-indigo-500 outline-none transition"
                >
                  <option value="">📢 Broadcast to All Users</option>
                  {users.map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.username} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={sendNotification}
                disabled={actionLoading === 'notify'}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl transition shadow-lg shadow-indigo-600/30 disabled:opacity-50 flex items-center justify-center gap-2 uppercase tracking-wide"
              >
                {actionLoading === 'notify' ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : notifyForm.userId ? (
                  '🔔 Send to User'
                ) : (
                  '📢 Broadcast to All'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
