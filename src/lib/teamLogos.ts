/**
 * IPL / T20 franchise branding for avatars. Logos are optional Wikimedia thumbnails;
 * we fall back to colored initials when the image fails or no mapping exists.
 */
export type TeamBrand = {
  initials: string;
  gradient: string;
  /** Optional remote logo (Wikipedia / Commons). */
  logoUrl?: string;
};

const ENTRIES: Array<{
  test: (n: string) => boolean;
  initials: string;
  gradient: string;
  logoUrl?: string;
}> = [
  {
    test: (n) => /chennai|super kings|\bcsk\b/i.test(n),
    initials: 'CSK',
    gradient: 'linear-gradient(145deg, #facc15 0%, #eab308 45%, #ca8a04 100%)',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/en/thumb/2/2b/Chennai_Super_Kings_Logo.svg/120px-Chennai_Super_Kings_Logo.svg.png',
  },
  {
    test: (n) => /mumbai indians|\bmi\b/i.test(n),
    initials: 'MI',
    gradient: 'linear-gradient(145deg, #2563eb 0%, #1d4ed8 50%, #1e3a8a 100%)',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/en/thumb/c/cd/Mumbai_Indians_Logo.svg/120px-Mumbai_Indians_Logo.svg.png',
  },
  {
    test: (n) => /royal challengers|bangalore|\brcb\b/i.test(n),
    initials: 'RCB',
    gradient: 'linear-gradient(145deg, #ef4444 0%, #b91c1c 55%, #7f1d1d 100%)',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/en/thumb/2/2a/Royal_Challengers_Bangalore_2020.svg/120px-Royal_Challengers_Bangalore_2020.svg.png',
  },
  {
    test: (n) => /kolkata|knight riders|\bkkr\b/i.test(n),
    initials: 'KKR',
    gradient: 'linear-gradient(145deg, #4c1d95 0%, #5b21b6 40%, #312e81 100%)',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/en/thumb/4/4c/Kolkata_Knight_Riders_Logo.svg/120px-Kolkata_Knight_Riders_Logo.svg.png',
  },
  {
    test: (n) => /rajasthan royals|\brr\b/i.test(n),
    initials: 'RR',
    gradient: 'linear-gradient(145deg, #ec4899 0%, #db2777 45%, #9d174d 100%)',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Rajasthan_Royals_Logo.png/120px-Rajasthan_Royals_Logo.png',
  },
  {
    test: (n) => /sunrisers|hyderabad|\bsrh\b/i.test(n),
    initials: 'SRH',
    gradient: 'linear-gradient(145deg, #f97316 0%, #ea580c 50%, #9a3412 100%)',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/en/thumb/8/81/Sunrisers_Hyderabad.svg/120px-Sunrisers_Hyderabad.svg.png',
  },
  {
    test: (n) => /delhi capitals|\bdc\b/i.test(n),
    initials: 'DC',
    gradient: 'linear-gradient(145deg, #0ea5e9 0%, #0369a1 50%, #0c4a6e 100%)',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/en/thumb/f/f5/Delhi_Capitals_Logo.svg/120px-Delhi_Capitals_Logo.svg.png',
  },
  {
    test: (n) => /punjab|kings xi|\bpbks\b|\bkxip\b/i.test(n),
    initials: 'PBKS',
    gradient: 'linear-gradient(145deg, #dc2626 0%, #b91c1c 45%, #7f1d1d 100%)',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/en/thumb/d/d4/Punjab_Kings_Logo.svg/120px-Punjab_Kings_Logo.svg.png',
  },
  {
    test: (n) => /lucknow|super giants|\blsg\b/i.test(n),
    initials: 'LSG',
    gradient: 'linear-gradient(145deg, #38bdf8 0%, #0ea5e9 45%, #0369a1 100%)',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/en/thumb/a/a9/Lucknow_Super_Giants_IPL_Logo.svg/120px-Lucknow_Super_Giants_IPL_Logo.svg.png',
  },
  {
    test: (n) => /gujarat titans|\bgt\b/i.test(n),
    initials: 'GT',
    gradient: 'linear-gradient(145deg, #1e3a5f 0%, #0f172a 55%, #1e293b 100%)',
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/en/thumb/0/09/Gujarat_Titans_Logo.svg/120px-Gujarat_Titans_Logo.svg.png',
  },
];

export function getTeamBrand(teamName: string): TeamBrand {
  const n = (teamName || 'Team').trim();
  for (const e of ENTRIES) {
    if (e.test(n)) {
      return { initials: e.initials, gradient: e.gradient, logoUrl: e.logoUrl };
    }
  }
  const words = n.split(/\s+/).filter(Boolean);
  let initials =
    words.length >= 2
      ? `${words[0].charAt(0)}${words[1].charAt(0)}`
      : n.slice(0, 2) || 'T';
  initials = initials.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3) || 'TM';
  return {
    initials,
    gradient: 'linear-gradient(145deg, #475569 0%, #334155 50%, #1e293b 100%)',
  };
}
