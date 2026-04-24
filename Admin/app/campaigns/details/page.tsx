'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  FiChevronLeft,
  FiChevronRight,
  FiCopy,
  FiEye,
  FiEdit2,
  FiTrash2,
  FiRefreshCw,
  FiMapPin,
} from 'react-icons/fi';
import { Campaign, deleteCampaign, fetchCampaigns } from '@/lib/campaigns';
import { ConfirmModal } from '@/components/ui/confirm-modal';

type SearchScope = 'all' | 'id' | 'title' | 'location' | 'creator';
type StatusFilter = 'all' | 'active' | 'upcoming' | 'closed';

function getCampaignStatus(campaign: Campaign) {
  if (campaign.completed) {
    return 'closed';
  }

  if (!campaign.startDate) {
    return 'active';
  }

  const now = new Date();
  const startDate = new Date(campaign.startDate);
  const joinOpenDate = campaign.joinOpenDate ? new Date(campaign.joinOpenDate) : null;

  if (joinOpenDate && now < joinOpenDate) {
    return 'upcoming';
  }

  if (now < startDate) {
    return 'upcoming';
  }

  return 'active';
}

export default function CampaignDetailsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [searchScope, setSearchScope] = useState<SearchScope>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [deleteReason, setDeleteReason] = useState('');

  async function loadCampaigns(targetPage = page) {
    setLoading(true);
    setError('');

    try {
      const response = await fetchCampaigns({ page: targetPage, limit });
      setCampaigns(response.items);
      setPage(response.pagination.page);
      setTotalPages(response.pagination.totalPages);
      setTotalItems(response.pagination.total);
    } catch {
      setError('Failed to load campaign details from backend.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCampaigns(page);
  }, [page, limit]);

  const filteredCampaigns = useMemo(() => {
    const query = search.trim().toLowerCase();

    return campaigns.filter((campaign) => {
      const matchesSearch = !query || (() => {
        switch (searchScope) {
          case 'id':
            return (campaign.campaignCode ?? campaign._id).toLowerCase().includes(query);
          case 'title':
            return campaign.title.toLowerCase().includes(query);
          case 'location':
            return (campaign.location ?? '').toLowerCase().includes(query);
          case 'creator':
            return (
              (campaign.creator?.name ?? '').toLowerCase().includes(query)
              || (campaign.creator?.phoneNumber ?? '').toLowerCase().includes(query)
            );
          case 'all':
          default:
            return (
              campaign.title.toLowerCase().includes(query)
              || (campaign.campaignCode ?? campaign._id).toLowerCase().includes(query)
              || (campaign.location ?? '').toLowerCase().includes(query)
              || (campaign.difficulty ?? '').toLowerCase().includes(query)
              || (campaign.creator?.name ?? '').toLowerCase().includes(query)
              || (campaign.creator?.phoneNumber ?? '').toLowerCase().includes(query)
            );
        }
      })();

      const campaignStatus = getCampaignStatus(campaign);
      const matchesStatus = statusFilter === 'all' || campaignStatus === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [campaigns, search, searchScope, statusFilter]);

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, page + 2);

    for (let current = start; current <= end; current += 1) {
      pages.push(current);
    }

    return pages;
  }, [page, totalPages]);

  function openDeleteModal(campaign: Campaign) {
    setSelectedCampaign(campaign);
    setDeleteReason('');
    setDeleteModalOpen(true);
  }

  function closeDeleteModal() {
    if (deleting) {
      return;
    }

    setDeleteModalOpen(false);
    setSelectedCampaign(null);
    setDeleteReason('');
  }

  async function confirmDelete() {
    if (!selectedCampaign) {
      return;
    }

    setError('');
    setSuccess('');
    setDeleting(true);

    try {
      await deleteCampaign(selectedCampaign._id, deleteReason);
      closeDeleteModal();

      const nextPage = campaigns.length === 1 && page > 1 ? page - 1 : page;
      await loadCampaigns(nextPage);
      setSuccess('Campaign deleted successfully.');
    } catch {
      setError('Unable to delete campaign.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Campaign Details</h1>
          <p className="mt-1 text-sm text-slate-600">View, edit, and delete campaigns connected to backend APIs.</p>
        </div>
        <button
          type="button"
          onClick={() => void loadCampaigns(page)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 transition-colors"
        >
          <FiRefreshCw size={18} />
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
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Search campaigns"
          />
          <select
            value={searchScope}
            onChange={(event) => setSearchScope(event.target.value as SearchScope)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All fields</option>
            <option value="id">Campaign ID</option>
            <option value="title">Title</option>
            <option value="location">Location</option>
            <option value="creator">Creator</option>
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="upcoming">Upcoming</option>
            <option value="closed">Closed</option>
          </select>
          <div className="flex items-center gap-2">
            <label htmlFor="page-size" className="text-sm text-slate-600 whitespace-nowrap">
              Rows per page
            </label>
            <select
              id="page-size"
              value={limit}
              onChange={(event) => {
                const nextLimit = Number(event.target.value);
                setLimit(nextLimit);
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

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Title</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Location</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Difficulty</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Status</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Join</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Created</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {loading && (
              <tr>
                <td className="px-6 py-8 text-sm text-slate-500" colSpan={7}>
                  Loading campaigns...
                </td>
              </tr>
            )}

            {!loading && filteredCampaigns.length === 0 && (
              <tr>
                <td className="px-6 py-8 text-sm text-slate-500" colSpan={7}>
                  No campaigns found.
                </td>
              </tr>
            )}

            {!loading && filteredCampaigns.map((campaign) => (
              <tr key={campaign._id} className="hover:bg-slate-50">
                <td className="px-6 py-4">
                  <div>
                    <p className="font-medium text-slate-900">{campaign.title}</p>
                    <p className="text-xs text-slate-500">NPR {campaign.estimatedNPR ?? 0}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      <span className="truncate">{campaign.campaignCode || campaign._id}</span>
                      <button
                        type="button"
                        onClick={async () => {
                          await navigator.clipboard.writeText(campaign.campaignCode || campaign._id);
                          setSuccess(`Copied ${campaign.campaignCode || campaign._id}`);
                        }}
                        className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                        title="Copy campaign ID"
                      >
                        <FiCopy size={12} />
                      </button>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-700">
                  <span className="inline-flex items-center gap-1">
                    <FiMapPin size={12} />
                    {campaign.location || 'N/A'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-slate-700">{campaign.difficulty || 'N/A'}</td>
                <td className="px-6 py-4 text-sm text-slate-700">
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                    getCampaignStatus(campaign) === 'closed'
                      ? 'bg-slate-100 text-slate-700'
                      : getCampaignStatus(campaign) === 'upcoming'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-emerald-50 text-emerald-700'
                  }`}>
                    {getCampaignStatus(campaign)}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-slate-700">{campaign.joinMode || 'open'}</td>
                <td className="px-6 py-4 text-sm text-slate-700">
                  {campaign.createdAt ? new Date(campaign.createdAt).toLocaleDateString() : 'N/A'}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/campaigns/details/${campaign._id}`}
                      className="p-2 rounded-lg text-blue-600 hover:bg-blue-50"
                      title="View campaign"
                    >
                      <FiEye size={16} />
                    </Link>
                    <Link
                      href={`/campaigns/details/${campaign._id}?mode=edit`}
                      className="p-2 rounded-lg text-amber-600 hover:bg-amber-50"
                      title="Edit campaign"
                    >
                      <FiEdit2 size={16} />
                    </Link>
                    <button
                      type="button"
                      onClick={() => openDeleteModal(campaign)}
                      className="p-2 rounded-lg text-red-600 hover:bg-red-50"
                      title="Delete campaign"
                    >
                      <FiTrash2 size={16} />
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
          Showing page {page} of {Math.max(totalPages, 1)} • {totalItems} total campaigns
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={loading || page <= 1}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <FiChevronLeft size={14} />
            Prev
          </button>

          {page > 3 && (
            <>
              <button
                type="button"
                onClick={() => setPage(1)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                1
              </button>
              <span className="px-1 text-slate-500">...</span>
            </>
          )}

          {pageNumbers.map((pageNumber) => (
            <button
              key={pageNumber}
              type="button"
              onClick={() => setPage(pageNumber)}
              className={`rounded-lg px-3 py-2 text-sm ${
                pageNumber === page
                  ? 'bg-blue-600 text-white'
                  : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {pageNumber}
            </button>
          ))}

          {page < totalPages - 2 && (
            <>
              <span className="px-1 text-slate-500">...</span>
              <button
                type="button"
                onClick={() => setPage(totalPages)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                {totalPages}
              </button>
            </>
          )}

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
        title="Delete Campaign"
        description={selectedCampaign ? `You are deleting \"${selectedCampaign.title}\". This action cannot be undone.` : 'This action cannot be undone.'}
        confirmLabel="Delete"
        isProcessing={deleting}
        requireReason
        reasonLabel="Delete reason"
        reasonPlaceholder="Write why this campaign is being removed"
        reasonValue={deleteReason}
        onReasonChange={setDeleteReason}
        onCancel={closeDeleteModal}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
