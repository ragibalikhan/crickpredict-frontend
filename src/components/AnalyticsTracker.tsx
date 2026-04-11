'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useStore } from '../store/store';
import { API_BASE } from '../lib/api';

const STORAGE_KEY = 'cp_visitor_key';

function getOrCreateVisitorKey(): string {
  if (typeof window === 'undefined') return '';
  let k = localStorage.getItem(STORAGE_KEY);
  if (!k || k.length < 8) {
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID().replace(/-/g, '')
        : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    k = `v_${id}`.slice(0, 64);
    localStorage.setItem(STORAGE_KEY, k);
  }
  return k;
}

/**
 * Records page views (anonymous visitor key + optional auth) and pings presence for logged-in users.
 */
export default function AnalyticsTracker() {
  const pathname = usePathname() || '/';
  const token = useStore((s) => s.token);
  const visitorKeyRef = useRef('');

  useEffect(() => {
    visitorKeyRef.current = getOrCreateVisitorKey();
  }, []);

  useEffect(() => {
    const vk = visitorKeyRef.current || getOrCreateVisitorKey();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const run = () => {
      fetch(`${API_BASE}/analytics/track`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          visitorKey: vk,
          path: pathname,
          referrer: typeof document !== 'undefined' && document.referrer ? document.referrer : undefined,
        }),
      }).catch(() => {});
    };

    run();
    const id = window.setInterval(run, 90_000);
    return () => clearInterval(id);
  }, [pathname, token]);

  useEffect(() => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    const ping = () => {
      fetch(`${API_BASE}/users/presence`, { method: 'POST', headers }).catch(() => {});
    };
    ping();
    const id = window.setInterval(ping, 45_000);
    return () => clearInterval(id);
  }, [token]);

  return null;
}
