'use client';

import { useEffect, useMemo, useState } from 'react';
import { FiChevronLeft, FiChevronRight, FiRefreshCw, FiRotateCcw, FiTrash2 } from 'react-icons/fi';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import {
  Campaign,
  CampaignApprovalStatus,
  fetchCampaignBin,
  permanentlyDeleteCampaign,
  restoreCampaign,
} from '@/lib/campaigns';

type DeletedDateFilter = 'all' | 'today' | '7d' | '30d';
type OriginalStatusFilter = 'all' | CampaignApprovalStatus;

export default function CampaignBinPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [deletedDateFilter, setDeletedDateFilter] = useState<DeletedDateFilter>('all');
  const [statusFilter, setStatusFilter] = useState<OriginalStatusFilter>('all');
  const [filterNow] = useState(() => Date.now());
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  async function loadBin(targetPage = page) {
    setLoading(true);
    setError('');

    try {
      const response = await fetchCampaignBin({ page: targetPage, limit });
      setCampaigns(response.items);
      setPage(response.pagination.page);
      setTotalPages(Math.max(1, response.pagination.totalPages));
      setTotalItems(response.pagination.total);
    } catch {
      setError('Failed to load campaign bin.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadBin(page);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [page, limit]);

  const filteredCampaigns = useMemo(() => {
    const query = search.trim().toLowerCase();
    return campaigns.filter((campaign) => {
      const matchesSearch = !query || (
        campaign.title.toLowerCase().includes(query)
        || (campaign.campaignCode ?? campaign._id).toLowerCase().includes(query)
        || (campaign.location ?? '').toLowerCase().includes(query)
        || (campaign.creator?.name ?? '').toLowerCase().includes(query)
        || (campaign.creator?.phoneNumber ?? '').toLowerCase().includes(query)
      );
      const matchesStatus = statusFilter === 'all' || campaign.approvalStatus === statusFilter;
      const deletedAt = campaign.updatedAt ? new Date(campaign.updatedAt).getTime() : Number.NaN;
      const ageDays = Number.isFinite(deletedAt) ? (filterNow - deletedAt) / (24 * 60 * 60 * 1000) : Number.POSITIVE_INFINITY;
      const matchesDeletedDate =
        deletedDateFilter === 'all'
        || (deletedDateFilter === 'today' && ageDays < 1)
        || (deletedDateFilter === '7d' && ageDays <= 7)
        || (deletedDateFilter === '30d' && ageDays <= 30);

      return matchesSearch && matchesStatus && matchesDeletedDate;
    });
  }, [campaigns, deletedDateFilter, filterNow, search, statusFilter]);

  async function handleRestore(campaignId: string) {
    setError('');
    setSuccess('');
    setActionId(campaignId);

    try {
      await restoreCampaign(campaignId);
      await loadBin(page);
      setSuccess('Campaign restored successfully.');
    } catch {
      setError('Unable to restore campaign.');
    } finally {
      setActionId(null);
    }
  }

  function openPermanentDeleteModal(campaign: Campaign) {
    setSelectedCampaign(campaign);
    setDeleteReason('');
    setDeleteModalOpen(true);
  }

  function closePermanentDeleteModal() {
    if (actionId) {
      return;
    }

    setDeleteModalOpen(false);
    setDeleteReason('');
    setSelectedCampaign(null);
  }

  async function confirmPermanentDelete() {
    if (!selectedCampaign) {
      return;
    }

    setError('');
    setSuccess('');
    setActionId(selectedCampaign._id);

    try {
      await permanentlyDeleteCampaign(selectedCampaign._id, deleteReason);
      closePermanentDeleteModal();

      const nextPage = campaigns.length === 1 && page > 1 ? page - 1 : page;
      await loadBin(nextPage);
      setSuccess('Campaign permanently deleted.');
    } catch {
      setError('Unable to permanently delete campaign.');
    } finally {
      setActionId(null);
    }
  }

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Campaign Bin</h1>
          <p className="mt-1 text-sm text-slate-600">Restore campaigns from bin or permanently remove them.</p>
        </div>
        <button
          type="button"
          onClick={() => void loadBin(page)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
        >
          <FiRefreshCw size={16} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          {success}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 lg:max-w-md"
            placeholder="Search deleted campaigns"
          />

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={deletedDateFilter}
              onChange={(event) => setDeletedDateFilter(event.target.value as DeletedDateFilter)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Deleted date filter"
            >
              <option value="all">Any deleted date</option>
              <option value="today">Deleted today</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </select>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as OriginalStatusFilter)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Original approval status filter"
            >
              <option value="all">Any original status</option>
              <option value="draft">Draft</option>
              <option value="submitted">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <label htmlFor="bin-page-size" className="whitespace-nowrap text-sm text-slate-600">
              Rows per page
            </label>
            <select
              id="bin-page-size"
              value={limit}
              onChange={(event) => {
                setLimit(Number(event.target.value));
                setPage(1);
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Title</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Creator</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Location</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Original Status</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Deleted At</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {loading && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-sm text-slate-500">
                  Loading campaign bin...
                </td>
              </tr>
            )}

            {!loading && filteredCampaigns.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-sm text-slate-500">
                  No deleted campaigns found.
                </td>
              </tr>
            )}

            {!loading && filteredCampaigns.map((campaign) => (
              <tr key={campaign._id} className="hover:bg-slate-50">
                <td className="px-6 py-4">
                  <p className="font-medium text-slate-900">{campaign.title}</p>
                  <p className="text-xs text-slate-500">{campaign.campaignCode ?? campaign._id}</p>
                </td>
                <td className="px-6 py-4 text-sm text-slate-700">
                  <p>{campaign.creator?.name ?? 'Unknown'}</p>
                  <p className="text-xs text-slate-500">{campaign.creator?.phoneNumber ?? 'N/A'}</p>
                </td>
                <td className="px-6 py-4 text-sm text-slate-700">{campaign.location ?? 'N/A'}</td>
                <td className="px-6 py-4 text-sm text-slate-700 capitalize">{campaign.approvalStatus ?? 'draft'}</td>
                <td className="px-6 py-4 text-sm text-slate-700">
                  {campaign.updatedAt ? new Date(campaign.updatedAt).toLocaleString() : 'N/A'}
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => void handleRestore(campaign._id)}
                      disabled={actionId === campaign._id}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      <FiRotateCcw size={12} />
                      Restore
                    </button>

                    <button
                      type="button"
                      onClick={() => openPermanentDeleteModal(campaign)}
                      disabled={actionId === campaign._id}
                      className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1.5 text-xs text-white hover:bg-red-700 disabled:opacity-60"
                    >
                      <FiTrash2 size={12} />
                      Delete Forever
                    </button>

                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-600">
          Showing page {page} of {Math.max(totalPages, 1)} • {totalItems} total deleted campaigns
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={loading || page <= 1}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <FiChevronLeft size={14} />
            Prev
          </button>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={loading || page >= totalPages}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Next
            <FiChevronRight size={14} />
          </button>
        </div>
      </div>

      <ConfirmModal
        open={deleteModalOpen}
        title="Permanently Delete Campaign"
        description={selectedCampaign ? `Delete \"${selectedCampaign.title}\" forever? This cannot be undone.` : 'This action cannot be undone.'}
        confirmLabel="Delete Forever"
        isProcessing={Boolean(actionId)}
        reasonLabel="Delete reason (optional)"
        reasonPlaceholder="Add context for permanent delete"
        reasonValue={deleteReason}
        onReasonChange={setDeleteReason}
        onCancel={closePermanentDeleteModal}
        onConfirm={() => void confirmPermanentDelete()}
      />
    </div>
  );
}
