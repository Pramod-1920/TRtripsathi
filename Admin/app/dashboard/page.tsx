"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiActivity,
  FiAlertCircle,
  FiArrowUpRight,
  FiCamera,
  FiCheckCircle,
  FiClock,
  FiFlag,
  FiRefreshCw,
  FiShield,
  FiUsers,
} from "react-icons/fi";
import { apiClient } from "@/lib/api";
import {
  Campaign,
  fetchCampaigns,
  getCampaignDisplayStatus,
  getCampaignStatusBadgeClass,
} from "@/lib/campaigns";

type DashboardProfile = {
  _id: string;
  role: "user";
  firstName?: string | null;
  lastName?: string | null;
  profileCompleted?: boolean;
  location?: string | null;
  createdAt?: string;
};

type PhotoQueueResponse = {
  items?: Array<{ requestCode: string; profileId: string }>;
  pagination?: { total?: number };
};

function profileName(profile: DashboardProfile) {
  return (
    `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim() ||
    "Unnamed explorer"
  );
}

function formatDate(value?: string | null) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function Initials({ name }: { name: string }) {
  const value = name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-700">
      {value || "?"}
    </span>
  );
}

function StatSkeleton() {
  return (
    <div className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white" />
  );
}

export default function DashboardPage() {
  const [profiles, setProfiles] = useState<DashboardProfile[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [completedUsers, setCompletedUsers] = useState(0);
  const [totalCampaigns, setTotalCampaigns] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [pendingPhotoReviews, setPendingPhotoReviews] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [
        profilesResponse,
        completedResponse,
        campaignsResponse,
        approvalsResponse,
        photoResponse,
      ] = await Promise.all([
        apiClient.get("/user/admin/profiles", {
          params: { page: 1, limit: 50 },
        }),
        apiClient.get("/user/admin/profiles", {
          params: { page: 1, limit: 1, status: "complete" },
        }),
        fetchCampaigns({ page: 1, limit: 200, includeFuture: true }),
        fetchCampaigns({
          page: 1,
          limit: 5,
          includeFuture: true,
          approvalStatus: "submitted",
        }),
        apiClient.get<PhotoQueueResponse>(
          "/user/admin/photo-verification-requests",
          {
            params: { status: "pending", page: 1, limit: 5 },
          },
        ),
      ]);

      const profileItems = (profilesResponse.data?.items ?? []) as Array<
        Partial<DashboardProfile>
      >;
      const users = profileItems.filter(
        (profile): profile is DashboardProfile =>
          profile.role === "user" && typeof profile._id === "string",
      );

      setProfiles(users);
      setCampaigns(campaignsResponse.items);
      setTotalUsers(
        Number(profilesResponse.data?.pagination?.total ?? users.length),
      );
      setCompletedUsers(Number(completedResponse.data?.pagination?.total ?? 0));
      setTotalCampaigns(campaignsResponse.pagination.total);
      setPendingApprovals(approvalsResponse.pagination.total);
      setPendingPhotoReviews(Number(photoResponse.data.pagination?.total ?? 0));
      setLastUpdated(new Date());
    } catch {
      setError("The operations dashboard could not load all live data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const metrics = useMemo(() => {
    const activeCampaigns = campaigns.filter((campaign) => {
      const phase = String(campaign.lifecyclePhase ?? "").toLowerCase();
      return (
        campaign.approvalStatus === "approved" &&
        phase !== "completed" &&
        phase !== "cancelled"
      );
    }).length;
    const completionRate = totalUsers
      ? Math.round((completedUsers / totalUsers) * 100)
      : 0;
    const phaseCounts = campaigns.reduce<Record<string, number>>(
      (counts, campaign) => {
        const phase = String(campaign.lifecyclePhase ?? "draft").toLowerCase();
        counts[phase] = (counts[phase] ?? 0) + 1;
        return counts;
      },
      {},
    );

    return { activeCampaigns, completionRate, phaseCounts };
  }, [campaigns, completedUsers, totalUsers]);

  const recentProfiles = [...profiles]
    .sort(
      (a, b) =>
        new Date(b.createdAt ?? 0).getTime() -
        new Date(a.createdAt ?? 0).getTime(),
    )
    .slice(0, 5);
  const recentCampaigns = [...campaigns]
    .sort(
      (a, b) =>
        new Date(b.createdAt ?? 0).getTime() -
        new Date(a.createdAt ?? 0).getTime(),
    )
    .slice(0, 5);
  const attentionTotal = pendingApprovals + pendingPhotoReviews;

  const statItems = [
    {
      label: "Registered users",
      value: totalUsers,
      hint: `${metrics.completionRate}% completed profiles`,
      icon: FiUsers,
      tone: "bg-blue-50 text-blue-700",
    },
    {
      label: "Live campaigns",
      value: metrics.activeCampaigns,
      hint: `${totalCampaigns} campaigns in total`,
      icon: FiActivity,
      tone: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Campaign approvals",
      value: pendingApprovals,
      hint: pendingApprovals
        ? "Waiting for moderation"
        : "Approval queue is clear",
      icon: FiFlag,
      tone: "bg-amber-50 text-amber-700",
    },
    {
      label: "Photo reviews",
      value: pendingPhotoReviews,
      hint: pendingPhotoReviews
        ? "Evidence needs review"
        : "Photo queue is clear",
      icon: FiCamera,
      tone: "bg-violet-50 text-violet-700",
    },
  ];

  const operationalPhases = [
    "open",
    "planning",
    "verification",
    "ready",
    "started",
  ];

  return (
    <main className="mx-auto w-full max-w-[1600px] px-4 py-7 sm:px-6 lg:px-10 lg:py-10">
      <header className="mb-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
            TripSathi operations
          </p>
          <h1 className="text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-4xl">
            What needs attention today?
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
            Live community health, campaign movement and moderation work in one
            place.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadDashboard()}
          disabled={loading}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
        >
          <FiRefreshCw className={loading ? "animate-spin" : ""} />
          {loading ? "Refreshing" : "Refresh data"}
        </button>
      </header>

      {error && (
        <div
          role="alert"
          className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <span className="flex items-center gap-2">
            <FiAlertCircle />
            {error}
          </span>
          <button
            type="button"
            onClick={() => void loadDashboard()}
            className="font-semibold underline"
          >
            Try again
          </button>
        </div>
      )}

      <section className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading
          ? statItems.map((item) => <StatSkeleton key={item.label} />)
          : statItems.map(({ label, value, hint, icon: Icon, tone }) => (
              <article
                key={label}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-slate-500">{label}</p>
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}
                  >
                    <Icon size={18} />
                  </span>
                </div>
                <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
                  {value}
                </p>
                <p className="mt-1 text-xs text-slate-500">{hint}</p>
              </article>
            ))}
      </section>

      <section className="mb-7 grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="overflow-hidden rounded-2xl bg-slate-950 p-6 text-white shadow-[0_14px_38px_rgba(15,23,42,0.14)] sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-300">
                Priority queue
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                {attentionTotal
                  ? `${attentionTotal} item${attentionTotal === 1 ? "" : "s"} need review`
                  : "All moderation queues are clear"}
              </h2>
            </div>
            <FiShield className="text-blue-300" size={25} />
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Link
              href="/campaigns/approval"
              className="group rounded-xl border border-slate-700 bg-slate-900 p-4 transition hover:border-blue-400 hover:bg-slate-800"
            >
              <div className="flex items-center justify-between">
                <FiFlag className="text-amber-300" />
                <FiArrowUpRight className="text-slate-500 group-hover:text-white" />
              </div>
              <p className="mt-4 text-2xl font-semibold">{pendingApprovals}</p>
              <p className="mt-1 text-sm text-slate-400">campaign approvals</p>
            </Link>
            <Link
              href="/photo-verification-queue"
              className="group rounded-xl border border-slate-700 bg-slate-900 p-4 transition hover:border-blue-400 hover:bg-slate-800"
            >
              <div className="flex items-center justify-between">
                <FiCamera className="text-violet-300" />
                <FiArrowUpRight className="text-slate-500 group-hover:text-white" />
              </div>
              <p className="mt-4 text-2xl font-semibold">
                {pendingPhotoReviews}
              </p>
              <p className="mt-1 text-sm text-slate-400">photo verifications</p>
            </Link>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-950">
                Campaign movement
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Current lifecycle distribution
              </p>
            </div>
            <Link
              href="/campaigns/details"
              className="text-sm font-semibold text-blue-600"
            >
              View all
            </Link>
          </div>
          <div className="mt-5 space-y-3">
            {operationalPhases.map((phase) => {
              const value = metrics.phaseCounts[phase] ?? 0;
              const width = metrics.activeCampaigns
                ? Math.max(
                    4,
                    Math.round((value / metrics.activeCampaigns) * 100),
                  )
                : 0;
              return (
                <div key={phase}>
                  <div className="mb-1.5 flex justify-between text-xs">
                    <span className="capitalize text-slate-600">{phase}</span>
                    <span className="font-semibold text-slate-900">
                      {value}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="font-semibold text-slate-950">Recent campaigns</h2>
              <p className="mt-1 text-xs text-slate-500">
                Latest campaigns created on TripSathi
              </p>
            </div>
            <Link
              href="/campaigns/details"
              className="flex items-center gap-1 text-sm font-semibold text-blue-600"
            >
              View all <FiArrowUpRight />
            </Link>
          </div>
          <div className="p-2">
            {loading ? (
              <div className="h-64 animate-pulse rounded-xl bg-slate-50" />
            ) : recentCampaigns.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-500">
                No campaigns yet.
              </p>
            ) : (
              recentCampaigns.map((campaign) => {
                const status = getCampaignDisplayStatus(campaign);
                return (
                  <Link
                    key={campaign._id}
                    href={`/campaigns/details/${campaign._id}`}
                    className="flex items-center justify-between gap-3 rounded-xl px-3 py-3 transition hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {campaign.title}
                      </p>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {campaign.placeName ||
                          campaign.district ||
                          "Location pending"}{" "}
                        · {formatDate(campaign.createdAt)}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${getCampaignStatusBadgeClass(status.key)}`}
                    >
                      {status.label}
                    </span>
                  </Link>
                );
              })
            )}
          </div>
        </article>

        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="font-semibold text-slate-950">Recent users</h2>
              <p className="mt-1 text-xs text-slate-500">
                Newest traveler profiles
              </p>
            </div>
            <Link
              href="/users"
              className="flex items-center gap-1 text-sm font-semibold text-blue-600"
            >
              View all <FiArrowUpRight />
            </Link>
          </div>
          <div className="p-2">
            {loading ? (
              <div className="h-64 animate-pulse rounded-xl bg-slate-50" />
            ) : recentProfiles.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-500">
                No users yet.
              </p>
            ) : (
              recentProfiles.map((profile) => {
                const name = profileName(profile);
                return (
                  <Link
                    key={profile._id}
                    href={`/users/${profile._id}`}
                    className="flex items-center justify-between gap-3 rounded-xl px-3 py-3 transition hover:bg-slate-50"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Initials name={name} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {name}
                        </p>
                        <p className="mt-1 truncate text-xs text-slate-500">
                          {profile.location || "Location pending"} ·{" "}
                          {formatDate(profile.createdAt)}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${profile.profileCompleted ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
                    >
                      {profile.profileCompleted ? "Complete" : "Incomplete"}
                    </span>
                  </Link>
                );
              })
            )}
          </div>
        </article>
      </section>

      <footer className="mt-5 flex flex-col gap-2 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
        <span className="flex items-center gap-1.5">
          <FiClock />
          {lastUpdated
            ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
            : "Waiting for live data"}
        </span>
        <span className="flex items-center gap-1.5">
          <FiCheckCircle />
          {Math.max(0, totalUsers - completedUsers)} profiles still need
          completion
        </span>
      </footer>
    </main>
  );
}
