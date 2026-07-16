'use client';

import { useEffect, useMemo, useState } from 'react';
import { FiBarChart2, FiTrendingUp, FiUsers, FiActivity } from 'react-icons/fi';
import { StatCard } from '@/components/stat-card';
import { apiClient } from '@/lib/api';
import { fetchCampaigns, Campaign } from '@/lib/campaigns';

type Profile = {
  experienceLevel?: string | null;
  profileCompleted?: boolean;
  createdAt?: string;
};

export default function AnalyticsPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [referenceNow, setReferenceNow] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadAnalytics() {
      try {
        const response = await apiClient.get('/user/admin/profiles', {
          params: { page: 1, limit: 1000 },
        });

        if (active) {
          setReferenceNow(Date.now());
          setProfiles(response.data?.items ?? []);
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
    const completedProfiles = profiles.filter((profile) => profile.profileCompleted).length;
    const experienceCounts = profiles.reduce<Record<string, number>>((accumulator, profile) => {
      const level = profile.experienceLevel || 'unknown';
      accumulator[level] = (accumulator[level] ?? 0) + 1;
      return accumulator;
    }, {});

    return {
      userGrowth,
      activeUsersToday,
      totalProfiles: profiles.length,
      completedProfiles,
      avgSessionDuration: '24 min',
      userRetention: profiles.length ? Math.round((completedProfiles / profiles.length) * 100) : 0,
      experienceCounts,
      createdAtValues,
    };
  }, [profiles, referenceNow]);

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

  const experienceEntries = Object.entries(analyticsData.experienceCounts);
  // placeholder static visits removed; we rely on computed metrics

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-slate-900 mb-8">Analytics & Reports</h1>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && (
        <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
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
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">User Signups (Last 7 Days)</h2>
          <div className="h-64 flex items-end justify-around gap-2 bg-slate-50 rounded-lg p-4">
            {signupBars.map((value, i) => (
              <div key={i} className="flex-1 flex flex-col items-center">
                <div
                  className="w-full bg-blue-500 rounded-t-lg transition-all hover:bg-blue-600"
                  style={{ height: `${Math.max(value * 14, 4)}%`, minHeight: '4px' }}
                />
                <p className="text-xs text-slate-600 mt-2">Day {i + 1}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Profile Completion */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Profile Completion Rate</h2>
          <div className="h-64 flex items-center justify-center">
            <div className="text-center">
              <div className="relative w-40 h-40 mx-auto mb-4">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-4xl font-bold text-slate-900">
                      {Math.round((analyticsData.completedProfiles / analyticsData.totalProfiles) * 100)}%
                    </p>
                    <p className="text-xs text-slate-500">Completed</p>
                  </div>
                </div>
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="80"
                    cy="80"
                    r="70"
                    fill="none"
                    stroke="#e2e8f0"
                    strokeWidth="8"
                  />
                  <circle
                    cx="80"
                    cy="80"
                    r="70"
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="8"
                    strokeDasharray={`${2 * Math.PI * 70 * (analyticsData.completedProfiles / analyticsData.totalProfiles)} ${2 * Math.PI * 70}`}
                  />
                </svg>
              </div>
              <p className="text-sm text-slate-600">
                {analyticsData.completedProfiles} of {analyticsData.totalProfiles} profiles
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Top Hosts */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Top Hosts</h2>
          <div className="space-y-4">
            {campaignStats.topHosts.length === 0 && (
              <p className="text-sm text-slate-500">No host data yet.</p>
            )}
            {campaignStats.topHosts.map(([host, count], i) => (
              <div key={host} className="flex items-center justify-between">
                <span className="text-sm text-slate-700">{i + 1}. {host}</span>
                <span className="text-xs font-medium bg-blue-50 text-blue-700 px-2 py-1 rounded">{count} campaigns</span>
              </div>
            ))}
          </div>
        </div>

        {/* Experience Level Distribution */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Experience Level</h2>
          <div className="space-y-4">
            {experienceEntries.length === 0 && (
              <p className="text-sm text-slate-500">No experience data yet.</p>
            )}
            {experienceEntries.map(([level, count]) => (
              <div key={level}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-slate-700">{level}</span>
                  <span className="text-xs font-medium text-slate-600">{count}</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{ width: `${analyticsData.totalProfiles ? (count / analyticsData.totalProfiles) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Key Metrics</h2>
          <div className="space-y-4">
            <div className="pb-4 border-b border-slate-200">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Avg Campaign Duration (days)</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{campaignStats.avgDuration}</p>
            </div>
            <div className="pb-4 border-b border-slate-200">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Participants</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{campaignStats.totalParticipants}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Bounce Rate</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">18%</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
