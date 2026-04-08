'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStore } from '../../store/store';
import Link from 'next/link';
import { API_BASE, ApiError, apiJson } from '../../lib/api';

function RegisterForm() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const setUser = useStore((state) => state.setUser);
  const token = useStore((state) => state.token);
  const siteBranding = useStore((s) => s.siteBranding);
  const siteName = siteBranding?.siteName ?? 'CrickPredict';
  const logoSrc = siteBranding?.logoUrl ? `${API_BASE}${siteBranding.logoUrl}` : null;

  // Auto-fill referral code from URL ?ref=
  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) setReferralCode(ref.toUpperCase());
  }, [searchParams]);

  useEffect(() => {
    if (token) router.replace('/dashboard');
  }, [token, router]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username || !email || !password) { setError('Please fill in all fields'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      const body: Record<string, string> = { username, email, password };
      if (referralCode.trim()) body.referralCode = referralCode.trim().toUpperCase();

      const data = await apiJson<{ user: any; access_token: string }>(`/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setUser(data.user, data.access_token);
      // Flag signup bonus toast for dashboard
      if (data.user.signupBonusStatus === 'locked') {
        sessionStorage.setItem('signup_bonus_toast', '1');
      }
      router.push('/dashboard');
    } catch (err) {
      if (err instanceof ApiError && err.status < 500) {
        setError(err.message || 'Registration failed. Username or email may already exist.');
      } else {
        setError('Cannot connect to server. Check backend is running on port 3000.');
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 relative overflow-hidden px-4">
      {/* Background glows */}
      <div className="absolute w-96 h-96 bg-emerald-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-20 top-10 right-10"></div>
      <div className="absolute w-96 h-96 bg-indigo-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-20 bottom-10 left-10"></div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <Link
            href="/"
            className={
              logoSrc
                ? 'inline-flex items-center justify-center'
                : 'text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500'
            }
            aria-label={siteName}
          >
            {logoSrc ? (
              <img src={logoSrc} alt={siteName} className="h-16 w-16 sm:h-20 sm:w-20 object-contain rounded shrink-0" width={80} height={80} />
            ) : (
              siteName
            )}
          </Link>
          <p className="text-gray-400 mt-2">Create your free account</p>
        </div>

        <form onSubmit={handleRegister} className="bg-gray-800/80 backdrop-blur-md p-8 rounded-3xl shadow-2xl border border-gray-700/50">
          <h2 className="text-2xl font-black mb-2 text-white">Get Started 🚀</h2>
          <p className="text-gray-400 text-sm mb-6">Start with 1,000 free coins on signup!</p>

          {referralCode && (
            <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm flex items-center gap-2">
              🎁 Referral code <strong>{referralCode}</strong> applied — get 50 bonus coins!
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Username</label>
              <input
                id="reg-username"
                className="w-full bg-gray-900/80 text-white px-4 py-3 rounded-xl border border-gray-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                placeholder="Choose a username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Email Address</label>
              <input
                id="reg-email"
                type="email"
                className="w-full bg-gray-900/80 text-white px-4 py-3 rounded-xl border border-gray-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Password</label>
              <input
                id="reg-password"
                type="password"
                className="w-full bg-gray-900/80 text-white px-4 py-3 rounded-xl border border-gray-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                placeholder="Min. 6 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">
                Referral Code <span className="text-gray-600">(optional — get 50 bonus coins!)</span>
              </label>
              <input
                id="reg-referral"
                className="w-full bg-gray-900/80 text-white px-4 py-3 rounded-xl border border-gray-700 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition uppercase tracking-widest font-mono"
                placeholder="e.g. ABC123XY"
                value={referralCode}
                onChange={e => setReferralCode(e.target.value.toUpperCase())}
                maxLength={10}
              />
            </div>
          </div>

          <button
            id="reg-submit"
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-emerald-600/30 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : 'Create Account & Play →'}
          </button>

          <p className="mt-4 text-center text-xs text-gray-500">
            By registering you agree to our Terms of Service & Privacy Policy
          </p>

          <div className="mt-4 text-center text-sm text-gray-400">
            Already have an account?{' '}
            <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-medium transition">
              Sign In
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Register() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <RegisterForm />
    </Suspense>
  );
}
