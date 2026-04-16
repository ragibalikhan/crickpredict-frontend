'use client';
import { useEffect, useState, useCallback, useRef, useMemo, type ChangeEvent } from 'react';
import { useStore } from '../../store/store';
import { useRouter } from 'next/navigation';
import { API_BASE } from '../../lib/api';
import { formatInr, publicUploadUrl } from '../../lib/moneyDisplay';

const BALL_OUTCOME_ORDER = ['Dot', '1-2 Runs', '4 Runs', '6 Runs', 'Wicket', 'Extras'];

function PpImageEditorRow({
  marketId,
  initialUrl,
  headers,
  adminFetch,
  onSaved,
  showToast,
}: {
  marketId: string;
  initialUrl: string;
  headers: Record<string, string>;
  adminFetch: (url: string, init?: RequestInit) => Promise<Response>;
  onSaved: (rows: unknown[]) => void;
  showToast: (msg: string, type?: string) => void;
}) {
  const [draft, setDraft] = useState(initialUrl);
  useEffect(() => {
    setDraft(initialUrl);
  }, [initialUrl, marketId]);

  return (
    <div className="flex flex-col gap-1">
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="https://…"
        className="w-full text-[11px] bg-gray-900 border border-gray-700 rounded px-2 py-1 text-gray-200"
      />
      <button
        type="button"
        className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 text-left"
        onClick={async () => {
          const res = await adminFetch(`${API_BASE}/admin/player-props/markets/${marketId}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
              playerImageUrl: draft.trim() ? draft.trim() : null,
            }),
          });
          const d = await res.json().catch(() => ({}));
          if (res.ok) onSaved(d as unknown[]);
          else showToast((d as { message?: string })?.message || 'Image update failed', 'error');
        }}
      >
        Save image
      </button>
    </div>
  );
}

function sortBallOutcomes<T extends { predictionValue: string }>(rows: T[]): T[] {
  const order = new Map(BALL_OUTCOME_ORDER.map((k, i) => [k, i]));
  return [...rows].sort((a, b) => {
    const ia = order.has(a.predictionValue) ? order.get(a.predictionValue)! : 1000;
    const ib = order.has(b.predictionValue) ? order.get(b.predictionValue)! : 1000;
    if (ia !== ib) return ia - ib;
    return a.predictionValue.localeCompare(b.predictionValue);
  });
}

type Tab =
  | 'overview'
  | 'analytics'
  | 'users'
  | 'deposits'
  | 'withdrawals'
  | 'accounts'
  | 'notify'
  | 'multipliers'
  | 'bonus'
  | 'branding'
  | 'playerProps';

export default function AdminPage() {
  const { token, user, setSiteBranding, siteBranding, logout } = useStore();
  const router = useRouter();
  const sessionExpiredRef = useRef(false);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      router.push('/dashboard');
    }
  }, [user, router]);

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [matchBetting, setMatchBetting] = useState<
    Array<{
      matchId: string;
      teamA?: string;
      teamB?: string;
      matchStatus?: string;
      totalBets: number;
      totalStaked: number;
      wonCount: number;
      lostCount: number;
      pendingCount: number;
      totalWonPayout: number;
    }>
  | null>(null);
  const [tossAdminMatches, setTossAdminMatches] = useState<
    Array<{
      _id: string;
      teamA: string;
      teamB: string;
      status?: string;
      tossWinnerSide?: 'A' | 'B';
    }>
  >([]);
  const [tossDraftByMatchId, setTossDraftByMatchId] = useState<Record<string, '' | 'A' | 'B'>>({});
  const [betOutcomeStats, setBetOutcomeStats] = useState<{
    outcomes: Array<{
      predictionValue: string;
      totalBets: number;
      wonCount: number;
      lostCount: number;
      pendingCount: number;
    }>;
    mostWins: { predictionValue: string; count: number } | null;
    mostLosses: { predictionValue: string; count: number } | null;
  } | null>(null);
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
  const [tossBetDraft, setTossBetDraft] = useState('1.8');
  const [favouriteTeamBetDraft, setFavouriteTeamBetDraft] = useState('2');
  const [teamVsTeamBetDraft, setTeamVsTeamBetDraft] = useState('2');
  const [teamVsTeamProbDraft, setTeamVsTeamProbDraft] = useState('50');
  const [simCrowdDraft, setSimCrowdDraft] = useState({ enabled: false, winBiasPercent: 80 });
  const [bonusSettings, setBonusSettings] = useState({
    signupBonusAmount: 50,
    signupInitialCoins: 0,
    signupBonusMinDepositRequired: 100,
    signupBonusWageringMultiplier: 1,
    referralBonusAmount: 50,
    bonusExpiryDays: 30,
  });
  const [bonusDraft, setBonusDraft] = useState({ ...bonusSettings });
  const [brandingDraft, setBrandingDraft] = useState({
    siteName: 'CrickPredict',
    siteDescription: 'Real-time IPL skill gaming platform',
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
  const [newUpiQrFile, setNewUpiQrFile] = useState<File | null>(null);
  const newUpiQrInputRef = useRef<HTMLInputElement>(null);

  const [syncForm, setSyncForm] = useState<{ id: string; increment: string; setTotal: string } | null>(null);
  const [smsPaste, setSmsPaste] = useState('');
  const [smsParseResult, setSmsParseResult] = useState<any>(null);

  const [ppMatches, setPpMatches] = useState<
    Array<{ _id: string; teamA: string; teamB: string; status?: string; externalId?: string }>
  >([]);
  const [ppMatchId, setPpMatchId] = useState('');
  const [ppSquadData, setPpSquadData] = useState<{
    match: { externalId?: string; teamA: string; teamB: string; status?: string };
    squad: { teams: Array<{ teamName: string; players: Array<{ name: string; role: string; isPlayable?: boolean }> }>; source?: string } | null;
  } | null>(null);
  const [ppMarkets, setPpMarkets] = useState<
    Array<{
      id: string;
      teamName: string;
      playerName: string;
      statType: string;
      condition?: 'more_than' | 'less_than';
      threshold: number;
      multiplier: number;
      isPublished: boolean;
      status: string;
      playerImageUrl?: string | null;
    }>
  >([]);
  const [ppForm, setPpForm] = useState({
    teamName: '',
    playerName: '',
    statType: 'runs' as 'runs' | 'wickets',
    condition: 'more_than' as 'more_than' | 'less_than',
    threshold: '20',
    oppositeThreshold: '20',
    multiplier: '5',
    isPublished: false,
    createOppositeOption: true,
    playerImageUrl: '',
  });
  const [ppManual, setPpManual] = useState({
    teamName: '',
    name: '',
    role: 'batsman' as 'batsman' | 'bowler' | 'keeper_batsman' | 'all_rounder',
  });

  const [ppSettlementStatus, setPpSettlementStatus] = useState<{
    pendingMatches: number;
    items: Array<{
      matchId: string;
      teamLabel: string;
      matchStatus: string;
      pendingBets: number;
      attemptCount: number;
      nextRetryAt: string | null;
      lastError?: string;
      lastResult?: { settled: number; skipped: number; unresolvedLines: number };
    }>;
  } | null>(null);
  const [ppSettlementAudit, setPpSettlementAudit] = useState<
    Array<{
      id: string;
      kind: string;
      matchId: string | null;
      details: Record<string, unknown>;
      createdAt?: string;
    }>
  >([]);

  const ppTeamOptions = useMemo(() => {
    const set = new Set<string>();
    if (ppSquadData?.match?.teamA) set.add(ppSquadData.match.teamA);
    if (ppSquadData?.match?.teamB) set.add(ppSquadData.match.teamB);
    for (const t of ppSquadData?.squad?.teams || []) {
      if (t.teamName) set.add(t.teamName);
    }
    return Array.from(set);
  }, [ppSquadData]);

  const [onlineWithin, setOnlineWithin] = useState(2);
  const [onlineRole, setOnlineRole] = useState<'user' | 'admin' | 'all'>('user');
  const [onlineAnalytics, setOnlineAnalytics] = useState<{
    withinMinutes: number;
    roleFilter: string;
    count: number;
    users: Array<{ _id: string; username: string; email: string; role: string; lastSeenAt?: string }>;
  } | null>(null);
  const [visitFilters, setVisitFilters] = useState({
    from: '',
    to: '',
    path: '',
    visitorKey: '',
    userId: '',
    limit: '100',
    skip: '0',
  });
  const [visitData, setVisitData] = useState<{
    items: Array<{
      _id: string;
      visitorKey: string;
      path: string;
      referrer?: string;
      createdAt?: string;
      userId?: { _id: string; username: string; email: string } | null;
    }>;
    total: number;
    limit: number;
    skip: number;
  } | null>(null);
  const [pendingBetFilters, setPendingBetFilters] = useState({
    type: 'all',
    matchId: '',
    q: '',
    limit: '200',
    skip: '0',
  });
  const [pendingBetsData, setPendingBetsData] = useState<{
    items: Array<{
      id: string;
      type: string;
      predictionValue: string;
      amountStaked: number;
      multiplier: number;
      createdAt?: string;
      user: { id: string; username: string; email: string } | null;
      match: { id: string; teamA: string; teamB: string; status: string } | null;
    }>;
    limit: number;
    skip: number;
    count: number;
  } | null>(null);
  const [selectedPendingBetIds, setSelectedPendingBetIds] = useState<string[]>([]);

  const headers = useMemo(
    () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
    [token],
  );

  const showToast = (msg: string, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const onAdminUnauthorized = useCallback(() => {
    if (sessionExpiredRef.current) return;
    sessionExpiredRef.current = true;
    logout();
    setToast({ msg: 'Session expired or invalid. Please sign in again.', type: 'error' });
    setTimeout(() => setToast(null), 4500);
    router.push('/login');
  }, [logout, router]);

  useEffect(() => {
    sessionExpiredRef.current = false;
  }, [token]);

  /** Admin API fetch: clears session and sends you to login on 401 (expired/wrong JWT vs backend). */
  const adminFetch = useCallback(
    async (url: string, init?: RequestInit): Promise<Response> => {
      const h =
        init?.body instanceof FormData
          ? { Authorization: (headers as { Authorization: string }).Authorization }
          : { ...headers, ...(init?.headers as Record<string, string> | undefined) };
      const res = await fetch(url, { ...init, headers: h });
      if (res.status === 401) onAdminUnauthorized();
      return res;
    },
    [headers, onAdminUnauthorized],
  );

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const res = await adminFetch(`${API_BASE}/admin/stats`);
      if (res.ok) {
        const s = await res.json();
        setStats(s);
        if (s.coinsPerInr != null) setCoinRateDraft(String(s.coinsPerInr));
      } else if (res.status === 401) {
        setStats(null);
      } else {
        const d = (await res.json().catch(() => ({}))) as { message?: string };
        setStats(null);
        setStatsError(d.message || `Could not load overview statistics (HTTP ${res.status}).`);
      }
    } catch {
      setStats(null);
      setStatsError('Network error — check that the API is running and API_BASE is correct.');
    } finally {
      setStatsLoading(false);
    }
  }, [adminFetch]);

  const fetchMatchBetting = useCallback(async () => {
    const res = await adminFetch(`${API_BASE}/admin/matches/betting-stats`, { headers });
    if (res.ok) setMatchBetting(await res.json());
  }, [adminFetch, headers]);

  const fetchBetOutcomeStats = useCallback(async () => {
    const res = await adminFetch(`${API_BASE}/admin/stats/bet-outcomes`, { headers });
    if (res.ok) setBetOutcomeStats(await res.json());
  }, [adminFetch, headers]);

  const fetchBallMultipliers = useCallback(async () => {
    const res = await adminFetch(`${API_BASE}/admin/settings/ball-multipliers`, { headers });
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
  }, [adminFetch, headers]);

  const fetchTossBetSettings = useCallback(async () => {
    const res = await adminFetch(`${API_BASE}/admin/settings/toss-bet`, { headers });
    if (!res.ok) return;
    const d = await res.json();
    const m = d.tossBetMultiplier;
    setTossBetDraft(
      typeof m === 'number' && Number.isFinite(m) ? String(m) : '1.8',
    );
  }, [adminFetch, headers]);

  const fetchFavouriteTeamBetSettings = useCallback(async () => {
    const res = await adminFetch(`${API_BASE}/admin/settings/favourite-team-bet`, { headers });
    if (!res.ok) return;
    const d = await res.json();
    const m = d.favouriteTeamBetMultiplier;
    setFavouriteTeamBetDraft(
      typeof m === 'number' && Number.isFinite(m) ? String(m) : '2',
    );
  }, [adminFetch, headers]);

  const fetchTeamVsTeamBetSettings = useCallback(async () => {
    const res = await adminFetch(`${API_BASE}/admin/settings/team-vs-team-bet`, { headers });
    if (!res.ok) return;
    const d = await res.json();
    const m = d.teamVsTeamBetMultiplier;
    const p = Number(d.teamVsTeamProbA ?? 0.5);
    setTeamVsTeamBetDraft(
      typeof m === 'number' && Number.isFinite(m) ? String(m) : '2',
    );
    setTeamVsTeamProbDraft(String(Math.round(Math.min(97, Math.max(3, p * 100)))));
  }, [adminFetch, headers]);

  const fetchSimulatedCrowd = useCallback(async () => {
    const res = await adminFetch(`${API_BASE}/admin/settings/simulated-crowd`, { headers });
    if (!res.ok) return;
    const d = await res.json();
    setSimCrowdDraft({
      enabled: !!d.simulatedCrowdEnabled,
      winBiasPercent: Math.min(100, Math.max(0, Math.round(Number(d.simulatedCrowdWinBias ?? 0.8) * 100))),
    });
  }, [adminFetch, headers]);

  const fetchBonusSettings = useCallback(async () => {
    const res = await adminFetch(`${API_BASE}/admin/settings/signup-bonus`, { headers });
    if (!res.ok) return;
    const d = await res.json();
    setBonusSettings(d);
    setBonusDraft({
      signupBonusAmount: d.signupBonusAmount,
      signupInitialCoins: d.signupInitialCoins ?? 0,
      signupBonusMinDepositRequired: d.signupBonusMinDepositRequired,
      signupBonusWageringMultiplier: d.signupBonusWageringMultiplier,
      referralBonusAmount: d.referralBonusAmount,
      bonusExpiryDays: d.bonusExpiryDays,
    });
  }, [adminFetch, headers]);

  const fetchBrandingSettings = useCallback(async () => {
    const res = await adminFetch(`${API_BASE}/admin/settings/site-branding`, { headers });
    if (!res.ok) return;
    const d = await res.json();
    setBrandingDraft({
      siteName: d.siteName ?? 'CrickPredict',
      siteDescription: d.siteDescription ?? 'Real-time IPL skill gaming platform',
    });
    setSiteBranding({
      siteName: d.siteName ?? 'CrickPredict',
      siteDescription: d.siteDescription ?? 'Real-time IPL skill gaming platform',
      logoUrl: d.logoUrl ?? null,
    });
  }, [adminFetch, headers, setSiteBranding]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const res = await adminFetch(`${API_BASE}/admin/users`, { headers });
    if (res.ok) setUsers(await res.json());
    setLoading(false);
  }, [adminFetch, headers]);

  const fetchWithdrawals = useCallback(async () => {
    setLoading(true);
    const res = await adminFetch(`${API_BASE}/admin/withdrawals`, { headers });
    if (res.ok) setWithdrawals(await res.json());
    setLoading(false);
  }, [adminFetch, headers]);

  const fetchDeposits = useCallback(async () => {
    setLoading(true);
    const res = await adminFetch(`${API_BASE}/admin/deposits`, { headers });
    if (res.ok) setDeposits(await res.json());
    setLoading(false);
  }, [adminFetch, headers]);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    const res = await adminFetch(`${API_BASE}/admin/payment-accounts`, { headers });
    if (res.ok) setAccounts(await res.json());
    setLoading(false);
  }, [adminFetch, headers]);

  const fetchOnlineAnalytics = useCallback(async () => {
    const params = new URLSearchParams();
    params.set('withinMinutes', String(onlineWithin));
    params.set('role', onlineRole);
    const res = await adminFetch(`${API_BASE}/admin/analytics/online?${params}`, { headers });
    if (res.ok) setOnlineAnalytics(await res.json());
  }, [adminFetch, headers, onlineWithin, onlineRole]);

  const fetchVisits = useCallback(async () => {
    const params = new URLSearchParams();
    if (visitFilters.from.trim()) {
      const d = new Date(visitFilters.from);
      if (!Number.isNaN(d.getTime())) params.set('from', d.toISOString());
    }
    if (visitFilters.to.trim()) {
      const d = new Date(visitFilters.to);
      if (!Number.isNaN(d.getTime())) params.set('to', d.toISOString());
    }
    if (visitFilters.path.trim()) params.set('path', visitFilters.path.trim());
    if (visitFilters.visitorKey.trim()) params.set('visitorKey', visitFilters.visitorKey.trim());
    if (visitFilters.userId.trim()) params.set('userId', visitFilters.userId.trim());
    params.set('limit', visitFilters.limit || '100');
    params.set('skip', visitFilters.skip || '0');
    const res = await adminFetch(`${API_BASE}/admin/analytics/visits?${params}`, { headers });
    if (res.ok) setVisitData(await res.json());
  }, [adminFetch, headers, visitFilters]);

  const fetchPendingBets = useCallback(async () => {
    const params = new URLSearchParams();
    if (pendingBetFilters.type && pendingBetFilters.type !== 'all') params.set('type', pendingBetFilters.type);
    if (pendingBetFilters.matchId.trim()) params.set('matchId', pendingBetFilters.matchId.trim());
    if (pendingBetFilters.q.trim()) params.set('q', pendingBetFilters.q.trim());
    params.set('limit', pendingBetFilters.limit || '200');
    params.set('skip', pendingBetFilters.skip || '0');
    const res = await adminFetch(`${API_BASE}/admin/bets/pending?${params}`, { headers });
    if (res.ok) {
      const d = await res.json();
      setPendingBetsData(d);
      setSelectedPendingBetIds((prev) => prev.filter((id) => (d.items || []).some((x: { id: string }) => x.id === id)));
    }
  }, [adminFetch, headers, pendingBetFilters]);

  const fetchPpMatches = useCallback(async () => {
    const res = await fetch(`${API_BASE}/matches`);
    if (res.ok) {
      const data = await res.json();
      setPpMatches(Array.isArray(data) ? data : []);
    }
  }, []);

  const fetchTossAdminMatches = useCallback(async () => {
    const res = await fetch(`${API_BASE}/matches`);
    if (!res.ok) return;
    const data = (await res.json().catch(() => [])) as Array<{
      _id?: string;
      teamA?: string;
      teamB?: string;
      status?: string;
      tossWinnerSide?: 'A' | 'B';
    }>;
    const rows = (Array.isArray(data) ? data : [])
      .filter((m) => m._id && m.teamA && m.teamB)
      .slice(0, 20)
      .map((m) => ({
        _id: String(m._id),
        teamA: String(m.teamA),
        teamB: String(m.teamB),
        status: m.status,
        tossWinnerSide: m.tossWinnerSide,
      }));
    setTossAdminMatches(rows);
    setTossDraftByMatchId((prev) => {
      const next = { ...prev };
      for (const row of rows) {
        if (!(row._id in next)) next[row._id] = row.tossWinnerSide ?? '';
      }
      return next;
    });
  }, []);

  const loadPlayerPropsDetail = useCallback(
    async (matchId: string) => {
      if (!matchId) return;
      const [sRes, mRes] = await Promise.all([
        adminFetch(`${API_BASE}/admin/player-props/match/${matchId}/squad`, { headers }),
        adminFetch(`${API_BASE}/admin/player-props/match/${matchId}/markets`, { headers }),
      ]);
      if (sRes.ok) {
        const d = await sRes.json();
        setPpSquadData(d);
      } else setPpSquadData(null);
      if (mRes.ok) setPpMarkets(await mRes.json());
      else setPpMarkets([]);
    },
    [adminFetch, headers],
  );

  const fetchPpSettlementHealth = useCallback(async () => {
    const [sRes, aRes] = await Promise.all([
      adminFetch(`${API_BASE}/admin/player-props/settlement-status`, { headers }),
      adminFetch(`${API_BASE}/admin/player-props/settlement-audit?limit=50`, { headers }),
    ]);
    if (sRes.ok) setPpSettlementStatus(await sRes.json());
    if (aRes.ok) setPpSettlementAudit(await aRes.json());
  }, [adminFetch, headers]);

  useEffect(() => {
    if (!token || user?.role !== 'admin') return;
    void fetchPpSettlementHealth();
    const tick = setInterval(() => void fetchPpSettlementHealth(), 120_000);
    return () => clearInterval(tick);
  }, [token, user?.role, fetchPpSettlementHealth]);

  useEffect(() => {
    if (!token) {
      setStatsLoading(false);
      setStatsError(null);
      return;
    }
    fetchStats();
    fetchUsers();
  }, [token, fetchStats, fetchUsers]);

  useEffect(() => {
    if (!token) return;
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'withdrawals') fetchWithdrawals();
    if (activeTab === 'deposits') fetchDeposits();
    if (activeTab === 'accounts') fetchAccounts();
    if (activeTab === 'multipliers') {
      fetchBallMultipliers();
      fetchTossBetSettings();
      fetchFavouriteTeamBetSettings();
      fetchTeamVsTeamBetSettings();
      fetchSimulatedCrowd();
    }
    if (activeTab === 'bonus') fetchBonusSettings();
    if (activeTab === 'branding') fetchBrandingSettings();
    if (activeTab === 'playerProps') {
      fetchPpMatches();
      fetchPpSettlementHealth();
      fetchPendingBets();
      if (ppMatchId) loadPlayerPropsDetail(ppMatchId);
    }
    if (activeTab === 'overview') {
      fetchMatchBetting();
      fetchBetOutcomeStats();
      fetchTossAdminMatches();
    }
    if (activeTab === 'analytics') {
      fetchOnlineAnalytics();
      fetchVisits();
    }
  }, [
    activeTab,
    token,
    fetchMatchBetting,
    fetchBetOutcomeStats,
    fetchTossAdminMatches,
    fetchUsers,
    fetchWithdrawals,
    fetchDeposits,
    fetchAccounts,
    fetchBallMultipliers,
    fetchTossBetSettings,
    fetchFavouriteTeamBetSettings,
    fetchTeamVsTeamBetSettings,
    fetchSimulatedCrowd,
    fetchBonusSettings,
    fetchBrandingSettings,
    fetchPpMatches,
    fetchPpSettlementHealth,
    fetchPendingBets,
    loadPlayerPropsDetail,
    ppMatchId,
    fetchOnlineAnalytics,
    fetchVisits,
  ]);

  const saveManualTossWinner = async (matchId: string) => {
    const pick = tossDraftByMatchId[matchId] ?? '';
    setActionLoading(`tossManual_${matchId}`);
    const res = await adminFetch(`${API_BASE}/admin/matches/${matchId}/outcome-settings`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ tossWinnerSide: pick || null }),
    });
    if (res.ok) {
      showToast('Toss winner updated');
      fetchTossAdminMatches();
    } else {
      const d = (await res.json().catch(() => ({}))) as { message?: string };
      showToast(d.message || 'Failed to update toss winner', 'error');
    }
    setActionLoading(null);
  };

  useEffect(() => {
    if (ppTeamOptions.length === 0) return;
    setPpForm((f) =>
      f.teamName && ppTeamOptions.includes(f.teamName)
        ? f
        : { ...f, teamName: ppTeamOptions[0] },
    );
    setPpManual((m) =>
      m.teamName && ppTeamOptions.includes(m.teamName)
        ? m
        : { ...m, teamName: ppTeamOptions[0] },
    );
  }, [ppTeamOptions]);

  const saveCoinRate = async () => {
    const n = Number(coinRateDraft);
    if (!Number.isFinite(n) || n < 1) return showToast('Enter a valid wallet multiplier (per ₹1 paid)', 'error');
    setActionLoading('coinRate');
    const res = await adminFetch(`${API_BASE}/admin/settings/coin-rate`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ coinsPerInr: n }),
    });
    if (res.ok) {
      showToast('Wallet credit rate updated');
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
    const res = await adminFetch(`${API_BASE}/admin/settings/ball-multipliers`, {
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

  const saveTossBetMultiplier = async () => {
    const n = Number(tossBetDraft);
    if (!Number.isFinite(n) || n < 1.01 || n > 100) {
      return showToast('Toss multiplier must be between 1.01 and 100', 'error');
    }
    setActionLoading('tossBet');
    const res = await adminFetch(`${API_BASE}/admin/settings/toss-bet`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ tossBetMultiplier: n }),
    });
    if (res.ok) {
      showToast('Toss bet multiplier updated');
      fetchTossBetSettings();
    } else {
      const d = await res.json();
      showToast(d.message || 'Failed', 'error');
    }
    setActionLoading(null);
  };

  const saveFavouriteTeamBetMultiplier = async () => {
    const n = Number(favouriteTeamBetDraft);
    if (!Number.isFinite(n) || n < 1.01 || n > 100) {
      return showToast('Favourite team multiplier must be between 1.01 and 100', 'error');
    }
    setActionLoading('favouriteTeamBet');
    const res = await adminFetch(`${API_BASE}/admin/settings/favourite-team-bet`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ favouriteTeamBetMultiplier: n }),
    });
    if (res.ok) {
      showToast('Favourite team multiplier updated');
      fetchFavouriteTeamBetSettings();
    } else {
      const d = await res.json();
      showToast(d.message || 'Failed', 'error');
    }
    setActionLoading(null);
  };

  const saveTeamVsTeamBetMultiplier = async () => {
    const n = Number(teamVsTeamBetDraft);
    const pct = Number(teamVsTeamProbDraft);
    if (!Number.isFinite(n) || n < 1.01 || n > 100) {
      return showToast('Risk Match vs Match multiplier must be between 1.01 and 100', 'error');
    }
    if (!Number.isFinite(pct) || pct < 3 || pct > 97) {
      return showToast('Team A chance must be between 3% and 97%', 'error');
    }
    setActionLoading('teamVsTeamBet');
    const res = await adminFetch(`${API_BASE}/admin/settings/team-vs-team-bet`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ teamVsTeamBetMultiplier: n, teamVsTeamProbA: pct / 100 }),
    });
    if (res.ok) {
      showToast('Risk Match vs Match multiplier updated');
      fetchTeamVsTeamBetSettings();
    } else {
      const d = await res.json();
      showToast(d.message || 'Failed', 'error');
    }
    setActionLoading(null);
  };

  const saveSimulatedCrowd = async () => {
    const pct = Number(simCrowdDraft.winBiasPercent);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      return showToast('Win chance must be 0–100%', 'error');
    }
    setActionLoading('simCrowd');
    const res = await adminFetch(`${API_BASE}/admin/settings/simulated-crowd`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        simulatedCrowdEnabled: simCrowdDraft.enabled,
        simulatedCrowdWinBias: pct / 100,
      }),
    });
    if (res.ok) {
      showToast('Simulated crowd settings saved');
      fetchSimulatedCrowd();
    } else {
      const d = await res.json();
      showToast(d.message || 'Failed', 'error');
    }
    setActionLoading(null);
  };

  const saveBonusSettings = async () => {
    setActionLoading('saveBonus');
    const res = await adminFetch(`${API_BASE}/admin/settings/signup-bonus`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(bonusDraft),
    });
    if (res.ok) {
      showToast('Bonus settings updated');
      fetchBonusSettings();
    } else {
      const d = await res.json();
      showToast(d.message || 'Failed', 'error');
    }
    setActionLoading(null);
  };

  const saveBrandingText = async () => {
    setActionLoading('branding');
    const res = await adminFetch(`${API_BASE}/admin/settings/site-branding`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        siteName: brandingDraft.siteName,
        siteDescription: brandingDraft.siteDescription,
      }),
    });
    if (res.ok) {
      const d = await res.json();
      showToast('Site name & description updated');
      setSiteBranding({
        siteName: d.siteName,
        siteDescription: d.siteDescription,
        logoUrl: d.logoUrl ?? null,
      });
      if (typeof document !== 'undefined') {
        document.title = d.siteName;
      }
      fetchBrandingSettings();
    } else {
      const err = await res.json().catch(() => ({}));
      showToast(err.message || 'Failed to update branding', 'error');
    }
    setActionLoading(null);
  };

  const uploadSiteLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setActionLoading('brandingLogo');
    const fd = new FormData();
    fd.append('file', file);
    const res = await adminFetch(`${API_BASE}/admin/settings/site-branding/logo`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    if (res.ok) {
      const d = await res.json();
      showToast('Logo updated');
      setSiteBranding({
        siteName: d.siteName,
        siteDescription: d.siteDescription,
        logoUrl: d.logoUrl ?? null,
      });
    } else {
      const err = await res.json().catch(() => ({}));
      showToast(err.message || 'Upload failed', 'error');
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
    const res = await adminFetch(`${API_BASE}/admin/users/${editingUser._id}`, {
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
    const res = await adminFetch(`${API_BASE}/admin/withdrawals/${id}/approve`, { method: 'PATCH', headers });
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
    const res = await adminFetch(`${API_BASE}/admin/withdrawals/${id}/reject`, {
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
    const res = await adminFetch(`${API_BASE}/admin/deposits/${id}/approve`, { method: 'PATCH', headers });
    if (res.ok) {
      showToast('Deposit approved — wallet credited (INR)');
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
    const res = await adminFetch(`${API_BASE}/admin/payment-sync/parse-sms`, {
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
    const res = await adminFetch(`${API_BASE}/admin/payment-sync/confirm-with-sms`, {
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
    const res = await adminFetch(`${API_BASE}/admin/deposits/${id}/reject`, {
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
    const qrFile = newUpiQrFile;
    const res = await adminFetch(`${API_BASE}/admin/payment-accounts`, {
      method: 'POST',
      headers,
      body: JSON.stringify(newAccount),
    });
    const data = (await res.json().catch(() => null)) as { _id?: string; message?: string } | null;
    if (res.ok) {
      const createdId = data?._id;
      if (newAccount.kind === 'upi' && qrFile && createdId && token) {
        const fd = new FormData();
        fd.append('file', qrFile);
        const upRes = await adminFetch(`${API_BASE}/admin/payment-accounts/${createdId}/upi-qr`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        const upData = (await upRes.json().catch(() => ({}))) as { message?: string };
        if (upRes.ok) showToast('Payment account and QR code added');
        else showToast(upData.message || 'Account added, but QR upload failed', 'warning');
      } else {
        showToast('Payment account added');
      }
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
      setNewUpiQrFile(null);
      newUpiQrInputRef.current && (newUpiQrInputRef.current.value = '');
      fetchAccounts();
    } else {
      showToast(data?.message || 'Failed', 'error');
    }
    setActionLoading(null);
  };

  const setPrimary = async (id: string) => {
    setActionLoading(id + '_pri');
    const res = await adminFetch(`${API_BASE}/admin/payment-accounts/${id}/primary`, { method: 'POST', headers });
    if (res.ok) {
      setAccounts(await res.json());
      showToast('Primary account updated');
    } else showToast('Failed', 'error');
    setActionLoading(null);
  };

  const deleteAccount = async (id: string) => {
    if (!confirm('Delete this payment account?')) return;
    setActionLoading(id + '_del');
    const res = await adminFetch(`${API_BASE}/admin/payment-accounts/${id}`, { method: 'DELETE', headers });
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
    const res = await adminFetch(`${API_BASE}/admin/payment-accounts/${syncForm.id}`, { method: 'PATCH', headers, body: JSON.stringify(body) });
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

  const resyncMatchFeed = async () => {
    setActionLoading('matchResync');
    const res = await adminFetch(`${API_BASE}/admin/matches/resync-feed`, { method: 'POST', headers });
    const d = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
    setActionLoading(null);
    if (res.ok && d.ok) showToast(d.message || 'Matches synced');
    else showToast(d.message || 'Sync failed', 'error');
  };

  const uploadUpiQr = async (accountId: string, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !token) return;
    setActionLoading('upiqr_' + accountId);
    const fd = new FormData();
    fd.append('file', file);
    const res = await adminFetch(`${API_BASE}/admin/payment-accounts/${accountId}/upi-qr`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    const d = (await res.json().catch(() => ({}))) as { message?: string };
    setActionLoading(null);
    if (res.ok) {
      showToast('UPI QR code updated');
      fetchAccounts();
    } else showToast(d.message || 'Upload failed', 'error');
  };

  const sendNotification = async () => {
    if (!notifyForm.title || !notifyForm.message) return showToast('Fill in title and message', 'error');
    setActionLoading('notify');
    const res = await adminFetch(`${API_BASE}/admin/notify`, {
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

  const settleSelectedPendingBets = async (isWon: boolean) => {
    if (selectedPendingBetIds.length === 0) {
      showToast('Select at least one pending bet', 'error');
      return;
    }
    const ok = confirm(
      `Settle ${selectedPendingBetIds.length} selected pending bet(s) as ${isWon ? 'WIN' : 'LOSS'}?`,
    );
    if (!ok) return;
    setActionLoading(isWon ? 'settlePendingWin' : 'settlePendingLoss');
    const res = await adminFetch(`${API_BASE}/admin/bets/settle-bulk`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        predictionIds: selectedPendingBetIds,
        isWon,
      }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok) {
      showToast(`Bulk settle done: settled ${d.settled ?? 0}, skipped ${d.skipped ?? 0}`);
      setSelectedPendingBetIds([]);
      fetchPendingBets();
      fetchMatchBetting();
      fetchStats();
    } else {
      showToast(d?.message || 'Bulk settle failed', 'error');
    }
    setActionLoading(null);
  };

  const tabs: { id: Tab; label: string; icon: string; badge?: number }[] = useMemo(
    () => [
      { id: 'overview', label: 'Overview', icon: '📊' },
      { id: 'analytics', label: 'Analytics', icon: '📡' },
      { id: 'users', label: 'Users', icon: '👥' },
      { id: 'deposits', label: 'INR deposits', icon: '💰', badge: stats?.pendingDeposits },
      { id: 'withdrawals', label: 'Withdrawals', icon: '💸', badge: stats?.pendingWithdrawals },
      { id: 'accounts', label: 'Payment accounts', icon: '🏦' },
      { id: 'multipliers', label: 'Game Multipliers', icon: '🎯' },
      { id: 'bonus', label: 'Bonus Settings', icon: '🎁' },
      { id: 'branding', label: 'Site branding', icon: '🎨' },
      {
        id: 'playerProps',
        label: 'Player props',
        icon: '🏏',
        badge: ppSettlementStatus?.pendingMatches,
      },
      { id: 'notify', label: 'Notify Users', icon: '🔔' },
    ],
    [stats?.pendingDeposits, stats?.pendingWithdrawals, ppSettlementStatus?.pendingMatches],
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white pb-mobile-nav">
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
                <label className="text-xs text-gray-500">Wallet balance (INR)</label>
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
            <p className="text-gray-400 mt-1">Users, INR deposits, payment accounts, wallet rate, withdrawals</p>
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

        {activeTab === 'overview' && (
          <div className="space-y-6">
            {statsLoading && (
              <div className="rounded-2xl border border-gray-700/50 bg-gray-800/40 py-16 text-center text-gray-400">
                Loading overview…
              </div>
            )}
            {statsError && !statsLoading && (
              <div className="rounded-2xl border border-red-500/40 bg-red-950/30 p-8 text-center">
                <p className="text-red-200 font-semibold mb-1">Overview could not be loaded</p>
                <p className="text-sm text-red-300/90 mb-4">{statsError}</p>
                <button
                  type="button"
                  onClick={() => void fetchStats()}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-white"
                >
                  Retry
                </button>
              </div>
            )}
            {stats && !statsLoading && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[
                    { label: 'Total Users', value: stats.totalUsers, icon: '👤', color: 'from-blue-600 to-indigo-600' },
                    { label: 'Pending deposits', value: stats.pendingDeposits, icon: '⏳', color: 'from-amber-600 to-orange-600' },
                    { label: 'Pending Withdrawals', value: stats.pendingWithdrawals, icon: '⏳', color: 'from-yellow-600 to-orange-600' },
                    { label: 'Total Withdrawals', value: stats.totalWithdrawals, icon: '💸', color: 'from-purple-600 to-pink-600' },
                    {
                      label: 'Wallet total (INR units)',
                      value: formatInr(stats.totalCoinsInCirculation),
                      icon: '₹',
                      color: 'from-yellow-500 to-amber-500',
                    },
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

                <div className="bg-gray-800/60 border border-gray-700/50 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-lg">Resync live &amp; upcoming matches</h3>
                    <p className="text-sm text-gray-400 mt-1 max-w-xl">
                      Runs the same feed pull as the background job (CricAPI when enabled, otherwise the live-scores scraper). Use this if fixtures or scores look stuck.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={resyncMatchFeed}
                    disabled={!!actionLoading}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold disabled:opacity-50 shrink-0"
                  >
                    {actionLoading === 'matchResync' ? 'Syncing…' : '↻ Resync now'}
                  </button>
                </div>
              </>
            )}

            {!statsLoading && betOutcomeStats && (
              <div className="bg-gray-800/60 border border-gray-700/50 rounded-2xl p-6 overflow-hidden">
                <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
                  <div>
                    <h3 className="font-bold text-lg">Ball outcomes (app-wide)</h3>
                    <p className="text-sm text-gray-400">
                      Wins and losses by pick (Dot, 1–2 Runs, 4, 6, Wicket, Extras). Settled bets only for win rate.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => fetchBetOutcomeStats()}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm"
                  >
                    ↻ Refresh
                  </button>
                </div>

                <div className="flex flex-wrap gap-3 mb-5">
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-4 py-3 min-w-[200px]">
                    <p className="text-xs text-emerald-300/80 uppercase tracking-wide font-semibold">Most winning pick</p>
                    <p className="text-lg font-black text-white mt-1">
                      {betOutcomeStats.mostWins
                        ? `${betOutcomeStats.mostWins.predictionValue} · ${betOutcomeStats.mostWins.count} wins`
                        : '—'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-rose-500/30 bg-rose-950/40 px-4 py-3 min-w-[200px]">
                    <p className="text-xs text-rose-300/80 uppercase tracking-wide font-semibold">Most losing pick</p>
                    <p className="text-lg font-black text-white mt-1">
                      {betOutcomeStats.mostLosses
                        ? `${betOutcomeStats.mostLosses.predictionValue} · ${betOutcomeStats.mostLosses.count} losses`
                        : '—'}
                    </p>
                  </div>
                </div>

                {betOutcomeStats.outcomes.length === 0 ? (
                  <p className="text-gray-500 text-sm">No ball bets recorded yet.</p>
                ) : (
                  <div className="overflow-x-auto -mx-2">
                    <table className="w-full text-sm min-w-[640px]">
                      <thead>
                        <tr className="bg-gray-900/50 text-gray-400 text-xs uppercase tracking-wider">
                          <th className="px-3 py-2 text-left">Outcome</th>
                          <th className="px-3 py-2 text-right">Bets</th>
                          <th className="px-3 py-2 text-right">Won</th>
                          <th className="px-3 py-2 text-right">Lost</th>
                          <th className="px-3 py-2 text-right">Pending</th>
                          <th className="px-3 py-2 text-right">Win rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortBallOutcomes(betOutcomeStats.outcomes).map((row) => {
                          const settled = row.wonCount + row.lostCount;
                          const winRate = settled > 0 ? Math.round((row.wonCount / settled) * 1000) / 10 : null;
                          return (
                            <tr key={row.predictionValue} className="border-t border-gray-700/40">
                              <td className="px-3 py-2 font-medium text-white">{row.predictionValue}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{row.totalBets}</td>
                              <td className="px-3 py-2 text-right text-emerald-400 tabular-nums">{row.wonCount}</td>
                              <td className="px-3 py-2 text-right text-rose-400 tabular-nums">{row.lostCount}</td>
                              <td className="px-3 py-2 text-right text-amber-300/90 tabular-nums">{row.pendingCount}</td>
                              <td className="px-3 py-2 text-right tabular-nums text-gray-300">
                                {winRate != null ? `${winRate}%` : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {!statsLoading && matchBetting && matchBetting.length > 0 && (
              <div className="bg-gray-800/60 border border-gray-700/50 rounded-2xl p-6 overflow-hidden">
                <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
                  <div>
                    <h3 className="font-bold text-lg">Match betting</h3>
                    <p className="text-sm text-gray-400">Total stakes, wins, and losses per match (includes completed fixtures).</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => fetchMatchBetting()}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm"
                  >
                    ↻ Refresh
                  </button>
                </div>
                <div className="overflow-x-auto -mx-2">
                  <table className="w-full text-sm min-w-[720px]">
                    <thead>
                      <tr className="bg-gray-900/50 text-gray-400 text-xs uppercase tracking-wider">
                        <th className="px-3 py-2 text-left">Match</th>
                        <th className="px-3 py-2 text-left">Status</th>
                        <th className="px-3 py-2 text-right">Bets</th>
                        <th className="px-3 py-2 text-right">Staked (INR)</th>
                        <th className="px-3 py-2 text-right">Won</th>
                        <th className="px-3 py-2 text-right">Lost</th>
                        <th className="px-3 py-2 text-right">Pending</th>
                        <th className="px-3 py-2 text-right">Payout (won)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matchBetting.map((row) => (
                        <tr key={String(row.matchId)} className="border-t border-gray-700/40">
                          <td className="px-3 py-2">
                            <span className="font-medium text-white">
                              {row.teamA ?? '—'} vs {row.teamB ?? '—'}
                            </span>
                            <div className="text-[10px] text-gray-500 font-mono truncate max-w-[200px]">{String(row.matchId)}</div>
                          </td>
                          <td className="px-3 py-2 capitalize text-gray-300">{row.matchStatus ?? '—'}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{row.totalBets}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatInr(row.totalStaked ?? 0)}</td>
                          <td className="px-3 py-2 text-right text-emerald-400 tabular-nums">{row.wonCount}</td>
                          <td className="px-3 py-2 text-right text-rose-400 tabular-nums">{row.lostCount}</td>
                          <td className="px-3 py-2 text-right text-amber-300/90 tabular-nums">{row.pendingCount}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatInr(row.totalWonPayout ?? 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {!statsLoading && (
              <div className="bg-gray-800/60 border border-gray-700/50 rounded-2xl p-6">
                <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
                  <div>
                    <h3 className="font-bold text-lg">Manual toss winner</h3>
                    <p className="text-sm text-gray-400">
                      Set or clear toss winner quickly for live/upcoming fixtures.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={fetchTossAdminMatches}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm"
                  >
                    ↻ Refresh
                  </button>
                </div>
                <div className="overflow-x-auto -mx-2">
                  <table className="w-full text-sm min-w-[760px]">
                    <thead>
                      <tr className="bg-gray-900/50 text-gray-400 text-xs uppercase tracking-wider">
                        <th className="px-3 py-2 text-left">Match</th>
                        <th className="px-3 py-2 text-left">Status</th>
                        <th className="px-3 py-2 text-left">Current toss winner</th>
                        <th className="px-3 py-2 text-left">Set manually</th>
                        <th className="px-3 py-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tossAdminMatches.map((m) => (
                        <tr key={m._id} className="border-t border-gray-700/40">
                          <td className="px-3 py-2">
                            <div className="font-medium text-white">
                              {m.teamA} vs {m.teamB}
                            </div>
                            <div className="text-[10px] text-gray-500 font-mono truncate max-w-[260px]">{m._id}</div>
                          </td>
                          <td className="px-3 py-2 capitalize text-gray-300">{m.status || '—'}</td>
                          <td className="px-3 py-2 text-gray-300">
                            {m.tossWinnerSide === 'A'
                              ? `A (${m.teamA})`
                              : m.tossWinnerSide === 'B'
                                ? `B (${m.teamB})`
                                : '—'}
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={tossDraftByMatchId[m._id] ?? ''}
                              onChange={(e) => {
                                const v = e.target.value as '' | 'A' | 'B';
                                setTossDraftByMatchId((prev) => ({ ...prev, [m._id]: v }));
                              }}
                              className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-sm"
                            >
                              <option value="">Clear / Unknown</option>
                              <option value="A">A ({m.teamA})</option>
                              <option value="B">B ({m.teamB})</option>
                            </select>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              disabled={!!actionLoading}
                              onClick={() => saveManualTossWinner(m._id)}
                              className="px-3 py-1.5 bg-indigo-600/80 hover:bg-indigo-500 rounded-lg text-xs font-bold disabled:opacity-50"
                            >
                              {actionLoading === `tossManual_${m._id}` ? 'Saving…' : 'Save'}
                            </button>
                          </td>
                        </tr>
                      ))}
                      {tossAdminMatches.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                            No matches available.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {!statsLoading && (
              <div className="bg-gray-800/60 border border-gray-700/50 rounded-2xl p-6 max-w-xl">
                <h3 className="font-bold text-lg mb-1">Deposit → wallet credit</h3>
                <p className="text-sm text-gray-400 mb-4">
                  Multiplier of wallet balance (shown as INR) credited per ₹1 deposited. Example: 10 means ₹100 paid → ₹1,000 wallet credit after approval.
                </p>
                <div className="flex gap-3 flex-wrap items-end">
                  <div>
                    <label className="text-xs text-gray-500">Wallet units per ₹1 paid</label>
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
            )}
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
                      <th className="px-4 py-3 text-right">Balance (INR)</th>
                      <th className="px-4 py-3 text-right">Credits</th>
                      <th className="px-4 py-3 text-right">Wins</th>
                      <th className="px-4 py-3 text-right">Losses</th>
                      <th className="px-4 py-3 text-center">Bonus Status</th>
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
                          <td className="px-4 py-3 text-right font-mono font-bold text-yellow-400">
                            {formatInr(u.coinsBalance ?? 0)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-cyan-300">{(u.creditsBalance ?? 0).toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-emerald-400 font-semibold">{u.totalWins || 0}</td>
                          <td className="px-4 py-3 text-right text-red-400 font-semibold">{u.totalLosses || 0}</td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                u.signupBonusStatus === 'withdrawable'
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : u.signupBonusStatus === 'unlocked'
                                    ? 'bg-blue-500/20 text-blue-400'
                                    : u.signupBonusStatus === 'locked' || u.signupBonusStatus === 'wagering'
                                      ? 'bg-yellow-500/20 text-yellow-400'
                                      : u.signupBonusStatus === 'expired'
                                        ? 'bg-red-500/20 text-red-400'
                                        : 'bg-gray-700 text-gray-400'
                              }`}
                            >
                              {(u.signupBonusStatus || 'none').toUpperCase()}
                            </span>
                          </td>
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
                        <p className="text-xs text-gray-500">Wallet credit (INR)</p>
                        <p className="font-black text-yellow-400">{formatInr(d.coinsToCredit ?? 0)}</p>
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
                        <p className="font-black text-yellow-400 text-xl">{formatInr(w.amount ?? 0)}</p>
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
                  onChange={(e) => {
                    const kind = e.target.value as 'upi' | 'bank';
                    setNewAccount((a) => ({ ...a, kind }));
                    if (kind !== 'upi') {
                      setNewUpiQrFile(null);
                      if (newUpiQrInputRef.current) newUpiQrInputRef.current.value = '';
                    }
                  }}
                >
                  <option value="upi">UPI</option>
                  <option value="bank">Bank</option>
                </select>
                {newAccount.kind === 'upi' ? (
                  <>
                    <input
                      className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 md:col-span-2"
                      placeholder="UPI ID"
                      value={newAccount.upiId}
                      onChange={(e) => setNewAccount((a) => ({ ...a, upiId: e.target.value }))}
                    />
                    <div className="md:col-span-2 flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-gray-700/80 bg-gray-900/40 px-3 py-3">
                      <label className="inline-flex items-center gap-2 text-sm text-gray-300 cursor-pointer shrink-0">
                        <input
                          ref={newUpiQrInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          className="hidden"
                          disabled={!!actionLoading}
                          onChange={(e) => {
                            const f = e.target.files?.[0] ?? null;
                            setNewUpiQrFile(f);
                          }}
                        />
                        <span className="px-3 py-2 rounded-lg bg-indigo-600/50 hover:bg-indigo-600/70 font-semibold text-white text-xs">
                          {newUpiQrFile ? 'Change QR image' : 'Upload payee QR (optional)'}
                        </span>
                      </label>
                      {newUpiQrFile && (
                        <span className="text-xs text-gray-400 truncate" title={newUpiQrFile.name}>
                          {newUpiQrFile.name}
                        </span>
                      )}
                      <p className="text-xs text-gray-500 sm:ml-auto">
                        PNG, JPEG, WebP, or GIF · max 2 MB · shown on wallet deposit
                      </p>
                    </div>
                  </>
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
              <p className="text-xs text-gray-500 mt-3">
                For UPI accounts you can attach a payee QR when adding the account, or later with <strong>Upload / replace QR</strong> in the list (shown with the UPI ID on the wallet deposit screen).
              </p>
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
                        <div className="space-y-2">
                          <p className="font-mono text-emerald-400">{a.upiId}</p>
                          {publicUploadUrl(a.upiQrPath) && (
                            <img
                              src={publicUploadUrl(a.upiQrPath)}
                              alt="UPI QR"
                              className="h-24 w-24 rounded-lg border border-gray-600 bg-white p-1 object-contain"
                            />
                          )}
                          <label className="inline-flex items-center gap-2 text-xs text-indigo-300 cursor-pointer">
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp,image/gif"
                              className="hidden"
                              disabled={!!actionLoading}
                              onChange={(e) => uploadUpiQr(a._id, e)}
                            />
                            <span className="px-2 py-1 rounded-lg bg-indigo-600/40 hover:bg-indigo-600/60 font-semibold">
                              {actionLoading === 'upiqr_' + a._id ? '…' : 'Upload / replace QR'}
                            </span>
                          </label>
                        </div>
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
                onClick={() => {
                  fetchBallMultipliers();
                  fetchTossBetSettings();
                  fetchFavouriteTeamBetSettings();
                  fetchTeamVsTeamBetSettings();
                  fetchSimulatedCrowd();
                }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm transition"
              >
                ↻ Refresh
              </button>
            </div>

            <div className="bg-gray-800/60 border border-emerald-700/35 rounded-2xl p-8 space-y-5">
              <h3 className="text-lg font-bold text-white">Toss betting</h3>
              <p className="text-sm text-gray-400">
                Single fixed multiplier for both teams on <code className="text-gray-300">type: &apos;toss&apos;</code> bets.
                Users keep this multiplier when they place a bet (shown on the match page until toss is recorded).
              </p>
              <div>
                <label className="block text-xs text-gray-500 mb-2">Toss multiplier (×)</label>
                <input
                  type="number"
                  min={1.01}
                  max={100}
                  step={0.1}
                  className="w-full max-w-xs bg-gray-900 border border-gray-700 rounded-xl px-4 py-2 text-white"
                  value={tossBetDraft}
                  onChange={(e) => setTossBetDraft(e.target.value)}
                />
              </div>
              <button
                type="button"
                disabled={actionLoading === 'tossBet'}
                onClick={saveTossBetMultiplier}
                className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold disabled:opacity-50"
              >
                {actionLoading === 'tossBet' ? 'Saving…' : 'Save toss multiplier'}
              </button>
            </div>

            <div className="bg-gray-800/60 border border-indigo-700/30 rounded-2xl p-8 space-y-5">
              <h3 className="text-lg font-bold text-white">Favourite team (pre-match)</h3>
              <p className="text-sm text-gray-400">
                Fixed multiplier for both teams on <code className="text-gray-300">type: &apos;match_winner&apos;</code> bets.
              </p>
              <div>
                <label className="block text-xs text-gray-500 mb-2">Favourite team multiplier (×)</label>
                <input
                  type="number"
                  min={1.01}
                  max={100}
                  step={0.1}
                  className="w-full max-w-xs bg-gray-900 border border-gray-700 rounded-xl px-4 py-2 text-white"
                  value={favouriteTeamBetDraft}
                  onChange={(e) => setFavouriteTeamBetDraft(e.target.value)}
                />
              </div>
              <button
                type="button"
                disabled={actionLoading === 'favouriteTeamBet'}
                onClick={saveFavouriteTeamBetMultiplier}
                className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold disabled:opacity-50"
              >
                {actionLoading === 'favouriteTeamBet' ? 'Saving…' : 'Save favourite team multiplier'}
              </button>
            </div>

            <div className="bg-gray-800/60 border border-gray-700/50 rounded-2xl p-8 space-y-5">
              <h3 className="text-lg font-bold text-white">Risk Match vs Match (pre-match)</h3>
              <p className="text-sm text-gray-400">
                Fixed multiplier for both teams on <code className="text-gray-300">type: &apos;team_vs_team&apos;</code> bets.
                This controls the Risk Match vs Match market shown in the pre-match tab. Losing side returns 0x.
              </p>
              <div>
                <label className="block text-xs text-gray-500 mb-2">Risk Match vs Match multiplier (×)</label>
                <input
                  type="number"
                  min={1.01}
                  max={100}
                  step={0.1}
                  className="w-full max-w-xs bg-gray-900 border border-gray-700 rounded-xl px-4 py-2 text-white"
                  value={teamVsTeamBetDraft}
                  onChange={(e) => setTeamVsTeamBetDraft(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-2">Team A win chance (%)</label>
                <input
                  type="number"
                  min={3}
                  max={97}
                  step={1}
                  className="w-full max-w-xs bg-gray-900 border border-gray-700 rounded-xl px-4 py-2 text-white"
                  value={teamVsTeamProbDraft}
                  onChange={(e) => setTeamVsTeamProbDraft(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Team B chance auto = 100 - Team A. Display multipliers adjust from these percentages.
                </p>
              </div>
              <button
                type="button"
                disabled={actionLoading === 'teamVsTeamBet'}
                onClick={saveTeamVsTeamBetMultiplier}
                className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold disabled:opacity-50"
              >
                {actionLoading === 'teamVsTeamBet' ? 'Saving…' : 'Save Risk Match vs Match multiplier'}
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

            <div className="bg-gray-800/60 border border-amber-700/30 rounded-2xl p-8 space-y-5">
              <h3 className="text-lg font-bold text-white">Simulated live crowd (demo)</h3>
              <p className="text-sm text-gray-400">
                When enabled, random Indian-style display names place fake ball bets on <strong className="text-gray-300">live</strong>{' '}
                matches. No wallet amounts are debited or credited. Bets appear in &quot;Live bets on this match&quot;. When each ball settles, simulated
                bets randomly win at the rate below (default 80%). Admin betting stats ignore these rows.
              </p>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-5 h-5 rounded border-gray-600 bg-gray-900"
                  checked={simCrowdDraft.enabled}
                  onChange={(e) => setSimCrowdDraft((d) => ({ ...d, enabled: e.target.checked }))}
                />
                <span className="font-semibold text-white">Enable simulated crowd</span>
              </label>
              <div>
                <label className="block text-xs text-gray-500 mb-2">Simulated win chance when ball settles (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="w-full max-w-xs bg-gray-900 border border-gray-700 rounded-xl px-4 py-2 text-white"
                  value={simCrowdDraft.winBiasPercent}
                  onChange={(e) => setSimCrowdDraft((d) => ({ ...d, winBiasPercent: Number(e.target.value) }))}
                />
              </div>
              <button
                type="button"
                disabled={actionLoading === 'simCrowd'}
                onClick={saveSimulatedCrowd}
                className="px-5 py-3 bg-amber-600 hover:bg-amber-500 rounded-xl font-bold disabled:opacity-50"
              >
                {actionLoading === 'simCrowd' ? 'Saving…' : 'Save crowd settings'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'branding' && (
          <div className="max-w-2xl space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <h2 className="text-xl font-bold">Site name, description & logo</h2>
              <button
                type="button"
                onClick={fetchBrandingSettings}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm transition"
              >
                ↻ Refresh
              </button>
            </div>

            <div className="bg-gray-800/60 border border-gray-700/50 rounded-2xl p-8 space-y-6">
              <p className="text-sm text-gray-400">
                Shown in the navbar, login/register, landing hero, and browser title. Logo: PNG, JPEG, WebP, or GIF up to 2 MB.
              </p>

              <div>
                <label className="text-xs text-gray-500 uppercase font-bold tracking-wider">Site name</label>
                <input
                  type="text"
                  className="block mt-1.5 bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 w-full text-white"
                  value={brandingDraft.siteName}
                  onChange={(e) => setBrandingDraft((d) => ({ ...d, siteName: e.target.value }))}
                  maxLength={120}
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 uppercase font-bold tracking-wider">Short description</label>
                <textarea
                  className="block mt-1.5 bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 w-full text-white min-h-[100px] resize-y"
                  value={brandingDraft.siteDescription}
                  onChange={(e) => setBrandingDraft((d) => ({ ...d, siteDescription: e.target.value }))}
                  maxLength={500}
                />
                <p className="text-[10px] text-gray-500 mt-1">Landing page subtitle and meta description (max 500 characters).</p>
              </div>

              <div className="pt-2 border-t border-gray-700/50">
                <label className="text-xs text-gray-500 uppercase font-bold tracking-wider block mb-2">Logo image</label>
                <div className="flex flex-wrap items-center gap-4">
                  {siteBranding?.logoUrl && (
                    <img
                      src={`${API_BASE}${siteBranding.logoUrl}`}
                      alt="Current logo"
                      className="h-24 w-24 sm:h-28 sm:w-28 object-contain rounded-lg border border-gray-600 bg-gray-900 p-1"
                    />
                  )}
                  <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-semibold cursor-pointer disabled:opacity-50">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                      disabled={actionLoading === 'brandingLogo'}
                      onChange={uploadSiteLogo}
                    />
                    {actionLoading === 'brandingLogo' ? 'Uploading…' : 'Upload new logo'}
                  </label>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  disabled={actionLoading === 'branding'}
                  onClick={saveBrandingText}
                  className="w-full md:w-auto px-10 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                >
                  {actionLoading === 'branding' ? 'Saving…' : 'Save name & description'}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'bonus' && (
          <div className="max-w-2xl space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">Global Bonus Settings</h2>
              <button
                type="button"
                onClick={fetchBonusSettings}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm transition"
              >
                ↻ Refresh
              </button>
            </div>

            <div className="bg-gray-800/60 border border-gray-700/50 rounded-2xl p-8 space-y-5">
              <p className="text-sm text-gray-400">
                Configure limits and amounts for the Refer & Earn and Signup Bonus systems.
              </p>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="text-xs text-gray-500 uppercase font-bold tracking-wider">Signup bonus (INR in wallet)</label>
                  <input
                    type="number"
                    className="block mt-1.5 bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 w-full text-white"
                    value={bonusDraft.signupBonusAmount}
                    onChange={(e) => setBonusDraft((d) => ({ ...d, signupBonusAmount: Number(e.target.value) }))}
                  />
                  <p className="text-[10px] text-gray-500 mt-1">Amount given to new users (starts as LOCKED).</p>
                </div>

                <div>
                  <label className="text-xs text-gray-500 uppercase font-bold tracking-wider">Signup starting balance (INR) 🆕</label>
                  <input
                    type="number"
                    className="block mt-1.5 bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 w-full text-white"
                    value={bonusDraft.signupInitialCoins}
                    onChange={(e) => setBonusDraft((d) => ({ ...d, signupInitialCoins: Number(e.target.value) }))}
                  />
                  <p className="text-[10px] text-gray-500 mt-1">Base wallet balance for every newly created account.</p>
                </div>

                <div>
                  <label className="text-xs text-gray-500 uppercase font-bold tracking-wider">Min Deposit to Unlock (₹) 💰</label>
                  <input
                    type="number"
                    className="block mt-1.5 bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 w-full text-white"
                    value={bonusDraft.signupBonusMinDepositRequired}
                    onChange={(e) => setBonusDraft((d) => ({ ...d, signupBonusMinDepositRequired: Number(e.target.value) }))}
                  />
                  <p className="text-[10px] text-gray-500 mt-1">Minimum single deposit required to move bonus to UNLOCKED.</p>
                </div>

                <div>
                  <label className="text-xs text-gray-500 uppercase font-bold tracking-wider">Wagering Multiplier (x) 🎯</label>
                  <input
                    type="number"
                    step="0.1"
                    className="block mt-1.5 bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 w-full text-white"
                    value={bonusDraft.signupBonusWageringMultiplier}
                    onChange={(e) => setBonusDraft((d) => ({ ...d, signupBonusWageringMultiplier: Number(e.target.value) }))}
                  />
                  <p className="text-[10px] text-gray-500 mt-1">e.g. 2 means user must wager (2 * bonus_amount) to withdraw.</p>
                </div>

                <div>
                  <label className="text-xs text-gray-500 uppercase font-bold tracking-wider">Referral reward (INR in wallet) 🎁</label>
                  <input
                    type="number"
                    className="block mt-1.5 bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 w-full text-white"
                    value={bonusDraft.referralBonusAmount}
                    onChange={(e) => setBonusDraft((d) => ({ ...d, referralBonusAmount: Number(e.target.value) }))}
                  />
                  <p className="text-[10px] text-gray-500 mt-1">Amount given to the referrer when a friend signs up.</p>
                </div>

                <div>
                  <label className="text-xs text-gray-500 uppercase font-bold tracking-wider">Bonus Expiry (Days) ⏳</label>
                  <input
                    type="number"
                    className="block mt-1.5 bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 w-full text-white"
                    value={bonusDraft.bonusExpiryDays}
                    onChange={(e) => setBonusDraft((d) => ({ ...d, bonusExpiryDays: Number(e.target.value) }))}
                  />
                  <p className="text-[10px] text-gray-500 mt-1">Number of days before a pending/locked bonus expires.</p>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-700/50">
                <button
                  type="button"
                  disabled={actionLoading === 'saveBonus'}
                  onClick={saveBonusSettings}
                  className="w-full md:w-auto px-10 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                >
                  {actionLoading === 'saveBonus' ? 'Saving...' : 'Apply Global Bonus Changes'}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'playerProps' && (
          <div className="max-w-4xl space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-4">
              <h2 className="text-xl font-bold">Player props (squads &amp; markets)</h2>
              <button
                type="button"
                onClick={() => {
                  fetchPpMatches();
                  fetchPpSettlementHealth();
                  fetchPendingBets();
                  if (ppMatchId) loadPlayerPropsDetail(ppMatchId);
                }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm"
              >
                ↻ Refresh
              </button>
            </div>

            <p className="text-sm text-gray-400">
              Pick an upcoming or live match, sync squads from CricAPI (requires <code className="text-indigo-300">CRICAPI_KEY</code>{' '}
              and a match <code className="text-indigo-300">externalId</code>), then create runs/wickets markets and toggle
              visibility for users. Completed matches with pending props auto-retry settlement from the scorecard in the background.
            </p>

            <div className="bg-gray-800/60 border border-gray-700/50 rounded-2xl p-5 space-y-4">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <h3 className="font-bold text-lg">Manual pending-bet settlement</h3>
                  <p className="text-xs text-gray-500">Filter by bet type / match / bet-on text, then settle selected bets in one click.</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fetchPendingBets()}
                    className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs"
                  >
                    ↻ Refresh list
                  </button>
                </div>
              </div>

              <div className="grid md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Bet type</label>
                  <select
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm"
                    value={pendingBetFilters.type}
                    onChange={(e) => setPendingBetFilters((f) => ({ ...f, type: e.target.value }))}
                  >
                    <option value="all">All</option>
                    <option value="ball">Ball</option>
                    <option value="over">Over</option>
                    <option value="batsman">Batsman</option>
                    <option value="player_prop">Player prop</option>
                    <option value="toss">Toss</option>
                    <option value="team_vs_team">Team vs Team</option>
                    <option value="match_winner">Match winner</option>
                    <option value="live_match_winner">Live match winner</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Match</label>
                  <select
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm"
                    value={pendingBetFilters.matchId}
                    onChange={(e) => setPendingBetFilters((f) => ({ ...f, matchId: e.target.value }))}
                  >
                    <option value="">All matches</option>
                    {ppMatches.map((m) => (
                      <option key={m._id} value={m._id}>
                        {m.teamA} vs {m.teamB}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Bet on / user search</label>
                  <input
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm"
                    placeholder="e.g. Kohli, wicket, user email"
                    value={pendingBetFilters.q}
                    onChange={(e) => setPendingBetFilters((f) => ({ ...f, q: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Limit</label>
                  <input
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm"
                    value={pendingBetFilters.limit}
                    onChange={(e) => setPendingBetFilters((f) => ({ ...f, limit: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => fetchPendingBets()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-semibold"
                >
                  Apply filters
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedPendingBetIds(
                      pendingBetsData?.items.map((x) => x.id) || [],
                    )
                  }
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm"
                >
                  Select all shown
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPendingBetIds([])}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm"
                >
                  Clear selection
                </button>
                <button
                  type="button"
                  disabled={actionLoading === 'settlePendingWin'}
                  onClick={() => settleSelectedPendingBets(true)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-sm font-semibold disabled:opacity-50"
                >
                  {actionLoading === 'settlePendingWin' ? 'Settling…' : `Settle WIN (${selectedPendingBetIds.length})`}
                </button>
                <button
                  type="button"
                  disabled={actionLoading === 'settlePendingLoss'}
                  onClick={() => settleSelectedPendingBets(false)}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 rounded-xl text-sm font-semibold disabled:opacity-50"
                >
                  {actionLoading === 'settlePendingLoss' ? 'Settling…' : `Settle LOSS (${selectedPendingBetIds.length})`}
                </button>
              </div>

              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-xs min-w-[980px] text-left">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-700/70">
                      <th className="py-2 pr-2">Sel</th>
                      <th className="py-2 pr-2">Type</th>
                      <th className="py-2 pr-2">Bet on</th>
                      <th className="py-2 pr-2">User</th>
                      <th className="py-2 pr-2">Match</th>
                      <th className="py-2 pr-2">Stake</th>
                      <th className="py-2 pr-2">×</th>
                      <th className="py-2">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(pendingBetsData?.items || []).map((row) => (
                      <tr key={row.id} className="border-b border-gray-800/80 text-gray-200">
                        <td className="py-2 pr-2">
                          <input
                            type="checkbox"
                            checked={selectedPendingBetIds.includes(row.id)}
                            onChange={(e) =>
                              setSelectedPendingBetIds((prev) =>
                                e.target.checked ? [...prev, row.id] : prev.filter((x) => x !== row.id),
                              )
                            }
                          />
                        </td>
                        <td className="py-2 pr-2 uppercase">{row.type}</td>
                        <td className="py-2 pr-2">{row.predictionValue || '—'}</td>
                        <td className="py-2 pr-2">
                          <div>{row.user?.username || 'Unknown'}</div>
                          <div className="text-[10px] text-gray-500">{row.user?.email || ''}</div>
                        </td>
                        <td className="py-2 pr-2">
                          {row.match ? `${row.match.teamA} vs ${row.match.teamB}` : '—'}
                          <div className="text-[10px] text-gray-500">{row.match?.status || ''}</div>
                        </td>
                        <td className="py-2 pr-2 tabular-nums">{formatInr(row.amountStaked)}</td>
                        <td className="py-2 pr-2 tabular-nums">{row.multiplier}×</td>
                        <td className="py-2 text-gray-400">{row.createdAt ? new Date(row.createdAt).toLocaleString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {pendingBetsData && pendingBetsData.items.length === 0 && (
                  <p className="text-sm text-gray-500 py-3">No pending bets match the current filters.</p>
                )}
              </div>
            </div>

            {ppSettlementStatus && ppSettlementStatus.pendingMatches > 0 && (
              <div className="rounded-2xl border border-amber-500/35 bg-amber-950/25 p-5 text-sm">
                <p className="font-bold text-amber-100 mb-1">
                  Attention: player props pending settlement on {ppSettlementStatus.pendingMatches} completed match(es)
                </p>
                <p className="text-xs text-gray-400 mb-3">
                  Retries use exponential backoff (server). Ensure <code className="text-gray-300">externalId</code> and squad names
                  match scorecard spelling, or settle manually per market.
                </p>
                <div className="overflow-x-auto -mx-1">
                  <table className="w-full text-xs min-w-[600px] text-left">
                    <thead>
                      <tr className="text-gray-500 border-b border-amber-500/20">
                        <th className="py-2 pr-2">Match</th>
                        <th className="py-2 pr-2">Pending bets</th>
                        <th className="py-2 pr-2">Attempts</th>
                        <th className="py-2 pr-2">Next retry</th>
                        <th className="py-2">Last error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ppSettlementStatus.items.map((row) => (
                        <tr key={row.matchId} className="border-b border-amber-500/10 text-gray-200">
                          <td className="py-2 pr-2">
                            <div>{row.teamLabel}</div>
                            <div className="text-[10px] text-gray-500 font-mono truncate max-w-[220px]">{row.matchId}</div>
                          </td>
                          <td className="py-2 pr-2 tabular-nums">{row.pendingBets}</td>
                          <td className="py-2 pr-2 tabular-nums">{row.attemptCount}</td>
                          <td className="py-2 pr-2 text-gray-400">
                            {row.nextRetryAt ? new Date(row.nextRetryAt).toLocaleString() : '—'}
                          </td>
                          <td className="py-2 text-rose-300/90 text-[11px] max-w-xs truncate" title={row.lastError}>
                            {row.lastError || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="bg-gray-800/60 border border-gray-700/50 rounded-2xl p-5 space-y-2">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <h3 className="font-bold text-lg">Settlement audit</h3>
                <button
                  type="button"
                  onClick={() => fetchPpSettlementHealth()}
                  className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs"
                >
                  ↻ Refresh log
                </button>
              </div>
              <p className="text-xs text-gray-500">Recent player-prop settlement events (auto, retry, manual, errors).</p>
              <div className="max-h-52 overflow-y-auto rounded-xl border border-gray-700/80 bg-gray-900/40 divide-y divide-gray-800">
                {ppSettlementAudit.length === 0 ? (
                  <p className="p-4 text-sm text-gray-500">No audit rows yet.</p>
                ) : (
                  ppSettlementAudit.map((row) => (
                    <div key={row.id} className="p-3 text-xs">
                      <div className="flex flex-wrap gap-2 text-gray-300">
                        <span className="text-indigo-300 font-mono">{row.kind}</span>
                        <span className="text-gray-500">
                          {row.createdAt ? new Date(row.createdAt).toLocaleString() : ''}
                        </span>
                        {row.matchId && (
                          <span className="text-gray-500 font-mono truncate max-w-[140px]" title={row.matchId}>
                            {row.matchId}
                          </span>
                        )}
                      </div>
                      <pre className="mt-1 text-[11px] text-gray-500 whitespace-pre-wrap break-all">
                        {JSON.stringify(row.details, null, 0)}
                      </pre>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-gray-800/60 border border-gray-700/50 rounded-2xl p-6 space-y-4">
              <label className="text-xs text-gray-500 uppercase font-bold tracking-wider">Match</label>
              <select
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white"
                value={ppMatchId}
                onChange={(e) => {
                  setPpMatchId(e.target.value);
                  if (e.target.value) loadPlayerPropsDetail(e.target.value);
                }}
              >
                <option value="">— Select match —</option>
                {ppMatches.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.teamA} vs {m.teamB} ({m.status || '?'})
                    {m.externalId ? '' : ' · no external id'}
                  </option>
                ))}
              </select>

              {ppMatchId && (
                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    disabled={!!actionLoading}
                    onClick={async () => {
                      setActionLoading('ppSync');
                      const res = await adminFetch(`${API_BASE}/admin/player-props/match/${ppMatchId}/squad/sync`, {
                        method: 'POST',
                        headers,
                      });
                      const d = await res.json().catch(() => ({}));
                      setActionLoading(null);
                      if (res.ok) {
                        setPpSquadData(d);
                        showToast('Squad synced from API');
                      } else showToast(d?.message || 'Sync failed', 'error');
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-semibold text-sm disabled:opacity-50"
                  >
                    Sync squad (CricAPI)
                  </button>
                  <button
                    type="button"
                    disabled={!!actionLoading}
                    onClick={async () => {
                      setActionLoading('ppAutoSettle');
                      const res = await adminFetch(
                        `${API_BASE}/admin/player-props/match/${ppMatchId}/settle-from-scorecard`,
                        {
                          method: 'POST',
                          headers,
                        },
                      );
                      const d = await res.json().catch(() => ({}));
                      setActionLoading(null);
                      if (res.ok) {
                        await loadPlayerPropsDetail(ppMatchId);
                        fetchPpSettlementHealth();
                        const settled = Number((d as { settled?: number }).settled ?? 0);
                        const unresolved = Number(
                          (d as { unresolvedLines?: number }).unresolvedLines ?? 0,
                        );
                        const skipped = Number((d as { skipped?: number }).skipped ?? 0);
                        showToast(
                          `Auto-settle done: settled ${settled}, unresolved lines ${unresolved}, skipped ${skipped}`,
                        );
                      } else {
                        showToast(
                          (d as { message?: string })?.message || 'Auto-settle failed',
                          'error',
                        );
                      }
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-semibold text-sm disabled:opacity-50"
                  >
                    {actionLoading === 'ppAutoSettle'
                      ? 'Settling…'
                      : 'Auto-settle props (scorecard)'}
                  </button>
                </div>
              )}
            </div>

            {ppMatchId && ppSquadData && (
              <div className="bg-gray-800/60 border border-gray-700/50 rounded-2xl p-6 space-y-4">
                <h3 className="font-bold text-lg">Squad</h3>
                <p className="text-xs text-gray-500">
                  Source: {ppSquadData.squad?.source || '—'} · External id:{' '}
                  {ppSquadData.match?.externalId || '—'}
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                  {(ppSquadData.squad?.teams || []).map((t) => (
                    <div key={t.teamName} className="rounded-xl border border-gray-700/60 bg-gray-900/40 p-4">
                      <p className="font-bold text-indigo-300 mb-2">{t.teamName}</p>
                      <ul className="text-sm space-y-1 max-h-56 overflow-y-auto">
                        {t.players.map((p) => (
                          <li key={p.name} className="flex justify-between gap-2 text-gray-300">
                            <span className="truncate">{p.name}</span>
                            <span className="text-gray-500 shrink-0 text-xs">
                              {p.role.replace(/_/g, ' ')}
                              {p.isPlayable === false ? ' · bench' : ''}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                <div className="border-t border-gray-700/50 pt-4 space-y-2">
                  <p className="text-sm font-semibold text-gray-300">Add player manually</p>
                  <div className="flex flex-col sm:flex-row flex-wrap gap-2">
                    <select
                      className="flex-1 min-w-[8rem] bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm"
                      value={ppManual.teamName}
                      onChange={(e) => setPpManual((x) => ({ ...x, teamName: e.target.value }))}
                    >
                      <option value="">Select team</option>
                      {ppTeamOptions.map((team) => (
                        <option key={team} value={team}>
                          {team}
                        </option>
                      ))}
                    </select>
                    <input
                      placeholder="Player name"
                      className="flex-1 min-w-[8rem] bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm"
                      value={ppManual.name}
                      onChange={(e) => setPpManual((x) => ({ ...x, name: e.target.value }))}
                    />
                    <select
                      className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm"
                      value={ppManual.role}
                      onChange={(e) =>
                        setPpManual((x) => ({
                          ...x,
                          role: e.target.value as typeof ppManual.role,
                        }))
                      }
                    >
                      <option value="batsman">Batsman</option>
                      <option value="bowler">Bowler</option>
                      <option value="keeper_batsman">Keeper / batsman</option>
                      <option value="all_rounder">All-rounder</option>
                    </select>
                    <button
                      type="button"
                      disabled={!!actionLoading}
                      onClick={async () => {
                        setActionLoading('ppAddP');
                        const res = await adminFetch(`${API_BASE}/admin/player-props/match/${ppMatchId}/squad/player`, {
                          method: 'POST',
                          headers,
                          body: JSON.stringify(ppManual),
                        });
                        const d = await res.json().catch(() => ({}));
                        setActionLoading(null);
                        if (res.ok) {
                          setPpSquadData(d);
                          setPpManual({ teamName: '', name: '', role: 'batsman' });
                          showToast('Player added');
                        } else showToast(d?.message || 'Failed', 'error');
                      }}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm font-semibold"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            )}

            {ppMatchId && (
              <div className="bg-gray-800/60 border border-gray-700/50 rounded-2xl p-6 space-y-4">
                <h3 className="font-bold text-lg">Create market</h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  <select
                    className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm"
                    value={ppForm.teamName}
                    onChange={(e) => setPpForm((f) => ({ ...f, teamName: e.target.value }))}
                  >
                    <option value="">Select team</option>
                    {ppTeamOptions.map((team) => (
                      <option key={team} value={team}>
                        {team}
                      </option>
                    ))}
                  </select>
                  <input
                    placeholder="Player name (exact)"
                    className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm"
                    value={ppForm.playerName}
                    onChange={(e) => setPpForm((f) => ({ ...f, playerName: e.target.value }))}
                  />
                  <select
                    className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm"
                    value={ppForm.statType}
                    onChange={(e) =>
                      setPpForm((f) => ({ ...f, statType: e.target.value as 'runs' | 'wickets' }))
                    }
                  >
                    <option value="runs">Runs (batting)</option>
                    <option value="wickets">Wickets (bowling)</option>
                  </select>
                  <select
                    className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm"
                    value={ppForm.condition}
                    onChange={(e) =>
                      setPpForm((f) => ({
                        ...f,
                        condition: e.target.value as 'more_than' | 'less_than',
                      }))
                    }
                  >
                    <option value="more_than">More than</option>
                    <option value="less_than">Less than</option>
                  </select>
                  <input
                    type="number"
                    placeholder="Run number"
                    className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm"
                    value={ppForm.threshold}
                    onChange={(e) => setPpForm((f) => ({ ...f, threshold: e.target.value }))}
                  />
                  {ppForm.createOppositeOption && (
                    <input
                      type="number"
                      placeholder="Opposite option run number"
                      className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm"
                      value={ppForm.oppositeThreshold}
                      onChange={(e) =>
                        setPpForm((f) => ({ ...f, oppositeThreshold: e.target.value }))
                      }
                    />
                  )}
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Multiplier"
                    className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm"
                    value={ppForm.multiplier}
                    onChange={(e) => setPpForm((f) => ({ ...f, multiplier: e.target.value }))}
                  />
                  <label className="flex items-center gap-2 text-sm text-gray-300 sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={ppForm.isPublished}
                      onChange={(e) => setPpForm((f) => ({ ...f, isPublished: e.target.checked }))}
                    />
                    Published (visible to users)
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-300 sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={ppForm.createOppositeOption}
                      onChange={(e) =>
                        setPpForm((f) => ({ ...f, createOppositeOption: e.target.checked }))
                      }
                    />
                    Create both options (more than + less than) for this line
                  </label>
                  <input
                    placeholder="Player image URL (https, optional)"
                    className="sm:col-span-2 bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm"
                    value={ppForm.playerImageUrl}
                    onChange={(e) => setPpForm((f) => ({ ...f, playerImageUrl: e.target.value }))}
                  />
                </div>
                <button
                  type="button"
                  disabled={!!actionLoading}
                  onClick={async () => {
                    setActionLoading('ppMarket');
                    const payload: Record<string, unknown> = {
                      teamName: ppForm.teamName.trim(),
                      playerName: ppForm.playerName.trim(),
                      statType: ppForm.statType,
                      condition: ppForm.condition,
                      threshold: Number(ppForm.threshold),
                      oppositeThreshold: Number(ppForm.oppositeThreshold),
                      multiplier: Number(ppForm.multiplier),
                      isPublished: ppForm.isPublished,
                      createOppositeOption: ppForm.createOppositeOption,
                    };
                    if (ppForm.playerImageUrl.trim()) {
                      payload.playerImageUrl = ppForm.playerImageUrl.trim();
                    }
                    const res = await adminFetch(`${API_BASE}/admin/player-props/match/${ppMatchId}/markets`, {
                      method: 'POST',
                      headers,
                      body: JSON.stringify(payload),
                    });
                    const d = await res.json().catch(() => ({}));
                    setActionLoading(null);
                    if (res.ok) {
                      setPpMarkets(d);
                      showToast('Market created');
                    } else showToast(d?.message || 'Failed', 'error');
                  }}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold text-sm disabled:opacity-50"
                >
                  Create market
                </button>
              </div>
            )}

            {ppMatchId && ppMarkets.length > 0 && (
              <div className="bg-gray-800/60 border border-gray-700/50 rounded-2xl p-6 overflow-x-auto">
                <h3 className="font-bold text-lg mb-4">Markets</h3>
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-700">
                      <th className="pb-2 pr-2">Photo</th>
                      <th className="pb-2 pr-2">Player</th>
                      <th className="pb-2 pr-2">Stat</th>
                      <th className="pb-2 pr-2">Status</th>
                      <th className="pb-2 pr-2">×</th>
                      <th className="pb-2 pr-2">Published</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {ppMarkets.map((m) => (
                      <tr key={m.id} className="border-b border-gray-800/80 align-top">
                        <td className="py-2 pr-2 w-36">
                          <div className="flex flex-col gap-2">
                            <div className="w-14 h-14 rounded-lg bg-gray-900 border border-gray-700 overflow-hidden flex items-center justify-center shrink-0">
                              {m.playerImageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={m.playerImageUrl}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-gray-600 text-xs">—</span>
                              )}
                            </div>
                            <PpImageEditorRow
                              marketId={m.id}
                              initialUrl={m.playerImageUrl ?? ''}
                              headers={headers}
                              adminFetch={adminFetch}
                              onSaved={(rows) =>
                                setPpMarkets(rows as Array<{
                                  id: string;
                                  teamName: string;
                                  playerName: string;
                                  statType: string;
                                  condition?: 'more_than' | 'less_than';
                                  threshold: number;
                                  multiplier: number;
                                  isPublished: boolean;
                                  status: string;
                                  playerImageUrl?: string | null;
                                }>)
                              }
                              showToast={showToast}
                            />
                          </div>
                        </td>
                        <td className="py-2 pr-2">
                          <div className="font-medium text-white">{m.playerName}</div>
                          <div className="text-xs text-gray-500">{m.teamName}</div>
                        </td>
                        <td className="py-2 pr-2">
                          {m.statType} {m.condition === 'less_than' ? '<' : '>'} {m.threshold}
                        </td>
                        <td className="py-2 pr-2">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-semibold ${
                              m.status === 'settled'
                                ? 'bg-emerald-600/20 text-emerald-300'
                                : m.status === 'locked'
                                  ? 'bg-amber-600/20 text-amber-300'
                                  : 'bg-slate-600/20 text-slate-300'
                            }`}
                          >
                            {m.status || 'open'}
                          </span>
                        </td>
                        <td className="py-2 pr-2 font-mono">{m.multiplier}×</td>
                        <td className="py-2 pr-2">
                          <button
                            type="button"
                            onClick={async () => {
                              const res = await adminFetch(`${API_BASE}/admin/player-props/markets/${m.id}`, {
                                method: 'PATCH',
                                headers,
                                body: JSON.stringify({ isPublished: !m.isPublished }),
                              });
                              const d = await res.json().catch(() => ({}));
                              if (res.ok) setPpMarkets(d);
                              else showToast(d?.message || 'Update failed', 'error');
                            }}
                            className={`px-3 py-1 rounded-lg text-xs font-bold ${
                              m.isPublished ? 'bg-emerald-600' : 'bg-gray-700'
                            }`}
                          >
                            {m.isPublished ? 'On' : 'Off'}
                          </button>
                        </td>
                        <td className="py-2">
                          <button
                            type="button"
                            onClick={async () => {
                              if (!confirm('Delete this market?')) return;
                              const res = await adminFetch(`${API_BASE}/admin/player-props/markets/${m.id}`, {
                                method: 'DELETE',
                                headers,
                              });
                              const d = await res.json().catch(() => ({}));
                              if (res.ok) setPpMarkets(d);
                              else showToast(d?.message || 'Delete failed', 'error');
                            }}
                            className="text-red-400 hover:underline text-xs"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-8">
            <div>
              <h2 className="text-xl font-bold mb-2">Online users</h2>
              <p className="text-sm text-gray-400 mb-4">
                Users are considered online if they sent a presence ping within the window (app open, logged in). Adjust role and time window, then refresh.
              </p>
              <div className="flex flex-wrap gap-3 items-end mb-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Within (minutes)</label>
                  <select
                    className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm"
                    value={onlineWithin}
                    onChange={(e) => setOnlineWithin(Number(e.target.value))}
                  >
                    {[1, 2, 5, 15, 30].map((n) => (
                      <option key={n} value={n}>
                        {n} min
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Role</label>
                  <select
                    className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm"
                    value={onlineRole}
                    onChange={(e) => setOnlineRole(e.target.value as 'user' | 'admin' | 'all')}
                  >
                    <option value="user">Users only</option>
                    <option value="admin">Admins only</option>
                    <option value="all">All</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => fetchOnlineAnalytics()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-semibold"
                >
                  Refresh
                </button>
              </div>
              {onlineAnalytics ? (
                <div className="bg-gray-800/60 border border-gray-700/50 rounded-2xl p-4 overflow-x-auto">
                  <p className="text-sm text-gray-400 mb-3">
                    Showing <span className="text-white font-bold">{onlineAnalytics.count}</span> online (last{' '}
                    {onlineAnalytics.withinMinutes} min · {onlineAnalytics.roleFilter})
                  </p>
                  {onlineAnalytics.users.length === 0 ? (
                    <p className="text-gray-500 text-sm">No users in this window.</p>
                  ) : (
                    <table className="w-full text-sm min-w-[480px]">
                      <thead>
                        <tr className="text-gray-400 text-xs uppercase text-left border-b border-gray-700/50">
                          <th className="pb-2 pr-2">User</th>
                          <th className="pb-2 pr-2">Email</th>
                          <th className="pb-2 pr-2">Role</th>
                          <th className="pb-2">Last seen</th>
                        </tr>
                      </thead>
                      <tbody>
                        {onlineAnalytics.users.map((u) => (
                          <tr key={u._id} className="border-t border-gray-700/40">
                            <td className="py-2 pr-2 font-medium">{u.username}</td>
                            <td className="py-2 pr-2 text-gray-400">{u.email}</td>
                            <td className="py-2 pr-2">{u.role}</td>
                            <td className="py-2 text-gray-300 tabular-nums">
                              {u.lastSeenAt ? new Date(u.lastSeenAt).toLocaleString() : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">Loading…</p>
              )}
            </div>

            <div>
              <h2 className="text-xl font-bold mb-2">Site visits</h2>
              <p className="text-sm text-gray-400 mb-4">
                Page views from the public tracker (visitor key + path). Logged-in requests attach user when possible.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">From</label>
                  <input
                    type="datetime-local"
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm"
                    value={visitFilters.from}
                    onChange={(e) => setVisitFilters((f) => ({ ...f, from: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">To</label>
                  <input
                    type="datetime-local"
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm"
                    value={visitFilters.to}
                    onChange={(e) => setVisitFilters((f) => ({ ...f, to: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Path prefix</label>
                  <input
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm"
                    placeholder="/dashboard"
                    value={visitFilters.path}
                    onChange={(e) => setVisitFilters((f) => ({ ...f, path: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Visitor key</label>
                  <input
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 font-mono text-xs"
                    placeholder="v_…"
                    value={visitFilters.visitorKey}
                    onChange={(e) => setVisitFilters((f) => ({ ...f, visitorKey: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">User ID</label>
                  <input
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 font-mono text-xs"
                    placeholder="Mongo ObjectId"
                    value={visitFilters.userId}
                    onChange={(e) => setVisitFilters((f) => ({ ...f, userId: e.target.value }))}
                  />
                </div>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Limit / skip</label>
                    <div className="flex gap-2">
                      <input
                        className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm"
                        value={visitFilters.limit}
                        onChange={(e) => setVisitFilters((f) => ({ ...f, limit: e.target.value }))}
                      />
                      <input
                        className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm"
                        value={visitFilters.skip}
                        onChange={(e) => setVisitFilters((f) => ({ ...f, skip: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => fetchVisits()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-semibold mb-4"
              >
                Apply filters
              </button>
              {visitData ? (
                <div className="bg-gray-800/60 border border-gray-700/50 rounded-2xl p-4 overflow-x-auto">
                  <p className="text-sm text-gray-400 mb-3">
                    Total <span className="text-white font-bold">{visitData.total}</span> matching · page size {visitData.limit} · skip{' '}
                    {visitData.skip}
                  </p>
                  {visitData.items.length === 0 ? (
                    <p className="text-gray-500 text-sm">No visits match.</p>
                  ) : (
                    <table className="w-full text-sm min-w-[720px]">
                      <thead>
                        <tr className="text-gray-400 text-xs uppercase text-left border-b border-gray-700/50">
                          <th className="pb-2 pr-2">Time</th>
                          <th className="pb-2 pr-2">Path</th>
                          <th className="pb-2 pr-2">Visitor</th>
                          <th className="pb-2">User</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visitData.items.map((row) => (
                          <tr key={row._id} className="border-t border-gray-700/40">
                            <td className="py-2 pr-2 text-gray-300 tabular-nums whitespace-nowrap">
                              {row.createdAt ? new Date(row.createdAt).toLocaleString() : '—'}
                            </td>
                            <td className="py-2 pr-2 font-mono text-xs">{row.path}</td>
                            <td className="py-2 pr-2 font-mono text-[11px] break-all">{row.visitorKey}</td>
                            <td className="py-2 text-gray-300">
                              {row.userId && typeof row.userId === 'object' && 'username' in row.userId
                                ? `${row.userId.username}`
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">Loading…</p>
              )}
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
