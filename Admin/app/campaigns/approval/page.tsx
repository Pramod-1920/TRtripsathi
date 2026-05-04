'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  FiCheck,
  FiChevronLeft,
  FiChevronRight,
  FiEye,
  FiMapPin,
  FiRefreshCw,
  FiX,
} from 'react-icons/fi';
import {
  Campaign,
  approveCampaign,
  fetchCampaigns,
  rejectCampaign,
} from '@/lib/campaigns';
import { useAuthStore } from '@/lib/auth-store';

type ApprovalSection = 'open' | 'closed' | 'complete' | 'no-approval';

function toDateTime(value?: string | null) {
  if (!value) {
    return 'N/A';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'N/A';
  }

  return parsed.toLocaleString();
}

function getTabLabel(section: ApprovalSection) {
  if (section === 'closed') {
    return 'Closed';
  }

  if (section === 'complete') {
    return 'Complete';
  }

  if (section === 'no-approval') {
    return "Doesn't Need Approval";
  }

  return 'Open';
}

function getSectionTitle(section: ApprovalSection) {
  if (section === 'closed') {
    return 'Closed Campaigns';
  }

  if (section === 'complete') {
    return 'Accepted Campaigns';
  }

  if (section === 'no-approval') {
    return "Campaigns That Don't Need Approval";
  }

  return 'Open Approval Campaigns';
}

function getSectionDescription(section: ApprovalSection) {
  if (section === 'closed') {
    return 'Only rejected campaigns are shown here.';
  }

  if (section === 'complete') {
    return 'Only campaigns approved by admin review are shown here.';
  }

  if (section === 'no-approval') {
    return 'Campaigns created by users that were auto-approved because they do not require approval.';
  }

  return 'Campaigns that require admin approval and are still open.';
}

function getTabClass(active: boolean) {
  return active
    ? 'border-blue-600 text-blue-600'
    : 'border-transparent text-slate-600 hover:text-slate-900';
}

function getStatusDateForSection(section: ApprovalSection, campaign: Campaign) {
  if (section === 'closed') {
    return campaign.rejectedAt;
  }

  if (section === 'complete') {
    return campaign.approvedAt;
  }

  if (section === 'no-approval') {
    return campaign.createdAt;
  }

  return campaign.submittedAt;
}

function getNoteForSection(section: ApprovalSection, campaign: Campaign) {
  if (section === 'no-approval') {
    return 'Auto-approved (no review needed)';
  }

  return campaign.approvalNote?.trim() || '—';
}

function isAdminReviewedApproval(campaign: Campaign) {
  return campaign.approvalStatus === 'approved' && Boolean(campaign.approvedBy);
}

function isNoApprovalCampaign(campaign: Campaign) {
  return campaign.approvalStatus === 'approved' && !campaign.approvedBy;
}

export default function CampaignApprovalPage() {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'admin';
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusActionId, setStatusActionId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [section, setSection] = useState<ApprovalSection>('open');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  async function loadCampaigns(targetSection = section) {
    setLoading(true);
    setError('');

    try {
      const sharedParams = { page: 1, limit: 500, includeFuture: true };

      if (targetSection === 'open') {
        const response = await fetchCampaigns({
          ...sharedParams,
          approvalStatus: 'submitted',
        });
        setCampaigns(response.items);
      } else if (targetSection === 'closed') {
        const response = await fetchCampaigns({
          ...sharedParams,
          approvalStatus: 'rejected',
        });
        setCampaigns(response.items);
      } else {
        const response = await fetchCampaigns({
          ...sharedParams,
          approvalStatus: 'approved',
        });
        setCampaigns(
          targetSection === 'complete'
            ? response.items.filter(isAdminReviewedApproval)
            : response.items.filter(isNoApprovalCampaign),
        );
      }
    } catch {
      setError('Failed to load campaign approvals.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCampaigns(section);
  }, [section]);

  const filteredCampaigns = useMemo(() => {
    const query = search.trim().toLowerCase();

    return campaigns.filter((campaign) => {
      if (!query) {
        return true;
      }

      return (
        campaign.title.toLowerCase().includes(query)
        || (campaign.campaignCode ?? campaign._id).toLowerCase().includes(query)
        || (campaign.location ?? '').toLowerCase().includes(query)
        || (campaign.creator?.name ?? '').toLowerCase().includes(query)
        || (campaign.creator?.phoneNumber ?? '').toLowerCase().includes(query)
      );
    });
  }, [campaigns, search]);

  const totalItems = filteredCampaigns.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  const safePage = Math.min(page, totalPages);
  const pagedCampaigns = useMemo(() => {
    const start = (safePage - 1) * limit;
    return filteredCampaigns.slice(start, start + limit);
  }, [filteredCampaigns, safePage, limit]);

  useEffect(() => {
    if (page !== safePage) {
      setPage(safePage);
    }
  }, [page, safePage]);

  async function handleApprove(campaignId: string) {
    setError('');
    setSuccess('');
    setStatusActionId(campaignId);

    try {
      await approveCampaign(campaignId);
      await loadCampaigns(section);
      setSuccess('Campaign approved successfully.');
    } catch {
      setError('Unable to approve campaign.');
    } finally {
      setStatusActionId(null);
    }
  }

  async function handleReject(campaignId: string) {
    const reason = window.prompt('Enter reject reason');
    if (!reason || !reason.trim()) {
      return;
    }

    setError('');
    setSuccess('');
    setStatusActionId(campaignId);

    try {
      await rejectCampaign(campaignId, reason.trim());
      await loadCampaigns(section);
      setSuccess('Campaign rejected successfully.');
    } catch {
      setError('Unable to reject campaign.');
    } finally {
      setStatusActionId(null);
    }
  }

  const sectionTitle = getSectionTitle(section);
  const sectionDescription = getSectionDescription(section);
  const canReview = section === 'open' && isAdmin;

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Campaign Approval</h1>
          <p className="mt-1 text-sm text-slate-600">{sectionDescription}</p>
        </div>
        <button
          type="button"
          onClick={() => void loadCampaigns(section)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
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
        <div className="mb-4 flex flex-wrap gap-2 border-b border-slate-200">
          {(['open', 'closed', 'complete', 'no-approval'] as ApprovalSection[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setSection(item);
                setPage(1);
              }}
              className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${getTabClass(section === item)}`}
            >
              {getTabLabel(item)}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 lg:max-w-md"
            placeholder={`Search ${sectionTitle.toLowerCase()}`}
          />
          <div className="flex items-center gap-2">
            <label htmlFor="approval-page-size" className="whitespace-nowrap text-sm text-slate-600">
              Rows per page
            </label>
            <select
              id="approval-page-size"
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
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Status Date</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Note</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {loading && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-sm text-slate-500">
                  Loading {sectionTitle.toLowerCase()}...
                </td>
              </tr>
            )}

            {!loading && pagedCampaigns.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-sm text-slate-500">
                  No {sectionTitle.toLowerCase()} found.
                </td>
              </tr>
            )}

            {!loading && pagedCampaigns.map((campaign) => (
              <tr key={campaign._id} className="hover:bg-slate-50">
                <td className="px-6 py-4">
                  <p className="font-medium text-slate-900">{campaign.title}</p>
                  <p className="text-xs text-slate-500">{campaign.campaignCode ?? campaign._id}</p>
                </td>
                <td className="px-6 py-4 text-sm text-slate-700">
                  <p>{campaign.creator?.name ?? 'Unknown'}</p>
                  <p className="text-xs text-slate-500">{campaign.creator?.phoneNumber ?? 'N/A'}</p>
                </td>
                <td className="px-6 py-4 text-sm text-slate-700">
                  <span className="inline-flex items-center gap-1">
                    <FiMapPin size={12} />
                    {campaign.location ?? 'N/A'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-slate-700">
                  {toDateTime(getStatusDateForSection(section, campaign))}
                </td>
                <td className="px-6 py-4 text-sm text-slate-700">
                  {getNoteForSection(section, campaign)}
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {canReview && (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleApprove(campaign._id)}
                          disabled={statusActionId === campaign._id}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs text-white hover:bg-emerald-700 disabled:opacity-60"
                        >
                          <FiCheck size={12} />
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleReject(campaign._id)}
                          disabled={statusActionId === campaign._id}
                          className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1.5 text-xs text-white hover:bg-red-700 disabled:opacity-60"
                        >
                          <FiX size={12} />
                          Reject
                        </button>
                      </>
                    )}
                    <Link
                      href={`/campaigns/details/${campaign._id}`}
                      className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"
                      title="View campaign"
                    >
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
          Showing page {safePage} of {totalPages} • {totalItems} {sectionTitle.toLowerCase()}
        </p>
        <div className="flex items-center gap-2">
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
    </div>
  );
}
