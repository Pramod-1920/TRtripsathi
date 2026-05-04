'use client';

import { useEffect, useMemo, useState } from 'react';
import { FiRefreshCw } from 'react-icons/fi';
import { Campaign, fetchCampaigns, joinCampaign } from '@/lib/campaigns';
import { useAuthStore } from '@/lib/auth-store';

function getAcceptedParticipantsCount(campaign: Campaign) {
  return (campaign.participants ?? []).filter((participant) => participant.status === 'accepted').length;
}

function getParticipantStatus(campaign: Campaign, userId?: string) {
  if (!userId) {
    return null;
  }

  const participant = (campaign.participants ?? []).find(
    (entry) => String(entry.userId) === String(userId),
  );

  return participant?.status ?? null;
}

function isCampaignOpenForJoin(campaign: Campaign) {
  const now = new Date();

  if (campaign.approvalStatus !== 'approved') {
    return false;
  }

  if (campaign.completed || campaign.failed || campaign.awaitingVerification) {
    return false;
  }

  if (campaign.joinOpenDate && now < new Date(campaign.joinOpenDate)) {
    return false;
  }

  if (campaign.endDate && now >= new Date(campaign.endDate)) {
    return false;
  }

  return true;
}

export default function MyCampaignPage() {
  const user = useAuthStore((state) => state.user);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyCampaignId, setBusyCampaignId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function loadCampaigns() {
    setLoading(true);
    setError('');

    try {
      const response = await fetchCampaigns({ page: 1, limit: 100, includeFuture: true });
      setCampaigns(response.items);
    } catch {
      setError('Failed to load campaigns.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCampaigns();
  }, []);

  const sortedCampaigns = useMemo(
    () => [...campaigns].sort((a, b) => {
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      return bTime - aTime;
    }),
    [campaigns],
  );

  async function handleJoin(campaign: Campaign) {
    setBusyCampaignId(campaign._id);
    setError('');
    setSuccess('');

    try {
      const response = await joinCampaign(campaign._id);
      const updatedCampaign = response.campaign;
      if (updatedCampaign) {
        setCampaigns((current) => current.map((item) => (
          item._id === campaign._id ? updatedCampaign : item
        )));
      } else {
        await loadCampaigns();
      }
      setSuccess(response.message ?? 'Campaign enrollment updated.');
    } catch (joinError: unknown) {
      const backendMessage = typeof joinError === 'object'
        && joinError !== null
        && 'response' in joinError
        && typeof (joinError as { response?: unknown }).response === 'object'
        && (joinError as { response?: { data?: { message?: unknown } } }).response?.data
        ? (joinError as { response?: { data?: { message?: unknown } } }).response?.data?.message
        : undefined;
      if (Array.isArray(backendMessage)) {
        setError(backendMessage.join(', '));
      } else if (typeof backendMessage === 'string' && backendMessage.trim()) {
        setError(backendMessage);
      } else {
        setError('Unable to join this campaign.');
      }
    } finally {
      setBusyCampaignId(null);
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">My Campaign</h1>
          <p className="mt-1 text-sm text-slate-600">
            View campaigns from admins and users, and apply or enroll when seats are open.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadCampaigns()}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          <FiRefreshCw size={16} />
          Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Loading campaigns...
        </div>
      ) : sortedCampaigns.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          No campaigns found.
        </div>
      ) : (
        <div className="grid gap-4">
          {sortedCampaigns.map((campaign) => {
            const accepted = getAcceptedParticipantsCount(campaign);
            const maxParticipants = Math.max(1, Number(campaign.maxParticipants ?? 1));
            const availableSeats = Math.max(0, maxParticipants - accepted);
            const campaignOpen = isCampaignOpenForJoin(campaign);
            const currentStatus = getParticipantStatus(campaign, user?.id);
            const isHost = campaign.hostId && user?.id && String(campaign.hostId) === String(user.id);
            const canJoin = !isHost && campaignOpen && availableSeats > 0 && !currentStatus;
            const joinLabel = campaign.joinMode === 'request' ? 'Apply' : 'Enroll';

            let actionLabel = joinLabel;
            if (isHost) {
              actionLabel = 'Host';
            } else if (currentStatus === 'accepted') {
              actionLabel = 'Enrolled';
            } else if (currentStatus === 'pending') {
              actionLabel = 'Requested';
            } else if (!campaignOpen) {
              actionLabel = 'Closed';
            } else if (availableSeats <= 0) {
              actionLabel = 'Full';
            }

            return (
              <article key={campaign._id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">{campaign.title}</h2>
                    <p className="mt-1 text-sm text-slate-600">{campaign.location || 'Location not set'}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-slate-100 px-2 py-1 font-medium text-slate-700">
                      {campaign.scheduleType === 'instant' ? 'Instant' : 'Scheduled'}
                    </span>
                    <span className="rounded-full bg-blue-50 px-2 py-1 font-medium capitalize text-blue-700">
                      {campaign.joinMode || 'open'}
                    </span>
                    <span className="rounded-full bg-emerald-50 px-2 py-1 font-medium text-emerald-700">
                      {availableSeats} seats left
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
                  <div className="flex flex-wrap gap-4">
                    <span>Host: <span className="font-medium text-slate-900">{campaign.creator?.name || 'Unknown'}</span></span>
                    <span>Role: <span className="font-medium capitalize text-slate-900">{campaign.creator?.role || 'user'}</span></span>
                    <span>Participants: <span className="font-medium text-slate-900">{accepted}/{maxParticipants}</span></span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleJoin(campaign)}
                    disabled={!canJoin || busyCampaignId === campaign._id}
                    className="inline-flex min-w-28 items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {busyCampaignId === campaign._id ? 'Please wait...' : actionLabel}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
