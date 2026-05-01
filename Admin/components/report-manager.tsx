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
        return 'bg-red-100 text-red-800';
      case 'investigating':
        return 'bg-yellow-100 text-yellow-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      case 'dismissed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
    return <div className="text-red-600 p-4">{error}</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold">Report Management</h1>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-xs text-gray-600">Total</div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </div>
          <div className="bg-red-50 p-4 rounded-lg shadow">
            <div className="text-xs text-red-600">Open</div>
            <div className="text-2xl font-bold text-red-600">{stats.open}</div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg shadow">
            <div className="text-xs text-yellow-600">Investigating</div>
            <div className="text-2xl font-bold text-yellow-600">{stats.investigating}</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg shadow">
            <div className="text-xs text-green-600">Resolved</div>
            <div className="text-2xl font-bold text-green-600">{stats.resolved}</div>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg shadow">
            <div className="text-xs text-gray-600">Dismissed</div>
            <div className="text-2xl font-bold text-gray-600">{stats.dismissed}</div>
          </div>
        </div>
      )}

      {/* Top Reasons */}
      {stats && stats.topReasons.length > 0 && (
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-3">Top Report Reasons</h2>
          <div className="space-y-2">
            {stats.topReasons.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <span className="text-gray-700">{item.reason}</span>
                <span className="font-semibold text-blue-600">{item.count}</span>
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
              filterStatus === status ? 'bg-blue-600 text-white' : 'bg-gray-200'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Reports List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
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
                <tr key={report._id} className="hover:bg-gray-50">
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
                      className="text-blue-600 hover:underline"
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
          <div className="px-6 py-4 border-t flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Page {page} of {Math.ceil(totalReports / itemsPerPage)} ({totalReports} total)
            </div>
            <div className="space-x-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page * itemsPerPage >= totalReports}
                className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Report Detail Modal */}
      {selectedReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full mx-4 p-6 max-h-screen overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Report Details</h2>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-600">Reporter</label>
                <p className="font-semibold">{selectedReport.reporterId?.name}</p>
              </div>

              <div>
                <label className="text-sm text-gray-600">Target Type</label>
                <p className="font-semibold">{selectedReport.targetType}</p>
              </div>

              <div>
                <label className="text-sm text-gray-600">Reason</label>
                <p className="font-semibold">{selectedReport.reason}</p>
              </div>

              <div>
                <label className="text-sm text-gray-600">Description</label>
                <p className="bg-gray-50 p-3 rounded">{selectedReport.description}</p>
              </div>

              <div>
                <label className="text-sm text-gray-600">Current Status</label>
                <p className={`font-semibold px-2 py-1 rounded-full text-sm w-fit ${getStatusColor(selectedReport.status)}`}>
                  {selectedReport.status}
                </p>
              </div>

              {selectedReport.resolution && (
                <div>
                  <label className="text-sm text-gray-600">Resolution</label>
                  <p className="bg-green-50 p-3 rounded">{selectedReport.resolution}</p>
                </div>
              )}

              {selectedReport.status === 'open' || selectedReport.status === 'investigating' ? (
                <div className="space-y-3 mt-6 pt-4 border-t">
                  <textarea
                    value={resolutionText}
                    onChange={(e) => setResolutionText(e.target.value)}
                    placeholder="Resolution note (optional)"
                    className="w-full border rounded p-2 text-sm"
                    rows={3}
                  />

                  <div className="flex space-x-2">
                    {selectedReport.status === 'open' && (
                      <button
                        onClick={() => updateReportStatus(selectedReport._id, 'investigating', resolutionText)}
                        className="flex-1 bg-yellow-600 text-white py-2 rounded hover:bg-yellow-700"
                      >
                        Mark Investigating
                      </button>
                    )}
                    <button
                      onClick={() => updateReportStatus(selectedReport._id, 'resolved', resolutionText)}
                      className="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700"
                    >
                      Resolve
                    </button>
                    <button
                      onClick={() => updateReportStatus(selectedReport._id, 'dismissed', resolutionText)}
                      className="flex-1 bg-gray-600 text-white py-2 rounded hover:bg-gray-700"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <button
              onClick={() => setSelectedReport(null)}
              className="mt-6 w-full bg-gray-200 py-2 rounded hover:bg-gray-300"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
