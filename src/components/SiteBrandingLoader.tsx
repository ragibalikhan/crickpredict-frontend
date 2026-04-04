'use client';

import { useEffect } from 'react';
import { API_BASE } from '../lib/api';
import { useStore } from '../store/store';

const DEFAULT_NAME = 'CrickPredict';
const DEFAULT_DESC = 'Real-time IPL skill gaming platform';

export default function SiteBrandingLoader() {
  const setSiteBranding = useStore((s) => s.setSiteBranding);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/public/site-branding`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        const siteName = typeof d.siteName === 'string' && d.siteName.trim() ? d.siteName.trim() : DEFAULT_NAME;
        const siteDescription =
          typeof d.siteDescription === 'string' && d.siteDescription.trim()
            ? d.siteDescription.trim()
            : DEFAULT_DESC;
        const logoUrl = typeof d.logoUrl === 'string' && d.logoUrl.trim() ? d.logoUrl.trim() : null;
        setSiteBranding({ siteName, siteDescription, logoUrl });
        if (typeof document !== 'undefined') {
          document.title = siteName;
          let meta = document.querySelector('meta[name="description"]');
          if (!meta) {
            meta = document.createElement('meta');
            meta.setAttribute('name', 'description');
            document.head.appendChild(meta);
          }
          meta.setAttribute('content', siteDescription);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [setSiteBranding]);

  return null;
}
