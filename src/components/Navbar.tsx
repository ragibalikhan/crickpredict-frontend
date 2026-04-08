'use client';
import Link from 'next/link';
import { useStore } from '../store/store';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useGlobalSocket } from '../hooks/useSocket';
import { API_BASE } from '../lib/api';

export default function Navbar() {
  const { user, logout, notifications, markAllRead, token, setNotifications, siteBranding } = useStore();
  const siteName = siteBranding?.siteName ?? 'CrickPredict';
  const logoSrc = siteBranding?.logoUrl ? `${API_BASE}${siteBranding.logoUrl}` : null;
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Connect global socket for real-time notifications
  useGlobalSocket();

  /** Fallback if socket missed balance push (e.g. admin approved withdrawal while user had stale tab). */
  useEffect(() => {
    if (!token) return;
    const syncBalance = () => {
      if (document.visibilityState !== 'visible') return;
      fetch(`${API_BASE}/users/profile`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data && typeof data.coinsBalance === 'number') {
            useStore.getState().updateCoins(data.coinsBalance);
          }
        })
        .catch(() => {});
    };
    document.addEventListener('visibilitychange', syncBalance);
    return () => document.removeEventListener('visibilitychange', syncBalance);
  }, [token]);

  // Fetch existing notifications on load
  useEffect(() => {
    if (!token || !user) return;
    fetch(`${API_BASE}/notifications`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setNotifications(data);
        }
      })
      .catch(() => {});
  }, [token, user?.id]);

  const handleLogout = () => { logout(); router.push('/login'); };

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleOpenNotifs = () => {
    setShowNotifs((s) => !s);
    if (!showNotifs && unreadCount > 0) {
      markAllRead();
      const unread = notifications.filter((n) => !n.read && n?._id).slice(0, 20);
      if (token && unread.length > 0) {
        Promise.all(
          unread.map((n) =>
            fetch(`${API_BASE}/notifications/${n._id}/read`, {
              method: 'PATCH',
              headers: { Authorization: `Bearer ${token}` },
            }).catch(() => null),
          ),
        ).catch(() => null);
      }
    }
  };

  const notifIcon = (type: string) => ({ info: '💬', success: '✅', warning: '⚠️', error: '🚨' }[type] || '🔔');
  const notifBg = (type: string) => ({ info: 'border-blue-500/30', success: 'border-emerald-500/30', warning: 'border-yellow-500/30', error: 'border-red-500/30' }[type] || 'border-gray-700');

  if (pathname === '/' || pathname === '/login' || pathname === '/register') return null;

  if (!mounted) return <nav className="fixed top-0 w-full z-50 h-16 bg-gray-900/80 backdrop-blur-md border-b border-gray-800" />;

  if (!user) return (
    <nav className="fixed top-0 w-full z-50 bg-gray-900/80 backdrop-blur-md border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link
          href="/"
          className={
            logoSrc
              ? 'flex items-center'
              : 'text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500'
          }
          aria-label={siteName}
        >
          {logoSrc ? (
            <img src={logoSrc} alt={siteName} className="h-12 w-12 sm:h-14 sm:w-14 object-contain rounded shrink-0" width={56} height={56} />
          ) : (
            siteName
          )}
        </Link>
        <div className="flex gap-3">
          <Link href="/login" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition text-sm">Login</Link>
          <Link href="/register" className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg transition text-sm">Register</Link>
        </div>
      </div>
    </nav>
  );

  return (
    <>
      <nav className="fixed top-0 w-full z-50 bg-gray-900/80 backdrop-blur-md border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-6">
              <Link
                href="/dashboard"
                className={
                  logoSrc
                    ? 'flex items-center'
                    : 'text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500'
                }
                aria-label={siteName}
              >
                {logoSrc ? (
                  <img src={logoSrc} alt={siteName} className="h-12 w-12 sm:h-14 sm:w-14 object-contain rounded shrink-0" width={56} height={56} />
                ) : (
                  siteName
                )}
              </Link>
              <div className="hidden md:flex gap-1">
                {[
                  { href: '/dashboard', label: '🏏 Matches' },
                  { href: '/leaderboard', label: '🏆 Leaderboard' },
                  { href: '/wallet', label: '💰 Wallet' },
                  { href: '/refer', label: '🎁 Refer & Earn' },
                  ...(user.role === 'admin' ? [{ href: '/admin', label: '⚙️ Admin' }] : []),
                ].map(link => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-3 py-1.5 rounded-lg hover:text-white transition text-sm font-medium ${
                      pathname.startsWith(link.href) ? 'text-white bg-white/5' : 'text-gray-400 hover:bg-white/5'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Coin Balance */}
              <div className="flex items-center gap-1.5 bg-yellow-500/10 px-3 py-1.5 rounded-full border border-yellow-500/20">
                <span>🪙</span>
                <span className="font-bold text-yellow-400 tabular-nums text-sm">{user.coinsBalance?.toLocaleString()}</span>
              </div>

              {/* Notification Bell */}
              <div className="relative">
                <button
                  onClick={handleOpenNotifs}
                  className="relative w-9 h-9 flex items-center justify-center rounded-full bg-gray-800 hover:bg-gray-700 border border-gray-700 transition cursor-pointer"
                >
                  <span className="text-lg">🔔</span>
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-black animate-pulse">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {showNotifs && (
                  <div className="absolute right-0 mt-2 w-80 bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
                      <p className="font-bold text-white">Notifications</p>
                      <button onClick={() => setShowNotifs(false)} className="text-gray-400 hover:text-white text-xs">✕</button>
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="text-center py-8 text-gray-500 text-sm">No notifications yet</p>
                      ) : (
                        notifications.slice(0, 20).map((n, i) => (
                          <div key={n._id || i} className={`px-4 py-3 border-b border-gray-700/50 border-l-2 ${notifBg(n.type)} hover:bg-gray-700/30`}>
                            <div className="flex items-start gap-2">
                              <span className="text-base mt-0.5">{notifIcon(n.type)}</span>
                              <div>
                                <p className="font-semibold text-white text-sm">{n.title}</p>
                                <p className="text-gray-400 text-xs mt-0.5">{n.message}</p>
                                <p className="text-gray-600 text-xs mt-1">{n.createdAt ? new Date(n.createdAt).toLocaleTimeString() : ''}</p>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Avatar Dropdown */}
              <div className="relative group">
                <button className="flex items-center gap-2 focus:outline-none cursor-pointer">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold shadow-lg text-sm border-2 border-indigo-400/30">
                    {user.username?.charAt(0).toUpperCase()}
                  </div>
                  <span className="hidden md:block text-sm text-gray-300 font-medium">{user.username}</span>
                  <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                <div className="absolute right-0 mt-2 w-52 bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  <div className="p-4 border-b border-gray-700 rounded-t-2xl">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold mb-2 text-sm">
                      {user.username?.charAt(0).toUpperCase()}
                    </div>
                    <p className="font-bold text-white truncate">{user.username}</p>
                    <p className="text-xs text-gray-400 mt-0.5">🪙 {user.coinsBalance?.toLocaleString()} coins</p>
                  </div>
                  <div className="p-2">
                    {[
                      { href: '/profile', icon: '👤', label: 'My Profile' },
                      { href: '/wallet', icon: '💰', label: 'Wallet & UPI' },
                      { href: '/refer', icon: '🎁', label: 'Refer & Earn' },
                      { href: '/leaderboard', icon: '🏆', label: 'Leaderboard' },
                      ...(user.role === 'admin' ? [{ href: '/admin', icon: '⚙️', label: 'Admin Panel' }] : []),
                    ].map(item => (
                      <Link key={item.href} href={item.href} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white rounded-xl transition">
                        <span>{item.icon}</span> {item.label}
                      </Link>
                    ))}
                    <div className="border-t border-gray-700 mt-2 pt-2">
                      <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-xl transition cursor-pointer">
                        <span>🚪</span> Logout
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile bottom tab bar */}
      <div className="md:hidden fixed bottom-0 left-0 w-full bg-gray-900/95 backdrop-blur-md border-t border-gray-800 flex justify-around items-end pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] z-50">
        {[
          { href: '/dashboard', icon: '🏏', label: 'Matches' },
          { href: '/leaderboard', icon: '🏆', label: 'Rank' },
          { href: '/wallet', icon: '💰', label: 'Wallet' },
          { href: '/refer', icon: '🎁', label: 'Refer' },
          { href: '/profile', icon: '👤', label: 'Profile' },
        ].map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex min-w-[3.25rem] flex-col items-center gap-0.5 rounded-xl px-2 py-1 text-[10px] font-semibold transition active:scale-95 ${
              pathname.startsWith(item.href) ? 'text-yellow-400' : 'text-gray-500 active:text-gray-400'
            }`}
          >
            <span className="text-[1.35rem] leading-none">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </div>
    </>
  );
}
