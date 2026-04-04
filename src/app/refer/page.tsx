'use client';
import { useState, useEffect, useCallback } from 'react';
import { useStore } from '../../store/store';
import { API_BASE } from '../../lib/api';
import Link from 'next/link';

interface BonusStatus {
  amount: number;
  status: string;
  createdAt: string;
  unlockedAt: string | null;
  expiresAt: string;
  wageringProgress: number;
  wageringRequired: number;
  percentageWagered: number;
  isWithdrawable: boolean;
  isExpired: boolean;
}

interface ReferralData {
  referralCode: string;
  referralLink: string;
}

interface ReferralStats {
  referralCode: string;
  referredBy: string | null;
  totalReferrals: number;
  totalReferralEarnings: number;
  referrals: {
    _id: string;
    bonusAmount: number;
    status: string;
    creditedAt: string | null;
    expiresAt: string;
    createdAt: string;
  }[];
}

export default function ReferPage() {
  const { user, token, siteBranding } = useStore();
  const siteName = siteBranding?.siteName ?? 'CrickPredict';
  const [bonusStatus, setBonusStatus] = useState<BonusStatus | null>(null);
  const [referralData, setReferralData] = useState<ReferralData | null>(null);
  const [referralStats, setReferralStats] = useState<ReferralStats | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const fetchAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [bonusRes, linkRes, statusRes] = await Promise.all([
        fetch(`${API_BASE}/user/signup-bonus/status`, { headers }),
        fetch(`${API_BASE}/user/referral/link`, { headers }),
        fetch(`${API_BASE}/user/referral/status`, { headers }),
      ]);
      if (bonusRes.ok) {
        const d = await bonusRes.json();
        setBonusStatus(d.data);
      }
      if (linkRes.ok) {
        const d = await linkRes.json();
        setReferralData(d);
      }
      if (statusRes.ok) {
        const d = await statusRes.json();
        setReferralStats(d.data);
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const copyLink = () => {
    if (!referralData) return;
    navigator.clipboard.writeText(referralData.referralLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const copyCode = () => {
    if (!referralData) return;
    navigator.clipboard.writeText(referralData.referralCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const shareWhatsApp = () => {
    if (!referralData) return;
    const text = `🏏 Join me on ${siteName}! Use my referral code: ${referralData.referralCode} and get 50 bonus coins to start betting on live cricket! ${referralData.referralLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const shareNative = async () => {
    if (!referralData) return;
    if (navigator.share) {
      await navigator.share({
        title: `${siteName} — Predict & Win`,
        text: `Join me on ${siteName}! Use code: ${referralData.referralCode} and get 50 bonus coins!`,
        url: referralData.referralLink,
      });
    } else {
      copyLink();
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <p className="text-xl mb-4">Please log in to access Refer & Earn</p>
          <Link href="/login" className="px-6 py-3 bg-indigo-600 rounded-xl font-bold hover:bg-indigo-500 transition">Sign In</Link>
        </div>
      </div>
    );
  }

  const bonusStatusColor = {
    locked: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    unlocked: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    wagering: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    withdrawable: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    expired: 'text-red-400 bg-red-500/10 border-red-500/30',
    none: 'text-gray-400 bg-gray-500/10 border-gray-500/30',
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 md:p-10 pb-mobile-nav relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-600/20 rounded-full filter blur-[150px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-600/20 rounded-full filter blur-[150px] pointer-events-none" />

      <div className="max-w-4xl mx-auto relative z-10 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-black mb-2 flex items-center gap-3">
            <span className="text-5xl">🎁</span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">
              Refer & Earn
            </span>
          </h1>
          <p className="text-gray-400 text-lg">Invite friends and earn <strong className="text-emerald-400">50 coins</strong> for each signup!</p>
        </div>

        {loading ? (
          <div className="flex justify-center p-24">
            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Referral Share Card */}
            <div className="bg-gradient-to-br from-emerald-900/60 to-teal-900/60 rounded-3xl p-8 border border-emerald-500/20 shadow-2xl">
              <h2 className="text-2xl font-bold mb-2">📤 Share Your Referral</h2>
              <p className="text-emerald-300/70 text-sm mb-6">Your friend signs up → You both benefit! You earn 50 coins instantly.</p>

              {/* Referral Code */}
              <div className="mb-5">
                <label className="text-emerald-300/60 text-xs font-bold uppercase tracking-widest mb-2 block">Your Referral Code</label>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-black/30 rounded-xl px-5 py-4 font-mono text-2xl font-black text-emerald-300 tracking-[0.3em] border border-emerald-500/30 text-center">
                    {referralData?.referralCode || user.referralCode || '—'}
                  </div>
                  <button
                    onClick={copyCode}
                    className={`px-5 py-4 rounded-xl font-bold transition-all ${codeCopied ? 'bg-emerald-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                  >
                    {codeCopied ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Referral Link */}
              <div className="mb-6">
                <label className="text-emerald-300/60 text-xs font-bold uppercase tracking-widest mb-2 block">Share Link</label>
                <div className="flex items-center gap-3">
                  <input
                    readOnly
                    value={referralData?.referralLink || `${typeof window !== 'undefined' ? window.location.origin : 'https://app.crickpredict.com'}/register?ref=${referralData?.referralCode || ''}`}
                    className="flex-1 bg-black/30 rounded-xl px-4 py-3 text-sm text-gray-300 border border-emerald-500/30 outline-none truncate"
                  />
                  <button
                    onClick={copyLink}
                    className={`px-5 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${linkCopied ? 'bg-emerald-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                  >
                    {linkCopied ? '✓ Copied!' : 'Copy Link'}
                  </button>
                </div>
              </div>

              {/* Share buttons */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={shareWhatsApp}
                  className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 rounded-xl font-bold transition-all shadow-lg shadow-green-600/20"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                  WhatsApp
                </button>
                <button
                  onClick={shareNative}
                  className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                  Share
                </button>
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-gray-800/60 rounded-2xl p-6 border border-gray-700/50 text-center">
                <p className="text-gray-400 text-sm mb-1">Total Referrals</p>
                <p className="text-4xl font-black text-white">{referralStats?.totalReferrals ?? 0}</p>
              </div>
              <div className="bg-gray-800/60 rounded-2xl p-6 border border-gray-700/50 text-center">
                <p className="text-gray-400 text-sm mb-1">Coins Earned</p>
                <p className="text-4xl font-black text-emerald-400">🪙 {referralStats?.totalReferralEarnings ?? 0}</p>
              </div>
              <div className="bg-gray-800/60 rounded-2xl p-6 border border-gray-700/50 text-center col-span-2 md:col-span-1">
                <p className="text-gray-400 text-sm mb-1">Your Balance</p>
                <p className="text-4xl font-black text-yellow-400">🪙 {user.coinsBalance?.toLocaleString()}</p>
              </div>
            </div>

            {/* Signup Bonus Status */}
            {bonusStatus && bonusStatus.status !== 'none' && (
              <div className="bg-gray-800/60 rounded-3xl p-8 border border-gray-700/50 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <h3 className="text-xl font-bold">🎯 Your Signup Bonus</h3>
                  <span className={`px-3 py-1 rounded-full text-sm font-bold border ${bonusStatusColor[bonusStatus.status as keyof typeof bonusStatusColor] || bonusStatusColor.none}`}>
                    {bonusStatus.status.toUpperCase()}
                  </span>
                </div>

                <div className="flex items-center gap-4 p-4 bg-gray-900/50 rounded-2xl border border-gray-700/30">
                  <span className="text-4xl font-black text-yellow-400">🪙 {bonusStatus.amount}</span>
                  <div>
                    <p className="font-bold text-white">Signup Bonus</p>
                    <p className="text-xs text-gray-400">Expires: {new Date(bonusStatus.expiresAt).toLocaleDateString()}</p>
                  </div>
                </div>

                {bonusStatus.status === 'locked' && (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                    <p className="text-amber-300 font-semibold mb-1">🔒 Bonus Locked</p>
                    <p className="text-amber-300/70 text-sm">Make a deposit of ₹100 or more to unlock your signup bonus and start the wagering requirement.</p>
                    <Link href="/wallet" className="mt-3 inline-block px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl transition text-sm">
                      Deposit Now →
                    </Link>
                  </div>
                )}

                {(bonusStatus.status === 'unlocked' || bonusStatus.status === 'wagering') && (
                  <div>
                    <p className="text-purple-300 font-semibold mb-3">🎯 Wagering Requirement</p>
                    <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
                      <span>Progress</span>
                      <span className="font-mono font-bold text-white">
                        {bonusStatus.wageringProgress} / {bonusStatus.wageringRequired} coins
                      </span>
                    </div>
                    <div className="w-full bg-gray-700/50 rounded-full h-4 overflow-hidden">
                      <div
                        className="h-4 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-500"
                        style={{ width: `${Math.min(bonusStatus.percentageWagered, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">{bonusStatus.percentageWagered}% complete — place predictions to finish</p>
                    <Link href="/dashboard" className="mt-3 inline-block px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition text-sm">
                      Place Predictions →
                    </Link>
                  </div>
                )}

                {bonusStatus.status === 'withdrawable' && (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                    <p className="text-emerald-300 font-semibold mb-1">✅ Ready to Withdraw!</p>
                    <p className="text-emerald-300/70 text-sm">Wagering complete! Your bonus of 🪙 {bonusStatus.amount} is now withdrawable.</p>
                    <Link href="/wallet" className="mt-3 inline-block px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl transition text-sm">
                      Withdraw Now →
                    </Link>
                  </div>
                )}

                {bonusStatus.status === 'expired' && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
                    <p className="text-red-400 font-semibold">❌ Bonus Expired</p>
                    <p className="text-red-400/60 text-sm mt-1">Your signup bonus has expired. Refer friends to earn more coins!</p>
                  </div>
                )}
              </div>
            )}

            {/* How it Works */}
            <div className="bg-gray-800/40 rounded-3xl p-8 border border-gray-700/30">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">📋 How It Works</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { step: '1', icon: '🔗', title: 'Share your link', desc: 'Share your unique referral link or code with friends' },
                  { step: '2', icon: '👤', title: 'Friend signs up', desc: 'Your friend registers using your code — they get 50 bonus coins!' },
                  { step: '3', icon: '🪙', title: 'You earn coins', desc: 'You instantly receive 50 coins credited to your account' },
                ].map(item => (
                  <div key={item.step} className="flex flex-col items-center text-center p-6 bg-gray-900/40 rounded-2xl border border-gray-700/30">
                    <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center font-black text-sm mb-3">{item.step}</div>
                    <div className="text-3xl mb-3">{item.icon}</div>
                    <h4 className="font-bold text-white mb-1">{item.title}</h4>
                    <p className="text-gray-400 text-sm">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Referrals */}
            {referralStats && referralStats.referrals.length > 0 && (
              <div className="bg-gray-800/40 rounded-3xl border border-gray-700/30 overflow-hidden">
                <div className="px-8 py-5 border-b border-gray-700/30">
                  <h3 className="text-lg font-bold">Recent Referrals</h3>
                </div>
                <div className="divide-y divide-gray-700/30">
                  {referralStats.referrals.slice(0, 10).map((r) => (
                    <div key={r._id} className="flex items-center justify-between px-8 py-4">
                      <div>
                        <p className="text-sm font-medium text-white">Friend Referred</p>
                        <p className="text-xs text-gray-500">{new Date(r.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-emerald-400">+{r.bonusAmount} 🪙</p>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${r.status === 'credited' ? 'text-emerald-400 bg-emerald-500/10' : r.status === 'expired' ? 'text-red-400 bg-red-500/10' : 'text-yellow-400 bg-yellow-500/10'}`}>
                          {r.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
