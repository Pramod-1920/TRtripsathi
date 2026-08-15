'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { FiCheck, FiExternalLink, FiFilter, FiRefreshCw, FiShield, FiX } from 'react-icons/fi';
import { apiClient } from '@/lib/api';

type QueueStatus = 'pending' | 'approved' | 'rejected' | 'all';

type PhotoVerificationQueueItem = {
  profileId: string;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  profilePhoto?: string | null;
  location?: string | null;
  province?: string | null;
  district?: string | null;
  profileCompleted?: boolean;
  requestCode: string;
  campaignId: string;
  url: string;
  kind: 'group' | 'solo';
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  reviewedAt?: string;
  reviewNote?: string | null;
  title?: string | null;
  category?: string | null;
  requestProvince?: string | null;
  requestDistrict?: string | null;
  municipality?: string | null;
  place?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  locationAccuracyMeters?: number | null;
  locationCapturedAt?: string | null;
  distanceFromPlaceMeters?: number | null;
  allowedRadiusMeters?: number | null;
  appealNote?: string | null;
  appealedAt?: string | null;
  appealCount?: number;
};

type QueueResponse = {
  items: PhotoVerificationQueueItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

const PAGE_SIZE = 20;

export default function PhotoVerificationQueuePage() {
  const [statusFilter, setStatusFilter] = useState<QueueStatus>('pending');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<PhotoVerificationQueueItem[]>([]);
  const [pagination, setPagination] = useState<QueueResponse['pagination']>({
    total: 0,
    page: 1,
    limit: PAGE_SIZE,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [reviewNoteByCode, setReviewNoteByCode] = useState<Record<string, string>>({});
  const [reviewingCode, setReviewingCode] = useState<string | null>(null);

  const summaryLabel = useMemo(() => {
    if (statusFilter === 'pending') {
      return 'Pending requests';
    }

    if (statusFilter === 'approved') {
      return 'Approved requests';
    }

    if (statusFilter === 'rejected') {
      return 'Rejected requests';
    }

    return 'All requests';
  }, [statusFilter]);

  async function fetchQueue(targetPage: number, targetStatus: QueueStatus, isMounted = true) {
    setError('');

    const response = await apiClient.get<QueueResponse>('/user/admin/photo-verification-requests', {
      params: {
        status: targetStatus,
        page: targetPage,
        limit: PAGE_SIZE,
      },
    });

    if (!isMounted) {
      return;
    }

    setItems(response.data.items ?? []);
    setPagination(response.data.pagination ?? {
      total: 0,
      page: 1,
      limit: PAGE_SIZE,
      totalPages: 0,
    });
  }

  useEffect(() => {
    let active = true;

    async function loadQueue() {
      try {
        if (!active) {
          return;
        }

        await fetchQueue(page, statusFilter, active);
      } catch {
        if (active) {
          setError('Failed to load the global photo verification queue.');
          setItems([]);
        }
      } finally {
        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }

    void loadQueue();

    return () => {
      active = false;
    };
  }, [page, statusFilter]);

  async function reloadQueue(nextPage = page) {
    setRefreshing(true);

    try {
      await fetchQueue(nextPage, statusFilter);
    } catch {
      setError('Failed to refresh the queue.');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }

  async function handleReviewRequest(item: PhotoVerificationQueueItem, status: 'approved' | 'rejected') {
    if (status === 'rejected' && !reviewNoteByCode[item.requestCode]?.trim()) {
      setError('Enter a clear rejection reason so the user can correct or appeal the decision.');
      return;
    }
    setReviewingCode(item.requestCode);
    setError('');
    setSuccess('');

    try {
      await apiClient.patch(
        `/user/admin/profiles/${item.profileId}/photos/verification-requests/${item.requestCode}`,
        {
          status,
          reviewNote: reviewNoteByCode[item.requestCode]?.trim() || undefined,
        },
      );

      setSuccess(
        status === 'approved'
          ? item.place
            ? `Approved. XP awarded and ${item.requestDistrict || 'the district'} added to the user's map.`
            : 'Request approved and XP awarded.'
          : 'Request rejected.',
      );

      await reloadQueue(page);
    } catch {
      setError('Failed to review this request.');
    } finally {
      setReviewingCode(null);
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Admin Queue</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Photo Verification Queue</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Confirm that the photo matches the selected place and address. Approval awards XP and completes the district on the user&apos;s travel map.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void reloadQueue(page)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <FiRefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {success}
        </div>
      )}

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
              <FiShield size={14} />
              {summaryLabel}
            </span>
            <span>{pagination.total} total requests</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <FiFilter size={14} />
              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value as QueueStatus);
                  setPage(1);
                }}
                className="bg-transparent outline-none"
              >
                <option value="pending">Pending only</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="all">All statuses</option>
              </select>
            </div>

            <div className="text-sm text-slate-500">
              Page {pagination.page} of {pagination.totalPages || 1}
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
          Loading the global queue...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <p className="text-slate-500">No photo verification requests match the selected filter.</p>
        </div>
      ) : (
        <div className="overflow-x-auto overscroll-x-contain rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[900px]">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-5 py-3 text-left text-sm font-semibold text-slate-900">User</th>
                <th className="px-5 py-3 text-left text-sm font-semibold text-slate-900">Request</th>
                <th className="px-5 py-3 text-left text-sm font-semibold text-slate-900">Photo</th>
                <th className="px-5 py-3 text-left text-sm font-semibold text-slate-900">Submitted</th>
                <th className="px-5 py-3 text-left text-sm font-semibold text-slate-900">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {items.map((item) => (
                <tr key={item.requestCode} className="align-top hover:bg-slate-50">
                  <td className="px-5 py-4">
                    <div className="flex items-start gap-3">
                      <div className="h-12 w-12 overflow-hidden rounded-full bg-slate-100">
                        {item.profilePhoto ? (
                          <img src={item.profilePhoto} alt="Profile" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-500">
                            No photo
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <Link href={`/users/${item.profileId}`} className="font-semibold text-slate-900 hover:text-blue-700">
                          {[item.firstName, item.middleName, item.lastName].filter(Boolean).join(' ') || 'Unnamed profile'}
                        </Link>
                        <p className="mt-1 text-xs text-slate-500">Profile ID: {item.profileId}</p>
                        <p className="text-xs text-slate-500">{item.location || 'No location'}{item.district ? ` • ${item.district}` : ''}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-sm font-semibold text-slate-800">{item.title || item.requestCode}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.place ? `Place: ${item.place}` : `Campaign: ${item.campaignId}`}</p>
                    {item.requestDistrict && (
                      <p className="text-xs text-slate-500">{item.requestDistrict} • {item.requestProvince}</p>
                    )}
                    {item.municipality && (
                      <p className="text-xs text-slate-500">Municipality: {item.municipality}</p>
                    )}
                    {item.address && <p className="mt-1 text-xs text-slate-600">{item.address}</p>}
                    {item.category && (
                      <p className="mt-1 text-xs capitalize text-slate-500">{item.category.replaceAll('_', ' ')}</p>
                    )}
                    {item.distanceFromPlaceMeters != null && (
                      <p className="mt-1 text-xs font-medium text-emerald-700">
                        GPS distance: {Math.round(item.distanceFromPlaceMeters)} m / {Math.round(item.allowedRadiusMeters ?? 0)} m allowed
                      </p>
                    )}
                    {item.locationAccuracyMeters != null && (
                      <p className="text-xs text-slate-500">GPS accuracy: ±{Math.round(item.locationAccuracyMeters)} m</p>
                    )}
                    {item.appealNote && (
                      <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                        <strong>User appeal:</strong> {item.appealNote}
                      </div>
                    )}
                    <p className="text-xs text-slate-500">Kind: {item.kind}</p>
                    <span
                      className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                        item.status === 'approved'
                          ? 'bg-emerald-100 text-emerald-700'
                          : item.status === 'rejected'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <a href={item.url} target="_blank" rel="noreferrer" className="block">
                      <img
                        src={item.url}
                        alt={item.title || item.place || 'Verification evidence'}
                        className="mb-2 h-24 w-32 rounded-lg border border-slate-200 object-cover"
                      />
                    </a>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:underline"
                    >
                      Open photo
                      <FiExternalLink size={14} />
                    </a>
                    {item.latitude != null && item.longitude != null && (
                      <a
                        href={`https://www.openstreetmap.org/?mlat=${item.latitude}&mlon=${item.longitude}#map=17/${item.latitude}/${item.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 block text-xs font-medium text-emerald-700 hover:underline"
                      >
                        Check submitted GPS
                      </a>
                    )}
                    {item.reviewNote && (
                      <p className="mt-2 text-xs text-slate-600">Note: {item.reviewNote}</p>
                    )}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-600">
                    {item.submittedAt ? new Date(item.submittedAt).toLocaleString() : 'N/A'}
                    {item.reviewedAt && (
                      <p className="mt-1 text-xs text-slate-500">Reviewed: {new Date(item.reviewedAt).toLocaleString()}</p>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {item.status === 'pending' ? (
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={reviewNoteByCode[item.requestCode] ?? ''}
                          onChange={(event) =>
                            setReviewNoteByCode((current) => ({
                              ...current,
                              [item.requestCode]: event.target.value,
                            }))
                          }
                          placeholder="Review note (required when rejecting)"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void handleReviewRequest(item, 'approved')}
                            disabled={reviewingCode === item.requestCode || !reviewNoteByCode[item.requestCode]?.trim()}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                          >
                            <FiCheck size={14} />
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleReviewRequest(item, 'rejected')}
                            disabled={reviewingCode === item.requestCode}
                            className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                          >
                            <FiX size={14} />
                            Reject
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-slate-500">Already reviewed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          Showing {items.length} of {pagination.total} requests
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1 || refreshing}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(pagination.totalPages || 1, current + 1))}
            disabled={page >= (pagination.totalPages || 1) || refreshing}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
