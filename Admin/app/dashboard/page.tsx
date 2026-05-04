'use client';

import { useEffect, useMemo, useState } from 'react';
import { FiUsers, FiTrendingUp, FiCheckCircle, FiAlertCircle, FiAward } from 'react-icons/fi';
import { StatCard } from '@/components/stat-card';
import { apiClient } from '@/lib/api';

type DashboardProfile = {
  _id: string;
  firstName?: string | null;
  lastName?: string | null;
  profileCompleted?: boolean;
  experienceLevel?: string | null;
  xp?: number | null;
  totalXp?: number | null;
  level?: number | null;
  location?: string | null;
  createdAt?: string;
};

export default function DashboardPage() {
  const [profiles, setProfiles] = useState<DashboardProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [referenceNow, setReferenceNow] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadProfiles() {
      try {
        const response = await apiClient.get('/user/admin/profiles', {
          params: { page: 1, limit: 50 },
        });

        if (active) {
          setReferenceNow(Date.now());
          setProfiles(response.data?.items ?? []);
        }
      } catch {
        if (active) {
          setError('Unable to load dashboard data from the backend.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadProfiles();

    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(() => {
    const completed = profiles.filter((profile) => profile.profileCompleted).length;
    const sevenDaysAgo = referenceNow - 7 * 24 * 60 * 60 * 1000;

    return {
      totalUsers: profiles.length,
      activeUsers: completed,
      newUsers: profiles.filter((profile) => {
        if (!profile.createdAt) {
          return false;
        }

        return new Date(profile.createdAt).getTime() >= sevenDaysAgo;
      }).length,
      inactiveUsers: Math.max(profiles.length - completed, 0),
    };
  }, [profiles, referenceNow]);

  const recentProfiles = [...profiles]
    .sort((left, right) => {
      const leftCreatedAt = new Date(left.createdAt ?? 0).getTime();
      const rightCreatedAt = new Date(right.createdAt ?? 0).getTime();
      return rightCreatedAt - leftCreatedAt;
    })
    .slice(0, 5);

  const topXpProfiles = [...profiles]
    .sort((left, right) => {
      const leftXp = Number(left.totalXp ?? left.xp ?? 0);
      const rightXp = Number(right.totalXp ?? right.xp ?? 0);

      if (rightXp !== leftXp) {
        return rightXp - leftXp;
      }

      return Number(right.level ?? 0) - Number(left.level ?? 0);
    })
    .slice(0, 100);

  const podiumProfiles = topXpProfiles.slice(0, 3);
  const remainingProfiles = topXpProfiles.slice(3);
  const podiumOrderClasses = [
    'md:order-2 md:-translate-y-10 md:scale-110 md:col-span-1',
    'md:order-1 md:translate-y-6 md:scale-95',
    'md:order-3 md:translate-y-6 md:scale-95',
  ];
  const podiumCrownClasses = ['text-amber-500', 'text-slate-400', 'text-amber-700'];
  const podiumHeightClasses = ['min-h-44 md:min-h-56', 'min-h-36 md:min-h-48', 'min-h-36 md:min-h-48'];

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-slate-900 mb-8">Dashboard Overview</h1>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && (
        <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
          Loading live dashboard data from the backend...
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Users"
          value={stats.totalUsers}
          description="All registered users"
          icon={<FiUsers size={24} />}
          color="blue"
        />
        <StatCard
          title="Active Users"
          value={stats.activeUsers}
          description="Users online"
          icon={<FiCheckCircle size={24} />}
          color="green"
        />
        <StatCard
          title="New Users"
          value={stats.newUsers}
          description="This week"
          icon={<FiTrendingUp size={24} />}
          color="purple"
        />
        <StatCard
          title="Inactive Users"
          value={stats.inactiveUsers}
          description="30+ days inactive"
          icon={<FiAlertCircle size={24} />}
          color="red"
        />
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Users */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent Users</h2>
          <div className="space-y-4">
            {recentProfiles.length === 0 && !loading && (
              <p className="text-sm text-slate-500">No profiles available yet.</p>
            )}
            {recentProfiles.map((profile, index) => (
              <div key={profile._id} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-b-0">
                <div>
                  <p className="font-medium text-slate-900">
                    {profile.firstName || profile.lastName
                      ? `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim()
                      : `Profile ${index + 1}`}
                  </p>
                  <p className="text-xs text-slate-500">
                    {profile.location || profile.experienceLevel || 'Backend profile'}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    profile.profileCompleted ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'
                  }`}
                >
                  {profile.profileCompleted ? 'Complete' : 'Incomplete'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top XP Leaderboard */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-14 center">Top 10 XP Leaders</h2>
          <div className="mb-7 grid grid-cols-1 items-end gap- md:grid-cols-3 md:items-end">
            {podiumProfiles.map((profile, index) => {
              const name = profile.firstName || profile.lastName
                ? `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim()
                : `Profile ${index + 1}`;
              const rank = profile.experienceLevel || 'unranked';
              const place = index + 1;

              return (
                <div
                  key={profile._id}
                  className={`relative flex flex-col items-center justify-end overflow-hidden rounded-3xl px-4 py-5 text-center shadow-sm ${podiumOrderClasses[index]} ${podiumHeightClasses[index]} ${index === 0
                    ? 'border-slate-900 bg-linear-to-b from-slate-900 via-slate-800 to-slate-900 shadow-2xl ring-2 ring-amber-300/60'
                    : 'border-slate-200 bg-slate-50'} `}
                >
                  {index === 0 ? (
                    <div className="pointer-events-none absolute -top-10 left-1/2 h-28 w-28 -translate-x-1/2 rounded-full bg-amber-300/30 blur-2xl" />
                  ) : null}

                  <div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-full md:h-14 md:w-14 ${index === 0
                    ? 'bg-amber-50 shadow-lg ring-2 ring-amber-300'
                    : 'bg-white shadow-sm ring-1 ring-slate-200'}`}>
                    <FiAward size={index === 0 ? 28 : 22} className={podiumCrownClasses[index]} />
                  </div>
                  <span className={`mb-2 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${index === 0
                    ? 'bg-amber-100 text-slate-900 ring-1 ring-amber-300'
                    : 'bg-white text-slate-500 ring-1 ring-slate-200'}`}>
                    #{place}
                  </span>
                  <p className={`text-sm font-semibold ${index === 0 ? 'text-white' : 'text-slate-900'}`}>{name}</p>
                  <p className={`mt-1 text-sm ${index === 0 ? 'text-amber-100' : 'text-slate-500'}`}>{rank}</p>
                </div>
              );
            })}
          </div>

          <div className="max-h-136 space-y-2 overflow-y-auto pr-1">
            {topXpProfiles.length === 0 && !loading && (
              <p className="text-sm text-slate-500">No XP data available yet.</p>
            )}

            {remainingProfiles.map((profile, index) => {
              const name = profile.firstName || profile.lastName
                ? `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim()
                : `Profile ${index + 4}`;
              const rank = profile.experienceLevel || 'unranked';

              return (
                <div
                  key={profile._id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3"
                >
                  <p className="truncate text-sm font-medium text-slate-900">{name}</p>
                  <p className="shrink-0 text-sm text-slate-500">{rank}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
