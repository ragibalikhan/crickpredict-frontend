'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '../../store/store';
import Link from 'next/link';
import { API_BASE } from '../../lib/api';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const setUser = useStore((state) => state.setUser);
  const siteBranding = useStore((s) => s.siteBranding);
  const siteName = siteBranding?.siteName ?? 'CrickPredict';
  const logoSrc = siteBranding?.logoUrl ? `${API_BASE}${siteBranding.logoUrl}` : null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username || !password) { setError('Please fill in all fields'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();
      if (res.ok) {
        setUser(data.user, data.access_token);
        router.push('/dashboard');
      } else {
        setError(data.message || 'Invalid username or password');
      }
    } catch {
      setError('Cannot connect to server. Check backend is running.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 relative overflow-hidden px-4">
      {/* Background glows */}
      <div className="absolute w-96 h-96 bg-indigo-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-20 top-10 left-10"></div>
      <div className="absolute w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-20 bottom-10 right-10"></div>

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
              <img src={logoSrc} alt={siteName} className="h-9 w-9 object-contain rounded shrink-0" width={36} height={36} />
            ) : (
              siteName
            )}
          </Link>
          <p className="text-gray-400 mt-2">Sign in to your account</p>
        </div>

        <form onSubmit={handleLogin} className="bg-gray-800/80 backdrop-blur-md p-8 rounded-3xl shadow-2xl border border-gray-700/50">
          <h2 className="text-2xl font-black mb-6 text-white">Welcome Back 👋</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Username</label>
              <input
                id="login-username"
                className="w-full bg-gray-900/80 text-white px-4 py-3 rounded-xl border border-gray-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                placeholder="Enter your username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Password</label>
              <input
                id="login-password"
                type="password"
                className="w-full bg-gray-900/80 text-white px-4 py-3 rounded-xl border border-gray-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                placeholder="Enter your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
          </div>

          <button
            id="login-submit"
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-indigo-600/30 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : 'Sign In'}
          </button>

          <div className="mt-6 text-center text-sm text-gray-400">
            Don't have an account?{' '}
            <Link href="/register" className="text-indigo-400 hover:text-indigo-300 font-medium transition">
              Create one free
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
