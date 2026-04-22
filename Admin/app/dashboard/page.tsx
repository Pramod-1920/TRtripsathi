'use client';

import { useEffect, useMemo, useState } from 'react';
import { FiUsers, FiTrendingUp, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import { StatCard } from '@/components/stat-card';
import { apiClient } from '@/lib/api';

type DashboardProfile = {
  _id: string;
  firstName?: string | null;
  lastName?: string | null;
  profileCompleted?: boolean;
  experienceLevel?: string | null;
  location?: string | null;
  createdAt?: string;
};

export default function DashboardPage() {
  const [profiles, setProfiles] = useState<DashboardProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadProfiles() {
      try {
        const response = await apiClient.get('/user/admin/profiles', {
          params: { page: 1, limit: 50 },
        });

        if (active) {
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
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

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
  }, [profiles]);

  const recentProfiles = [...profiles]
    .sort((left, right) => {
      const leftCreatedAt = new Date(left.createdAt ?? 0).getTime();
      const rightCreatedAt = new Date(right.createdAt ?? 0).getTime();
      return rightCreatedAt - leftCreatedAt;
    })
    .slice(0, 5);

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

        {/* Activity Chart Placeholder */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">User Activity Trend</h2>
          <div className="h-48 flex items-center justify-center bg-slate-50 rounded-lg">
            <p className="text-slate-400">Chart will load here</p>
          </div>
        </div>
      </div>
    </div>
  );
}
