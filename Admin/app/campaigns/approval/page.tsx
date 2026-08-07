'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FiCheck,
  FiChevronLeft,
  FiChevronRight,
  FiEye,
  FiMapPin,
  FiRefreshCw,
  FiX,
} from 'react-icons/fi';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import {
  Campaign,
  CampaignApprovalStatus,
  approveCampaign,
  fetchCampaigns,
  rejectCampaign,
} from '@/lib/campaigns';
import {
  DifficultyTier,
  ExtraItem,
  PlaceDistrictNode,
  PlaceProvinceNode,
  fetchAdminPlaceHierarchy,
  fetchDifficultySettings,
  fetchExtras,
} from '@/lib/extras';
import { useAuthStore } from '@/lib/auth-store';

type StatusFilter = Extract<CampaignApprovalStatus, 'submitted' | 'approved' | 'rejected'>;
type BulkAction = 'approve' | 'reject';

const STATUS_OPTIONS: Array<{ label: string; value: StatusFilter }> = [
  { label: 'Pending', value: 'submitted' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
];

function formatDate(value?: string | null) {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'N/A' : parsed.toLocaleString();
}

function sameValue(left?: string | null, right?: string) {
  if (!right) return true;
  return (left ?? '').trim().toLowerCase() === right.trim().toLowerCase();
}

function campaignLocation(campaign: Campaign) {
  return [campaign.placeName, campaign.location].filter(Boolean).join(' - ') || 'N/A';
}

export default function CampaignApprovalPage() {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'admin';

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [difficulties, setDifficulties] = useState<DifficultyTier[]>([]);
  const [activities, setActivities] = useState<ExtraItem[]>([]);
  const [provinces, setProvinces] = useState<PlaceProvinceNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterLoading, setFilterLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [bulkAction, setBulkAction] = useState<BulkAction | null>(null);
  const [bulkReason, setBulkReason] = useState('');
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('submitted');
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [activityFilter, setActivityFilter] = useState('');
  const [provinceFilter, setProvinceFilter] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadCampaigns = useCallback(async (status = statusFilter) => {
    setLoading(true);
    setError('');

    try {
      const response = await fetchCampaigns({
        page: 1,
        limit: 500,
        includeFuture: true,
        approvalStatus: status,
      });
      setCampaigns(response.items);
      setSelectedIds([]);
    } catch {
      setError('Failed to load campaign approvals.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    let active = true;

    async function loadFilters() {
      setFilterLoading(true);

      try {
        const [difficultyItems, activityItems, placeItems] = await Promise.all([
          fetchDifficultySettings(),
          fetchExtras('activities', { page: 1, limit: 100 }),
          fetchAdminPlaceHierarchy(),
        ]);

        if (!active) return;
        setDifficulties(difficultyItems.filter((item) => item.enabled !== false));
        setActivities(
          activityItems.items.filter((item) => item.enabled !== false && !item.parentId),
        );
        setProvinces(placeItems.provinces.filter((item) => item.deleted !== true));
      } catch {
        if (active) {
          setError('Some filters could not be loaded.');
        }
      } finally {
        if (active) setFilterLoading(false);
      }
    }

    void loadFilters();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCampaigns(statusFilter);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadCampaigns, statusFilter]);

  const districtOptions = useMemo<PlaceDistrictNode[]>(() => {
    const province = provinces.find((item) => item.name === provinceFilter);
    return province?.districts.filter((item) => item.deleted !== true) ?? [];
  }, [provinceFilter, provinces]);

  const filteredCampaigns = useMemo(() => {
    const query = search.trim().toLowerCase();

    return campaigns.filter((campaign) => {
      const matchesDifficulty = sameValue(campaign.difficulty, difficultyFilter);
      const matchesActivity = sameValue(campaign.category, activityFilter);
      const matchesProvince = sameValue(campaign.province, provinceFilter);
      const matchesDistrict = sameValue(campaign.district, districtFilter);
      const matchesSearch = !query || (
        campaign.title.toLowerCase().includes(query)
        || (campaign.creator?.name ?? '').toLowerCase().includes(query)
        || (campaign.location ?? '').toLowerCase().includes(query)
        || (campaign.placeName ?? '').toLowerCase().includes(query)
        || (campaign.campaignCode ?? campaign._id).toLowerCase().includes(query)
      );

      return matchesDifficulty && matchesActivity && matchesProvince && matchesDistrict && matchesSearch;
    });
  }, [activityFilter, campaigns, difficultyFilter, districtFilter, provinceFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredCampaigns.length / limit));
  const safePage = Math.min(page, totalPages);
  const pagedCampaigns = useMemo(() => {
    const start = (safePage - 1) * limit;
    return filteredCampaigns.slice(start, start + limit);
  }, [filteredCampaigns, limit, safePage]);

  const pageSelected = pagedCampaigns.length > 0
    && pagedCampaigns.every((campaign) => selectedIds.includes(campaign._id));

  function toggleSelection(campaignId: string) {
    setSelectedIds((current) => (
      current.includes(campaignId)
        ? current.filter((id) => id !== campaignId)
        : [...current, campaignId]
    ));
  }

  function togglePageSelection() {
    const pageIds = pagedCampaigns.map((campaign) => campaign._id);
    setSelectedIds((current) => {
      if (pageIds.every((id) => current.includes(id))) {
        return current.filter((id) => !pageIds.includes(id));
      }

      return Array.from(new Set([...current, ...pageIds]));
    });
  }

  async function handleApprove(campaignId: string) {
    setError('');
    setSuccess('');
    setActionId(campaignId);

    try {
      await approveCampaign(campaignId);
      setCampaigns((current) => current.filter((campaign) => campaign._id !== campaignId));
      setSelectedIds((current) => current.filter((id) => id !== campaignId));
      setSuccess('Campaign approved successfully.');
    } catch {
      setError('Unable to approve campaign.');
    } finally {
      setActionId(null);
    }
  }

  async function handleReject(campaignId: string) {
    const reason = window.prompt('Enter reject reason');
    if (!reason?.trim()) return;

    setError('');
    setSuccess('');
    setActionId(campaignId);

    try {
      await rejectCampaign(campaignId, reason.trim());
      setCampaigns((current) => current.filter((campaign) => campaign._id !== campaignId));
      setSelectedIds((current) => current.filter((id) => id !== campaignId));
      setSuccess('Campaign rejected successfully.');
    } catch {
      setError('Unable to reject campaign.');
    } finally {
      setActionId(null);
    }
  }

  async function confirmBulkAction() {
    if (!bulkAction || selectedIds.length === 0) return;
    if (bulkAction === 'reject' && !bulkReason.trim()) {
      setError('Reject reason is required for bulk rejection.');
      return;
    }

    setError('');
    setSuccess('');
    setBulkProcessing(true);

    try {
      const ids = [...selectedIds];
      const results = await Promise.allSettled(
        ids.map((id) => (
          bulkAction === 'approve'
            ? approveCampaign(id)
            : rejectCampaign(id, bulkReason.trim())
        )),
      );
      const succeededIds = ids.filter((_, index) => results[index].status === 'fulfilled');
      const failedCount = results.length - succeededIds.length;

      setCampaigns((current) => current.filter((campaign) => !succeededIds.includes(campaign._id)));
      setSelectedIds((current) => current.filter((id) => !succeededIds.includes(id)));
      setSuccess(`${succeededIds.length} campaign(s) ${bulkAction === 'approve' ? 'approved' : 'rejected'}.`);
      if (failedCount > 0) {
        setError(`${failedCount} campaign(s) could not be processed.`);
      }
      setBulkAction(null);
      setBulkReason('');
    } finally {
      setBulkProcessing(false);
    }
  }

  const canReview = isAdmin && statusFilter === 'submitted';

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Campaign Approval Queue</h1>
          <p className="mt-1 text-sm text-slate-600">Review campaign submissions with Extra-based filters.</p>
        </div>
        <button
          type="button"
          onClick={() => void loadCampaigns(statusFilter)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
        >
          <FiRefreshCw size={16} />
          Refresh
        </button>
      </div>

      {!isAdmin && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Only admins can approve or reject campaigns.
        </div>
      )}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">{success}</div>}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
          <input
            type="text"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 xl:col-span-2"
            placeholder="Search title, host, location"
          />
          <select
            value={difficultyFilter}
            onChange={(event) => {
              setDifficultyFilter(event.target.value);
              setPage(1);
            }}
            disabled={filterLoading}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
          >
            <option value="">All difficulty</option>
            {difficulties.map((item) => (
              <option key={item.id} value={item.label}>{item.label}</option>
            ))}
          </select>
          <select
            value={activityFilter}
            onChange={(event) => {
              setActivityFilter(event.target.value);
              setPage(1);
            }}
            disabled={filterLoading}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
          >
            <option value="">All activities</option>
            {activities.map((item) => (
              <option key={item._id} value={item.name}>{item.name}</option>
            ))}
          </select>
          <select
            value={provinceFilter}
            onChange={(event) => {
              setProvinceFilter(event.target.value);
              setDistrictFilter('');
              setPage(1);
            }}
            disabled={filterLoading}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
          >
            <option value="">All provinces</option>
            {provinces.map((item) => (
              <option key={item.id} value={item.name}>{item.name}</option>
            ))}
          </select>
          <select
            value={districtFilter}
            onChange={(event) => {
              setDistrictFilter(event.target.value);
              setPage(1);
            }}
            disabled={filterLoading || !provinceFilter}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
          >
            <option value="">{provinceFilter ? 'All districts' : 'Select province first'}</option>
            {districtOptions.map((item) => (
              <option key={item.id} value={item.name}>{item.name}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as StatusFilter);
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {STATUS_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            {selectedIds.length} selected from {filteredCampaigns.length} matching campaign(s)
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setBulkAction('approve')}
              disabled={!canReview || selectedIds.length === 0 || bulkProcessing}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              <FiCheck size={14} />
              Approve All Selected
            </button>
            <button
              type="button"
              onClick={() => setBulkAction('reject')}
              disabled={!canReview || selectedIds.length === 0 || bulkProcessing}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-60"
            >
              <FiX size={14} />
              Reject All Selected
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto overscroll-x-contain rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[1100px]">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={pageSelected}
                  onChange={togglePageSelection}
                  disabled={!canReview || pagedCampaigns.length === 0}
                  className="h-4 w-4 rounded border-slate-300"
                  aria-label="Select campaigns on this page"
                />
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Campaign</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Host</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Activity</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Difficulty</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Location</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Created</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-slate-900">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {loading && (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-sm text-slate-500">Loading campaigns...</td>
              </tr>
            )}

            {!loading && pagedCampaigns.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center">
                  <p className="text-sm font-medium text-slate-900">
                    {statusFilter === 'submitted' ? 'No pending campaigns. Good job!' : 'No campaigns match these filters.'}
                  </p>
                  <Link href="/campaigns/details" className="mt-2 inline-flex text-sm text-blue-700 hover:text-blue-800">
                    View all campaigns
                  </Link>
                </td>
              </tr>
            )}

            {!loading && pagedCampaigns.map((campaign) => (
              <tr key={campaign._id} className="hover:bg-slate-50">
                <td className="px-4 py-4">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(campaign._id)}
                    onChange={() => toggleSelection(campaign._id)}
                    disabled={!canReview}
                    className="h-4 w-4 rounded border-slate-300"
                    aria-label={`Select ${campaign.title}`}
                  />
                </td>
                <td className="px-4 py-4">
                  <p className="font-medium text-slate-900">{campaign.title}</p>
                  <p className="text-xs text-slate-500">{campaign.campaignCode ?? campaign._id}</p>
                </td>
                <td className="px-4 py-4 text-sm text-slate-700">
                  <p>{campaign.creator?.name ?? 'Unknown'}</p>
                  <p className="text-xs text-slate-500">{campaign.creator?.phoneNumber ?? 'N/A'}</p>
                </td>
                <td className="px-4 py-4 text-sm text-slate-700">
                  <p>{campaign.category ?? 'N/A'}</p>
                  {campaign.subcategory && <p className="text-xs text-slate-500">{campaign.subcategory}</p>}
                </td>
                <td className="px-4 py-4 text-sm text-slate-700">{campaign.difficulty ?? 'N/A'}</td>
                <td className="px-4 py-4 text-sm text-slate-700">
                  <span className="inline-flex items-center gap-1">
                    <FiMapPin size={12} />
                    {campaignLocation(campaign)}
                  </span>
                </td>
                <td className="px-4 py-4 text-sm text-slate-700">{formatDate(campaign.createdAt)}</td>
                <td className="px-4 py-4">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {canReview && (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleApprove(campaign._id)}
                          disabled={actionId === campaign._id}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs text-white hover:bg-emerald-700 disabled:opacity-60"
                        >
                          <FiCheck size={12} />
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleReject(campaign._id)}
                          disabled={actionId === campaign._id}
                          className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1.5 text-xs text-white hover:bg-red-700 disabled:opacity-60"
                        >
                          <FiX size={12} />
                          Reject
                        </button>
                      </>
                    )}
                    <Link href={`/campaigns/details/${campaign._id}`} className="rounded-lg p-2 text-blue-600 hover:bg-blue-50" title="View campaign">
                      <FiEye size={16} />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-600">
          Showing page {safePage} of {totalPages} - {filteredCampaigns.length} campaign(s)
        </p>
        <div className="flex items-center gap-2">
          <select
            value={limit}
            onChange={(event) => {
              setLimit(Number(event.target.value));
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Rows per page"
          >
            <option value={5}>5 rows</option>
            <option value={10}>10 rows</option>
            <option value={20}>20 rows</option>
            <option value={50}>50 rows</option>
          </select>
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={loading || safePage <= 1}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <FiChevronLeft size={14} />
            Prev
          </button>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={loading || safePage >= totalPages}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Next
            <FiChevronRight size={14} />
          </button>
        </div>
      </div>

      <ConfirmModal
        open={Boolean(bulkAction)}
        title={bulkAction === 'approve' ? 'Approve Selected Campaigns' : 'Reject Selected Campaigns'}
        description={`Process ${selectedIds.length} selected campaign(s)?`}
        confirmLabel={bulkAction === 'approve' ? 'Approve Selected' : 'Reject Selected'}
        isProcessing={bulkProcessing}
        requireReason={bulkAction === 'reject'}
        reasonLabel="Reject reason"
        reasonPlaceholder="Write why these campaigns are being rejected"
        reasonValue={bulkReason}
        onReasonChange={setBulkReason}
        onCancel={() => {
          if (!bulkProcessing) {
            setBulkAction(null);
            setBulkReason('');
          }
        }}
        onConfirm={() => void confirmBulkAction()}
      />
    </div>
  );
}
