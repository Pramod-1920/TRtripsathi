'use client';

import React, { useEffect, useState } from 'react';

interface Report {
  _id: string;
  reporterId: { _id: string; name: string };
  targetId: string;
  targetType: string;
  reason: string;
  description: string;
  status: 'open' | 'investigating' | 'resolved' | 'dismissed';
  assignedTo?: { _id: string; name: string };
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
}

export default function ReportManager() {
  const [reports, setReports] = useState<Report[]>([]);
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('open');
  const [page, setPage] = useState(1);
  const [totalReports, setTotalReports] = useState(0);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [resolutionText, setResolutionText] = useState('');
  const itemsPerPage = 20;

  useEffect(() => {
    fetchReports();
    fetchStats();
  }, [filterStatus, page]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      const endpoint =
        filterStatus === 'open' ? '/api/reports/admin/open' : `/api/reports/admin/all?status=${filterStatus}`;
      const response = await fetch(`${endpoint}&page=${page}&limit=${itemsPerPage}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setReports(data.data || []);
      setTotalReports(data.total || 0);
    } catch (err) {
      setError('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('/api/reports/admin/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Failed to load stats', err);
    }
  };

  const getStatusColor = (status: string) => {
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
  };

  const updateReportStatus = async (reportId: string, newStatus: string, resolution?: string) => {
    try {
      const token = localStorage.getItem('access_token');
      const payload: any = { status: newStatus };
      if (resolution) payload.resolution = resolution;

      const response = await fetch(`/api/reports/${reportId}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setSelectedReport(null);
        setResolutionText('');
        fetchReports();
        fetchStats();
      }
    } catch (err) {
      setError('Failed to update report');
    }
  };

  if (error) {
    return <div className="p-4 text-destructive">{error}</div>;
  }

  return (
    <div className="space-y-6 p-6 text-foreground">
      <h1 className="text-3xl font-bold">Report Management</h1>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="text-xs text-muted-foreground">Total</div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </div>
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 shadow-sm">
            <div className="text-xs text-destructive">Open</div>
            <div className="text-2xl font-bold text-destructive">{stats.open}</div>
          </div>
          <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 shadow-sm">
            <div className="text-xs text-primary">Investigating</div>
            <div className="text-2xl font-bold text-primary">{stats.investigating}</div>
          </div>
          <div className="rounded-xl border border-secondary/35 bg-secondary/15 p-4 shadow-sm">
            <div className="text-xs text-secondary">Resolved</div>
            <div className="text-2xl font-bold text-secondary">{stats.resolved}</div>
          </div>
          <div className="rounded-xl border border-border bg-muted/50 p-4 shadow-sm">
            <div className="text-xs text-muted-foreground">Dismissed</div>
            <div className="text-2xl font-bold text-muted-foreground">{stats.dismissed}</div>
          </div>
        </div>
      )}

      {/* Top Reasons */}
      {stats && stats.topReasons.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <h2 className="text-lg font-semibold mb-3">Top Report Reasons</h2>
          <div className="space-y-2">
            {stats.topReasons.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <span className="text-foreground">{item.reason}</span>
                <span className="font-semibold text-primary">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status Filter */}
      <div className="flex space-x-2">
        {['open', 'investigating', 'resolved', 'dismissed'].map((status) => (
          <button
            key={status}
            onClick={() => {
              setFilterStatus(status);
              setPage(1);
            }}
            className={`px-4 py-2 rounded ${
              filterStatus === status
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-foreground hover:bg-accent'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Reports List */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold">ID</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Reporter</th>
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
                <td colSpan={7} className="px-6 py-4 text-center">
                  Loading...
                </td>
              </tr>
            ) : reports.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                  No reports found
                </td>
              </tr>
            ) : (
              reports.map((report) => (
                <tr key={report._id} className="hover:bg-accent/40">
                  <td className="px-6 py-4 text-sm font-mono">{report._id.slice(-8)}</td>
                  <td className="px-6 py-4 text-sm">{report.reporterId?.name || 'Unknown'}</td>
                  <td className="px-6 py-4 text-sm">{report.targetType}</td>
                  <td className="px-6 py-4 text-sm">{report.reason}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(report.status)}`}>
                      {report.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {new Date(report.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <button
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

        {/* Pagination */}
        {totalReports > 0 && (
          <div className="flex items-center justify-between border-t border-border px-6 py-4">
            <div className="text-sm text-muted-foreground">
              Page {page} of {Math.ceil(totalReports / itemsPerPage)} ({totalReports} total)
            </div>
            <div className="space-x-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="rounded-md bg-muted px-3 py-1 hover:bg-accent disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page * itemsPerPage >= totalReports}
                className="rounded-md bg-muted px-3 py-1 hover:bg-accent disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Report Detail Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 backdrop-blur-sm">
          <div className="mx-4 max-h-screen w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-xl">
            <h2 className="text-2xl font-bold mb-4">Report Details</h2>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground">Reporter</label>
                <p className="font-semibold">{selectedReport.reporterId?.name}</p>
              </div>

              <div>
                <label className="text-sm text-muted-foreground">Target Type</label>
                <p className="font-semibold">{selectedReport.targetType}</p>
              </div>

              <div>
                <label className="text-sm text-muted-foreground">Reason</label>
                <p className="font-semibold">{selectedReport.reason}</p>
              </div>

              <div>
                <label className="text-sm text-muted-foreground">Description</label>
                <p className="rounded-md bg-muted/60 p-3">{selectedReport.description}</p>
              </div>

              <div>
                <label className="text-sm text-muted-foreground">Current Status</label>
                <p className={`font-semibold px-2 py-1 rounded-full text-sm w-fit ${getStatusColor(selectedReport.status)}`}>
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
                    onChange={(e) => setResolutionText(e.target.value)}
                    placeholder="Resolution note (optional)"
                    className="w-full rounded-md border border-border bg-background p-2 text-sm"
                    rows={3}
                  />

                  <div className="flex space-x-2">
                    {selectedReport.status === 'open' && (
                      <button
                        onClick={() => updateReportStatus(selectedReport._id, 'investigating', resolutionText)}
                        className="flex-1 rounded-full bg-primary py-2 text-primary-foreground hover:bg-primary/90"
                      >
                        Mark Investigating
                      </button>
                    )}
                    <button
                      onClick={() => updateReportStatus(selectedReport._id, 'resolved', resolutionText)}
                      className="flex-1 rounded-full bg-secondary py-2 text-secondary-foreground hover:bg-secondary/90"
                    >
                      Resolve
                    </button>
                    <button
                      onClick={() => updateReportStatus(selectedReport._id, 'dismissed', resolutionText)}
                      className="flex-1 rounded-full bg-muted py-2 text-foreground hover:bg-accent"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <button
              onClick={() => setSelectedReport(null)}
              className="mt-6 w-full rounded-full bg-muted py-2 hover:bg-accent"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
