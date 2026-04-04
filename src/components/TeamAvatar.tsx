'use client';

import Image from 'next/image';
import { useState } from 'react';
import { getTeamBrand } from '../lib/teamLogos';

type Props = {
  teamName: string;
  size?: number;
  className?: string;
};

/**
 * Franchise logo when available (Wikimedia), else initials on a team-colored disc.
 */
export default function TeamAvatar({ teamName, size = 48, className = '' }: Props) {
  const meta = getTeamBrand(teamName);
  const [imgFailed, setImgFailed] = useState(false);
  const showImg = meta.logoUrl && !imgFailed;

  const dim = { width: size, height: size };
  const altLabel = `${teamName || 'Team'} logo`;

  if (!showImg) {
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
        src={meta.logoUrl!}
        alt={altLabel}
        width={size}
        height={size}
        className="object-cover"
        sizes={`${size}px`}
        onError={() => setImgFailed(true)}
        unoptimized
      />
    </div>
  );
}
