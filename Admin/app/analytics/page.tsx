'use client';

import { useEffect, useMemo, useState } from 'react';
import { FiBarChart2, FiTrendingUp, FiUsers, FiActivity } from 'react-icons/fi';
import { StatCard } from '@/components/stat-card';
import { apiClient } from '@/lib/api';
import { fetchCampaigns, Campaign } from '@/lib/campaigns';

type Profile = {
  _id: string;
  role: 'user';
  profileCompleted?: boolean;
  createdAt?: string;
};

export default function AnalyticsPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [totalProfiles, setTotalProfiles] = useState(0);
  const [completedProfiles, setCompletedProfiles] = useState(0);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [referenceNow, setReferenceNow] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadAnalytics() {
      try {
        const [response, completedResponse] = await Promise.all([
          apiClient.get('/user/admin/profiles', {
            params: { page: 1, limit: 100 },
          }),
          apiClient.get('/user/admin/profiles', {
            params: { page: 1, limit: 1, status: 'complete' },
          }),
        ]);

        if (active) {
          const items = (response.data?.items ?? []) as Array<Partial<Profile>>;
          const userProfiles = items.filter(
            (profile): profile is Profile =>
              profile.role === 'user' && typeof profile._id === 'string',
          );
          const allRowsAreUsers = userProfiles.length === items.length;
          const completedItems = (completedResponse.data?.items ?? []) as Array<Partial<Profile>>;
          const allCompletedRowsAreUsers = completedItems.every(
            (profile) => profile.role === 'user',
          );

          setReferenceNow(Date.now());
          setProfiles(userProfiles);
          setTotalProfiles(
            allRowsAreUsers
              ? Number(response.data?.pagination?.total ?? userProfiles.length)
              : userProfiles.length,
          );
          setCompletedProfiles(
            allCompletedRowsAreUsers
              ? Number(completedResponse.data?.pagination?.total ?? 0)
              : 0,
          );
          // load campaigns for campaign-related metrics
          try {
            const cResp = await fetchCampaigns({ page: 1, limit: 200, includeFuture: true });
            if (active) setCampaigns(cResp.items);
          } catch {
            // ignore campaign load error, keep profiles
          }
        }
      } catch {
        if (active) {
          setError('Failed to load analytics from the backend.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadAnalytics();

    return () => {
      active = false;
    };
  }, []);

  const analyticsData = useMemo(() => {
    const now = referenceNow;
    const oneDay = 24 * 60 * 60 * 1000;
    const sevenDays = 7 * oneDay;

    const createdAtValues = profiles
      .map((profile) => new Date(profile.createdAt ?? 0).getTime())
      .filter((value) => !Number.isNaN(value));

    const last7Days = createdAtValues.filter((value) => value >= now - sevenDays).length;
    const previous7Days = createdAtValues.filter((value) => value < now - sevenDays && value >= now - 2 * sevenDays).length;

    const userGrowth = previous7Days === 0
      ? last7Days > 0 ? 100 : 0
      : Number((((last7Days - previous7Days) / previous7Days) * 100).toFixed(1));

    const activeUsersToday = createdAtValues.filter((value) => value >= now - oneDay).length;
    return {
      userGrowth,
      activeUsersToday,
      totalProfiles,
      completedProfiles,
      avgSessionDuration: '24 min',
      userRetention: totalProfiles ? Math.round((completedProfiles / totalProfiles) * 100) : 0,
      createdAtValues,
    };
  }, [completedProfiles, profiles, referenceNow, totalProfiles]);

  const campaignStats = useMemo(() => {
    const now = referenceNow;
    if (!now) {
      return { total: 0, upcoming: 0, ongoing: 0, openForJoin: 0, totalParticipants: 0, avgDuration: 0, topHosts: [] as [string, number][] };
    }
    const total = campaigns.length;
    let upcoming = 0;
    let ongoing = 0;
    let openForJoin = 0;
    let totalParticipants = 0;
    let durationSum = 0;

    const hostCounts: Record<string, number> = {};

    campaigns.forEach((c) => {
      const start = c.startDate ? new Date(c.startDate).getTime() : null;
      const end = c.endDate ? new Date(c.endDate).getTime() : null;
      const isCompleted = Boolean(c.completed || c.failed);

      // upcoming: start in the future
      if (start && start > now && !isCompleted) upcoming += 1;

      // ongoing: has started and not ended
      if (start && start <= now && (!end || end > now) && !isCompleted) ongoing += 1;

      // open for join: approved and joinOpenDate passed and not ended
      const joinOpen = !c.approvalStatus || c.approvalStatus === 'approved';
      const joinOpenDateOk = !c.joinOpenDate || new Date(c.joinOpenDate).getTime() <= now;
      if (joinOpen && joinOpenDateOk && (!c.endDate || new Date(c.endDate).getTime() > now) && !isCompleted) openForJoin += 1;

      const accepted = (c.participants ?? []).filter((p) => p.status === 'accepted').length;
      totalParticipants += accepted;

      if (c.durationDays) durationSum += c.durationDays;

      const host = c.creator?.name ?? 'Unknown';
      hostCounts[host] = (hostCounts[host] ?? 0) + 1;
    });

    const avgDuration = total ? (durationSum / total) : 0;

    const topHosts = Object.entries(hostCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

    return { total, upcoming, ongoing, openForJoin, totalParticipants, avgDuration: Math.round(avgDuration * 10) / 10, topHosts };
  }, [campaigns, referenceNow]);


  const signupBars = useMemo(() => {
    const buckets = [0, 0, 0, 0, 0, 0, 0];
    const day = 24 * 60 * 60 * 1000;

    analyticsData.createdAtValues.forEach((createdAt) => {
      const diff = Math.floor((referenceNow - createdAt) / day);

      if (diff >= 0 && diff < 7) {
        buckets[6 - diff] += 1;
      }
    });

    return buckets;
  }, [analyticsData.createdAtValues, referenceNow]);

  // placeholder static visits removed; we rely on computed metrics

  return (
    <div className="p-8 text-foreground">
      <h1 className="mb-8 text-3xl font-bold">Analytics & Reports</h1>

      {error && (
        <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading && (
        <div className="mb-6 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          Loading analytics from the backend...
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Campaigns"
          value={campaignStats.total}
          description="All campaigns"
          icon={<FiBarChart2 size={24} />}
          color="purple"
        />
        <StatCard
          title="Upcoming"
          value={campaignStats.upcoming}
          description="Starting in future"
          icon={<FiTrendingUp size={24} />}
          color="green"
        />
        <StatCard
          title="Ongoing"
          value={campaignStats.ongoing}
          description="Happening now"
          icon={<FiActivity size={24} />}
          color="blue"
        />
        <StatCard
          title="Open for Join"
          value={campaignStats.openForJoin}
          description="Users can enroll"
          icon={<FiUsers size={24} />}
          color="blue"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* User Signups Chart */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">User Signups (Last 7 Days)</h2>
          <div className="flex h-64 items-end justify-around gap-2 rounded-lg bg-muted/50 p-4">
            {signupBars.map((value, i) => (
              <div key={i} className="flex-1 flex flex-col items-center">
                <div
                  className="w-full rounded-t-lg bg-primary transition-all hover:bg-primary/90"
                  style={{ height: `${Math.max(value * 14, 4)}%`, minHeight: '4px' }}
                />
                <p className="mt-2 text-xs text-muted-foreground">Day {i + 1}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Profile Completion */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Profile Completion Rate</h2>
          <div className="h-64 flex items-center justify-center">
            <div className="text-center">
              <div className="relative w-40 h-40 mx-auto mb-4">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-4xl font-bold text-foreground">
                      {analyticsData.userRetention}%
                    </p>
                    <p className="text-xs text-muted-foreground">Completed</p>
                  </div>
                </div>
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="80"
                    cy="80"
                    r="70"
                    fill="none"
                    stroke="hsl(var(--muted))"
                    strokeWidth="8"
                  />
                  <circle
                    cx="80"
                    cy="80"
                    r="70"
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth="8"
                    strokeDasharray={`${2 * Math.PI * 70 * (analyticsData.userRetention / 100)} ${2 * Math.PI * 70}`}
                  />
                </svg>
              </div>
              <p className="text-sm text-muted-foreground">
                {analyticsData.completedProfiles} of {analyticsData.totalProfiles} profiles
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top Hosts */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Top Hosts</h2>
          <div className="space-y-4">
            {campaignStats.topHosts.length === 0 && (
              <p className="text-sm text-muted-foreground">No host data yet.</p>
            )}
            {campaignStats.topHosts.map(([host, count], i) => (
              <div key={host} className="flex items-center justify-between">
                <span className="text-sm text-foreground">{i + 1}. {host}</span>
                <span className="rounded-full bg-primary/15 px-2 py-1 text-xs font-medium text-primary">{count} campaigns</span>
              </div>
            ))}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Key Metrics</h2>
          <div className="space-y-4">
            <div className="border-b border-border pb-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Avg Campaign Duration (days)</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{campaignStats.avgDuration}</p>
            </div>
            <div className="border-b border-border pb-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Participants</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{campaignStats.totalParticipants}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Bounce Rate</p>
              <p className="mt-1 text-2xl font-bold text-foreground">18%</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
