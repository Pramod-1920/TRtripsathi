'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api';

type ReportCategory = 'feedback' | 'report';
type ReportStatus = 'open' | 'investigating' | 'resolved' | 'dismissed';

interface ReportUser {
  _id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
}

interface Report {
  _id: string;
  reporterId?: ReportUser;
  category?: ReportCategory;
  targetId?: string;
  targetType?: string;
  reason: string;
  description: string;
  status: ReportStatus;
  assignedTo?: ReportUser;
  resolution?: string;
  createdAt: string;
  resolvedAt?: string;
}

interface ReportStats {
  total: number;
  open: number;
  investigating: number;
  resolved: number;
  dismissed: number;
  topReasons: Array<{ reason: string; count: number }>;
  byCategory?: {
    feedback: number;
    report: number;
  };
}

const statusFilters: ReportStatus[] = ['open', 'investigating', 'resolved', 'dismissed'];

const reasonLabels: Record<string, string> = {
  bug: 'Bug',
  feature_request: 'Feature request',
  general_feedback: 'General feedback',
  harassment: 'Harassment',
  spam: 'Spam',
  inappropriate_content: 'Inappropriate content',
  safety_concern: 'Safety concern',
  fraud: 'Fraud',
  other: 'Other',
};

function formatReason(reason: string) {
  return reasonLabels[reason] ?? reason.replaceAll('_', ' ');
}

function getReporterName(user?: ReportUser) {
  if (!user) return 'Unknown';
  if (user.name) return user.name;
  const fullName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
  return fullName || user.phoneNumber || 'Unknown';
}

function getStatusColor(status: string) {
  switch (status) {
    case 'open':
      return 'bg-destructive/15 text-destructive';
    case 'investigating':
      return 'bg-primary/15 text-primary';
    case 'resolved':
      return 'bg-secondary/20 text-secondary';
    case 'dismissed':
      return 'bg-muted text-muted-foreground';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export default function ReportManager() {
  const [category, setCategory] = useState<ReportCategory>('feedback');
  const [reports, setReports] = useState<Report[]>([]);
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<ReportStatus>('open');
  const [page, setPage] = useState(1);
  const [totalReports, setTotalReports] = useState(0);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [resolutionText, setResolutionText] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const itemsPerPage = 20;

  useEffect(() => {
    setPage(1);
    setSelectedReport(null);
  }, [category]);

  useEffect(() => {
    let active = true;
    let refreshInFlight = false;

    async function load(showLoading = false) {
      if (refreshInFlight) return;
      refreshInFlight = true;
      try {
        if (showLoading) setLoading(true);
        setError(null);

        const [listResponse, statsResponse] = await Promise.all([
          apiClient.get('/reports/admin/all', {
            params: {
              category,
              status: filterStatus,
              page,
              limit: itemsPerPage,
            },
          }),
          apiClient.get('/reports/admin/stats', {
            params: { category },
          }),
        ]);

        if (!active) return;

        setReports(listResponse.data?.data ?? []);
        setTotalReports(listResponse.data?.total ?? 0);
        setStats(statsResponse.data);
      } catch {
        if (active) {
          setError('Failed to load admin report data.');
        }
      } finally {
        refreshInFlight = false;
        if (active) {
          setLoading(false);
        }
      }
    }

    void load(true);

    // Keep the moderation queue current when another administrator changes a
    // report. The refresh is silent so the table does not flash a loader.
    const refreshTimer = window.setInterval(() => void load(), 8000);
    const refreshOnFocus = () => void load();
    window.addEventListener('focus', refreshOnFocus);

    return () => {
      active = false;
      window.clearInterval(refreshTimer);
      window.removeEventListener('focus', refreshOnFocus);
    };
  }, [category, filterStatus, page]);

  const categoryTitle = category === 'feedback' ? 'System Feedback' : 'Player Reports';
  const totalPages = Math.max(1, Math.ceil(totalReports / itemsPerPage));

  const categoryCounts = useMemo(
    () => ({
      feedback: stats?.byCategory?.feedback ?? 0,
      report: stats?.byCategory?.report ?? 0,
    }),
    [stats],
  );

  const updateReportStatus = async (
    reportId: string,
    newStatus: ReportStatus,
    resolution?: string,
  ) => {
    const previousStatus =
      selectedReport?._id === reportId
        ? selectedReport.status
        : reports.find((report) => report._id === reportId)?.status;
    const nextResolution = resolution?.trim();

    try {
      setUpdatingStatus(true);
      setError(null);
      await apiClient.patch(`/reports/${reportId}/status`, {
        status: newStatus,
        ...(nextResolution ? { resolution: nextResolution } : {}),
      });

      const applyUpdate = (report: Report): Report =>
        report._id === reportId
          ? {
              ...report,
              status: newStatus,
              ...(nextResolution ? { resolution: nextResolution } : {}),
            }
          : report;

      // Reflect the successful mutation immediately. Because the table is
      // status-filtered, an item moved to another status leaves this list.
      setReports((current) =>
        filterStatus === newStatus ? current.map(applyUpdate) : current.filter((report) => report._id !== reportId),
      );
      if (filterStatus !== newStatus) {
        setTotalReports((current) => Math.max(0, current - 1));
      }
      setSelectedReport((current) => (current ? applyUpdate(current) : null));
      setResolutionText('');

      if (previousStatus && previousStatus !== newStatus) {
        setStats((current) =>
          current
            ? {
                ...current,
                [previousStatus]: Math.max(0, current[previousStatus] - 1),
                [newStatus]: current[newStatus] + 1,
              }
            : current,
        );
      }

      // Revalidate the counters in the background in case another moderator
      // changed a report at the same time.
      void apiClient
        .get('/reports/admin/stats', { params: { category } })
        .then((response) => setStats(response.data))
        .catch(() => undefined);
    } catch {
      setError('Failed to update report status.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (error) {
    return <div className="p-6 text-destructive">{error}</div>;
  }

  return (
    <div className="space-y-6 p-6 text-foreground">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">{categoryTitle}</p>
        </div>

        <div className="flex rounded-lg border border-border bg-muted/40 p-1">
          {[
            { value: 'feedback' as const, label: 'Feedback', count: categoryCounts.feedback },
            { value: 'report' as const, label: 'Reports', count: categoryCounts.report },
          ].map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setCategory(item.value)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                category === item.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {item.label} ({item.count})
            </button>
          ))}
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="text-xs text-muted-foreground">Total</div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </div>
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 shadow-sm">
            <div className="text-xs text-destructive">Open</div>
            <div className="text-2xl font-bold text-destructive">{stats.open}</div>
          </div>
          <div className="rounded-lg border border-primary/30 bg-primary/10 p-4 shadow-sm">
            <div className="text-xs text-primary">Investigating</div>
            <div className="text-2xl font-bold text-primary">{stats.investigating}</div>
          </div>
          <div className="rounded-lg border border-secondary/35 bg-secondary/15 p-4 shadow-sm">
            <div className="text-xs text-secondary">Resolved</div>
            <div className="text-2xl font-bold text-secondary">{stats.resolved}</div>
          </div>
          <div className="rounded-lg border border-border bg-muted/50 p-4 shadow-sm">
            <div className="text-xs text-muted-foreground">Dismissed</div>
            <div className="text-2xl font-bold text-muted-foreground">{stats.dismissed}</div>
          </div>
        </div>
      )}

      {stats && stats.topReasons.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">Top Reasons</h2>
          <div className="grid gap-2 md:grid-cols-2">
            {stats.topReasons.map((item) => (
              <div key={item.reason} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
                <span className="text-sm text-foreground">{formatReason(item.reason)}</span>
                <span className="font-semibold text-primary">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {statusFilters.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => {
              setFilterStatus(status);
              setPage(1);
            }}
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              filterStatus === status
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-foreground hover:bg-accent'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px]">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold">ID</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">From</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Target</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Reason</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Date</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center">
                    Loading...
                  </td>
                </tr>
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">
                    No {category === 'feedback' ? 'feedback' : 'reports'} found
                  </td>
                </tr>
              ) : (
                reports.map((report) => (
                  <tr key={report._id} className="hover:bg-accent/40">
                    <td className="px-6 py-4 text-sm font-mono">{report._id.slice(-8)}</td>
                    <td className="px-6 py-4 text-sm">{getReporterName(report.reporterId)}</td>
                    <td className="px-6 py-4 text-sm">
                      {report.category === 'feedback'
                        ? 'System'
                        : `${report.targetType ?? 'Target'} ${report.targetId ? report.targetId.slice(-8) : ''}`}
                    </td>
                    <td className="px-6 py-4 text-sm">{formatReason(report.reason)}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${getStatusColor(report.status)}`}>
                        {report.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {new Date(report.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        type="button"
                        onClick={() => setSelectedReport(report)}
                        className="text-primary hover:underline"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalReports > 0 && (
          <div className="flex items-center justify-between border-t border-border px-6 py-4">
            <div className="text-sm text-muted-foreground">
              Page {page} of {totalPages} ({totalReports} total)
            </div>
            <div className="space-x-2">
              <button
                type="button"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="rounded-md bg-muted px-3 py-1 hover:bg-accent disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages}
                className="rounded-md bg-muted px-3 py-1 hover:bg-accent disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 backdrop-blur-sm">
          <div className="mx-4 max-h-screen w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-card p-6 shadow-xl">
            <h2 className="mb-4 text-2xl font-bold">
              {selectedReport.category === 'feedback' ? 'Feedback Details' : 'Report Details'}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground">Submitted By</label>
                <p className="font-semibold">{getReporterName(selectedReport.reporterId)}</p>
              </div>

              <div>
                <label className="text-sm text-muted-foreground">Category</label>
                <p className="font-semibold">{selectedReport.category === 'feedback' ? 'Feedback' : 'Player report'}</p>
              </div>

              <div>
                <label className="text-sm text-muted-foreground">Target</label>
                <p className="font-semibold">
                  {selectedReport.category === 'feedback'
                    ? 'System'
                    : `${selectedReport.targetType ?? 'Target'} ${selectedReport.targetId ?? ''}`}
                </p>
              </div>

              <div>
                <label className="text-sm text-muted-foreground">Reason</label>
                <p className="font-semibold">{formatReason(selectedReport.reason)}</p>
              </div>

              <div>
                <label className="text-sm text-muted-foreground">Description</label>
                <p className="rounded-md bg-muted/60 p-3">{selectedReport.description}</p>
              </div>

              <div>
                <label className="text-sm text-muted-foreground">Current Status</label>
                <p className={`w-fit rounded-full px-2 py-1 text-sm font-semibold ${getStatusColor(selectedReport.status)}`}>
                  {selectedReport.status}
                </p>
              </div>

              {selectedReport.resolution && (
                <div>
                  <label className="text-sm text-muted-foreground">Resolution</label>
                  <p className="rounded-md bg-secondary/15 p-3">{selectedReport.resolution}</p>
                </div>
              )}

              {selectedReport.status === 'open' || selectedReport.status === 'investigating' ? (
                <div className="mt-6 space-y-3 border-t border-border pt-4">
                  <textarea
                    value={resolutionText}
                    onChange={(event) => setResolutionText(event.target.value)}
                    placeholder="Resolution note (optional)"
                    className="w-full rounded-md border border-border bg-background p-2 text-sm"
                    rows={3}
                  />

                  <div className="flex flex-col gap-2 sm:flex-row">
                    {selectedReport.status === 'open' && (
                      <button
                        type="button"
                        disabled={updatingStatus}
                        onClick={() => updateReportStatus(selectedReport._id, 'investigating', resolutionText)}
                        className="flex-1 rounded-md bg-primary py-2 text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {updatingStatus ? 'Updating...' : 'Mark Investigating'}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={updatingStatus}
                      onClick={() => updateReportStatus(selectedReport._id, 'resolved', resolutionText)}
                      className="flex-1 rounded-md bg-secondary py-2 text-secondary-foreground hover:bg-secondary/90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {updatingStatus ? 'Updating...' : 'Resolve'}
                    </button>
                    <button
                      type="button"
                      disabled={updatingStatus}
                      onClick={() => updateReportStatus(selectedReport._id, 'dismissed', resolutionText)}
                      className="flex-1 rounded-md bg-muted py-2 text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {updatingStatus ? 'Updating...' : 'Dismiss'}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => setSelectedReport(null)}
              className="mt-6 w-full rounded-md bg-muted py-2 hover:bg-accent"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
