'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { getTeamBrand } from '../lib/teamLogos';

type Props = {
  teamName: string;
  size?: number;
  className?: string;
};

/**
 * Franchise logo: tries bundled `/teams/*.png` then remote fallback; else initials on a team-colored disc.
 */
export default function TeamAvatar({ teamName, size = 48, className = '' }: Props) {
  const meta = getTeamBrand(teamName);
  const urls = useMemo(() => meta.logoUrls ?? [], [meta.logoUrls]);
  const [failIdx, setFailIdx] = useState(0);
  const src = urls[failIdx];

  const dim = { width: size, height: size };
  const altLabel = `${teamName || 'Team'} logo`;

  if (!src) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded-full font-black uppercase tracking-tighter text-white shadow-inner ring-2 ring-white/15 ${className}`}
        style={{ ...dim, background: meta.gradient, fontSize: Math.max(11, size * 0.28) }}
        role="img"
        aria-label={altLabel}
      >
        {meta.initials}
      </div>
    );
  }

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full bg-gray-800 ring-2 ring-white/15 ${className}`}
      style={dim}
    >
      <Image
        key={src}
        src={src}
        alt={altLabel}
        width={size}
        height={size}
        className="object-cover"
        sizes={`${size}px`}
        onError={() => setFailIdx((f) => f + 1)}
        unoptimized
      />
    </div>
  );
}
