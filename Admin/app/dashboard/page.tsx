'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FiAlertCircle,
  FiArrowUpRight,
  FiCheckCircle,
  FiClock,
  FiRefreshCw,
  FiShield,
  FiTrendingUp,
  FiUserPlus,
  FiUsers,
  FiZap,
} from 'react-icons/fi';
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

function getProfileName(profile: DashboardProfile, fallback = 'Unnamed explorer') {
  const name = `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim();
  return name || fallback;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatDate(value?: string) {
  if (!value) return 'Date unavailable';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function Initials({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-700">
      {initials || '?'}
    </span>
  );
}

function StatSkeleton() {
  return <div className="h-[132px] animate-pulse rounded-2xl border border-slate-200 bg-white p-5"><div className="h-3 w-24 rounded bg-slate-100" /><div className="mt-5 h-8 w-16 rounded bg-slate-100" /><div className="mt-3 h-3 w-32 rounded bg-slate-100" /></div>;
}

function SectionHeader({ title, description, href, linkLabel = 'View all' }: { title: string; description?: string; href?: string; linkLabel?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-slate-950">{title}</h2>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {href && <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-slate-700 transition-colors hover:text-blue-600">{linkLabel}<FiArrowUpRight aria-hidden="true" /></Link>}
    </div>
  );
}

export default function DashboardPage() {
  const [profiles, setProfiles] = useState<DashboardProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [referenceNow, setReferenceNow] = useState(0);

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await apiClient.get('/user/admin/profiles', { params: { page: 1, limit: 50 } });
      setProfiles(response.data?.items ?? []);
      const updatedAt = new Date();
      setLastUpdated(updatedAt);
      setReferenceNow(updatedAt.getTime());
    } catch {
      setError('We could not load the latest dashboard data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => { void loadProfiles(); }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadProfiles]);

  const stats = useMemo(() => {
    const completed = profiles.filter((profile) => profile.profileCompleted).length;
    const sevenDaysAgo = referenceNow - 7 * 24 * 60 * 60 * 1000;
    const newUsers = profiles.filter((profile) => profile.createdAt && new Date(profile.createdAt).getTime() >= sevenDaysAgo).length;
    const totalXp = profiles.reduce((sum, profile) => sum + Number(profile.totalXp ?? profile.xp ?? 0), 0);

    return { totalUsers: profiles.length, completed, incomplete: profiles.length - completed, newUsers, totalXp };
  }, [profiles, referenceNow]);

  const recentProfiles = [...profiles].sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()).slice(0, 5);
  const topProfiles = [...profiles].sort((a, b) => Number(b.totalXp ?? b.xp ?? 0) - Number(a.totalXp ?? a.xp ?? 0)).slice(0, 5);
  const completionRate = stats.totalUsers ? Math.round((stats.completed / stats.totalUsers) * 100) : 0;

  const statItems = [
    { label: 'Total users', value: stats.totalUsers, hint: 'All registered profiles', icon: FiUsers, tone: 'bg-blue-50 text-blue-600' },
    { label: 'New this week', value: stats.newUsers, hint: 'Joined in the last 7 days', icon: FiUserPlus, tone: 'bg-slate-100 text-slate-700' },
    { label: 'Profile completion', value: `${completionRate}%`, hint: `${stats.completed} of ${stats.totalUsers} profiles complete`, icon: FiCheckCircle, tone: 'bg-emerald-50 text-emerald-600' },
    { label: 'XP distributed', value: formatNumber(stats.totalXp), hint: 'Across visible profiles', icon: FiZap, tone: 'bg-amber-50 text-amber-600' },
  ];

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-blue-600">Operations overview</p>
          <h1 className="text-3xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-4xl">Good morning, Admin.</h1>
          <p className="mt-2 max-w-xl text-base leading-7 text-slate-500">A focused view of your community, profile health, and engagement signals.</p>
        </div>
        <button type="button" onClick={() => void loadProfiles()} disabled={loading} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60" aria-label="Refresh dashboard data">
          <FiRefreshCw aria-hidden="true" className={loading ? 'animate-spin' : ''} />
          {loading ? 'Refreshing' : 'Refresh data'}
        </button>
      </div>

      {error && (
        <div role="alert" className="mb-6 flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2"><FiAlertCircle aria-hidden="true" />{error}</span>
          <button type="button" onClick={() => void loadProfiles()} className="font-semibold underline underline-offset-4">Try again</button>
        </div>
      )}

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? statItems.map((item) => <StatSkeleton key={item.label} />) : statItems.map(({ label, value, hint, icon: Icon, tone }) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <div className="flex items-start justify-between gap-4"><p className="text-sm font-medium text-slate-500">{label}</p><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}><Icon aria-hidden="true" size={18} /></span></div>
            <p className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
            <p className="mt-2 text-xs text-slate-500">{hint}</p>
          </div>
        ))}
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-2xl border border-slate-200 bg-slate-950 p-6 text-white shadow-[0_12px_32px_rgba(15,23,42,0.12)] sm:p-8">
          <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-medium text-slate-400">Profile health</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">Keep the explorer community moving.</h2></div><FiTrendingUp aria-hidden="true" className="text-blue-400" size={24} /></div>
          <div className="mt-8 flex items-end justify-between gap-6"><div><p className="text-5xl font-semibold tracking-tight">{loading ? '—' : `${completionRate}%`}</p><p className="mt-2 text-sm text-slate-400">profile completion rate</p></div><div className="w-full max-w-xs"><div className="mb-2 flex justify-between text-xs text-slate-400"><span>Completed profiles</span><span>{stats.completed}/{stats.totalUsers}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-blue-500 transition-all duration-500" style={{ width: `${completionRate}%` }} /></div></div></div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"><p className="text-sm font-medium text-slate-500">Quick actions</p><div className="mt-4 grid gap-2"><Link href="/users" className="group flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800 transition hover:border-blue-200 hover:bg-blue-50"><span className="flex items-center gap-3"><FiUsers className="text-blue-600" aria-hidden="true" />Review users</span><FiArrowUpRight className="text-slate-400 transition group-hover:text-blue-600" aria-hidden="true" /></Link><Link href="/photo-verification-queue" className="group flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800 transition hover:border-blue-200 hover:bg-blue-50"><span className="flex items-center gap-3"><FiShield className="text-blue-600" aria-hidden="true" />Open photo queue</span><FiArrowUpRight className="text-slate-400 transition group-hover:text-blue-600" aria-hidden="true" /></Link><Link href="/analytics" className="group flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800 transition hover:border-blue-200 hover:bg-blue-50"><span className="flex items-center gap-3"><FiTrendingUp className="text-blue-600" aria-hidden="true" />View analytics</span><FiArrowUpRight className="text-slate-400 transition group-hover:text-blue-600" aria-hidden="true" /></Link></div></div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]" aria-labelledby="recent-users-heading"><SectionHeader title="Recent users" description="The latest profiles added to the platform." href="/users" /><div className="p-2 sm:p-3">{loading ? <div className="space-y-2 p-3">{[1, 2, 3, 4].map((item) => <div key={item} className="h-14 animate-pulse rounded-xl bg-slate-50" />)}</div> : recentProfiles.length === 0 ? <div className="px-4 py-12 text-center"><FiUsers className="mx-auto text-slate-300" size={28} aria-hidden="true" /><p className="mt-3 text-sm font-semibold text-slate-700">No users yet</p><p className="mt-1 text-sm text-slate-500">New profiles will appear here.</p></div> : recentProfiles.map((profile) => { const name = getProfileName(profile); return <div key={profile._id} className="flex items-center justify-between gap-4 rounded-xl px-3 py-3 transition hover:bg-slate-50"><div className="flex min-w-0 items-center gap-3"><Initials name={name} /><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{name}</p><p className="mt-1 truncate text-xs text-slate-500">{profile.location || profile.experienceLevel || 'Profile created'} · {formatDate(profile.createdAt)}</p></div></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${profile.profileCompleted ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{profile.profileCompleted ? 'Complete' : 'Incomplete'}</span></div>; })}</div></section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]" aria-labelledby="leaderboard-heading"><SectionHeader title="XP leaders" description="Top explorers by total experience." href="/analytics" linkLabel="Analytics" /><div className="p-3">{loading ? <div className="space-y-2 p-2">{[1, 2, 3, 4].map((item) => <div key={item} className="h-14 animate-pulse rounded-xl bg-slate-50" />)}</div> : topProfiles.length === 0 ? <div className="px-4 py-12 text-center"><FiZap className="mx-auto text-slate-300" size={28} aria-hidden="true" /><p className="mt-3 text-sm font-semibold text-slate-700">No XP data yet</p><p className="mt-1 text-sm text-slate-500">Leaders will appear after users start exploring.</p></div> : topProfiles.map((profile, index) => { const name = getProfileName(profile); const xp = Number(profile.totalXp ?? profile.xp ?? 0); return <div key={profile._id} className="flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-slate-50"><span className="w-5 text-center text-xs font-bold text-slate-400">{String(index + 1).padStart(2, '0')}</span><Initials name={name} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{name}</p><p className="mt-1 text-xs text-slate-500">Level {profile.level ?? 1} · {profile.experienceLevel || 'Unranked'}</p></div><p className="shrink-0 text-sm font-semibold text-slate-900">{formatNumber(xp)} <span className="text-xs font-normal text-slate-400">XP</span></p></div>; })}</div></section>
      </div>

      <div className="mt-5 flex items-center justify-between gap-4 text-xs text-slate-400"><span className="flex items-center gap-1.5"><FiClock aria-hidden="true" />{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Waiting for data'}</span><span>{stats.incomplete} profile{stats.incomplete === 1 ? '' : 's'} need completion</span></div>
    </div>
  );
}
