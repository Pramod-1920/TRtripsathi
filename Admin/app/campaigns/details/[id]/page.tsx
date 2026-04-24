'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { FiArrowLeft, FiCopy, FiEdit2, FiSave, FiTrash2, FiX } from 'react-icons/fi';
import {
  Campaign,
  CampaignPayload,
  formatDateTimeLocal,
  JoinMode,
  deleteCampaign,
  fetchCampaignById,
  toDateTimeLocalValue,
  toIsoFromDateInput,
  updateCampaign,
} from '@/lib/campaigns';
import { ExtraItem, fetchExtras } from '@/lib/extras';
import { ConfirmModal } from '@/components/ui/confirm-modal';

type CampaignPhotoInput = {
  url: string;
  publicId: string;
  caption: string;
};

type CampaignFormState = {
  title: string;
  description: string;
  location: string;
  difficulty: string;
  durationDays: string;
  maxParticipants: string;
  estimatedNPR: string;
  startDate: string;
  joinOpenDate: string;
  joinMode: JoinMode;
  photos: CampaignPhotoInput[];
};

const defaultFormState: CampaignFormState = {
  title: '',
  description: '',
  location: '',
  difficulty: '',
  durationDays: '1',
  maxParticipants: '10',
  estimatedNPR: '0',
  startDate: '',
  joinOpenDate: '',
  joinMode: 'open',
  photos: [{ url: '', publicId: '', caption: '' }],
};

function toFormState(campaign: Campaign): CampaignFormState {
  return {
    title: campaign.title ?? '',
    description: campaign.description ?? '',
    location: campaign.location ?? '',
    difficulty: campaign.difficulty ?? '',
    durationDays: String(campaign.durationDays ?? 1),
    maxParticipants: String(campaign.maxParticipants ?? 10),
    estimatedNPR: String(campaign.estimatedNPR ?? 0),
    startDate: toDateTimeLocalValue(campaign.startDate),
    joinOpenDate: toDateTimeLocalValue(campaign.joinOpenDate),
    joinMode: campaign.joinMode ?? 'open',
    photos:
      campaign.photos && campaign.photos.length > 0
        ? campaign.photos.map((photo) => ({
            url: photo.url,
            publicId: photo.publicId ?? '',
            caption: photo.caption ?? '',
          }))
        : [{ url: '', publicId: '', caption: '' }],
  };
}

export default function CampaignDetailsByIdPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const campaignId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [form, setForm] = useState<CampaignFormState>(defaultFormState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [difficultyOptions, setDifficultyOptions] = useState<ExtraItem[]>([]);
  const [difficultyLoading, setDifficultyLoading] = useState(true);
  const campaignCode = campaign?.campaignCode || campaign?._id || 'N/A';

  useEffect(() => {
    setIsEditing(searchParams.get('mode') === 'edit');
  }, [searchParams]);

  useEffect(() => {
    let active = true;

    async function loadCampaign() {
      if (!campaignId) {
        return;
      }

      setLoading(true);
      setError('');

      try {
        const item = await fetchCampaignById(campaignId);

        if (!active) {
          return;
        }

        setCampaign(item);
        setForm(toFormState(item));
      } catch {
        if (active) {
          setError('Unable to load campaign details from backend.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadCampaign();

    return () => {
      active = false;
    };
  }, [campaignId]);

  useEffect(() => {
    let active = true;

    async function loadDifficultyOptions() {
      setDifficultyLoading(true);

      try {
        const response = await fetchExtras('difficulty', { page: 1, limit: 100 });

        if (!active) {
          return;
        }

        setDifficultyOptions(response.items.filter((item) => item.enabled !== false));
      } catch {
        if (active) {
          setDifficultyOptions([]);
        }
      } finally {
        if (active) {
          setDifficultyLoading(false);
        }
      }
    }

    void loadDifficultyOptions();

    return () => {
      active = false;
    };
  }, []);

  const readonly = useMemo(() => !isEditing, [isEditing]);

  const difficultyOptionNames = useMemo(() => {
    const sortedByCreatedAt = [...difficultyOptions].sort((first, second) => {
      const firstTime = first.createdAt ? new Date(first.createdAt).getTime() : Number.MAX_SAFE_INTEGER;
      const secondTime = second.createdAt ? new Date(second.createdAt).getTime() : Number.MAX_SAFE_INTEGER;
      return firstTime - secondTime;
    });

    const values = Array.from(
      new Set(
        sortedByCreatedAt
          .map((item) => item.name?.trim())
          .filter((name): name is string => Boolean(name))
      )
    );

    const currentDifficulty = form.difficulty.trim();
    if (currentDifficulty && !values.includes(currentDifficulty)) {
      values.unshift(currentDifficulty);
    }

    return values;
  }, [difficultyOptions, form.difficulty]);

  function updateField<K extends keyof CampaignFormState>(field: K, value: CampaignFormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updatePhotoField(index: number, field: keyof CampaignPhotoInput, value: string) {
    setForm((current) => ({
      ...current,
      photos: current.photos.map((photo, photoIndex) => {
        if (photoIndex !== index) {
          return photo;
        }

        return {
          ...photo,
          [field]: value,
        };
      }),
    }));
  }

  function addPhotoRow() {
    if (readonly) {
      return;
    }

    setForm((current) => ({
      ...current,
      photos: [...current.photos, { url: '', publicId: '', caption: '' }],
    }));
  }

  function removePhotoRow(index: number) {
    if (readonly) {
      return;
    }

    setForm((current) => {
      if (current.photos.length === 1) {
        return {
          ...current,
          photos: [{ url: '', publicId: '', caption: '' }],
        };
      }

      return {
        ...current,
        photos: current.photos.filter((_, photoIndex) => photoIndex !== index),
      };
    });
  }

  async function handleSave() {
    if (!campaignId || !campaign) {
      return;
    }

    setError('');
    setSuccess('');

    if (!form.title.trim()) {
      setError('Title is required.');
      return;
    }

    const durationDays = Number(form.durationDays);
    const maxParticipants = Number(form.maxParticipants);
    const estimatedNPR = Number(form.estimatedNPR);
    const now = new Date();
    const minStartDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    const selectedStartDate = form.startDate ? new Date(form.startDate) : null;
    const selectedJoinOpenDate = form.joinOpenDate
      ? new Date(form.joinOpenDate)
      : null;

    if (!Number.isFinite(durationDays) || durationDays < 1) {
      setError('Duration must be a number greater than or equal to 1.');
      return;
    }

    if (!Number.isFinite(maxParticipants) || maxParticipants < 1) {
      setError('Max participants must be a number greater than or equal to 1.');
      return;
    }

    if (!Number.isFinite(estimatedNPR) || estimatedNPR < 0) {
      setError('Estimated budget must be 0 or a positive number.');
      return;
    }

    if (selectedStartDate && selectedStartDate < minStartDate) {
      setError('Start date/time must be at least 2 days from now.');
      return;
    }

    if (selectedJoinOpenDate && selectedJoinOpenDate < now) {
      setError('Join open date/time must be now or later.');
      return;
    }

    if (selectedStartDate && selectedJoinOpenDate && selectedJoinOpenDate > selectedStartDate) {
      setError('Join open date/time must be before or equal to start date/time.');
      return;
    }

    const photos = form.photos
      .filter((photo) => photo.url.trim().length > 0)
      .map((photo) => ({
        url: photo.url.trim(),
        ...(photo.publicId.trim() ? { publicId: photo.publicId.trim() } : {}),
        ...(photo.caption.trim() ? { caption: photo.caption.trim() } : {}),
      }));

    const payload: CampaignPayload = {
      title: form.title.trim(),
      ...(form.description.trim() ? { description: form.description.trim() } : {}),
      ...(form.location.trim() ? { location: form.location.trim() } : {}),
      ...(form.difficulty.trim() ? { difficulty: form.difficulty.trim() } : {}),
      durationDays,
      maxParticipants,
      estimatedNPR,
      ...(form.startDate ? { startDate: toIsoFromDateInput(form.startDate) } : {}),
      ...(form.joinOpenDate ? { joinOpenDate: toIsoFromDateInput(form.joinOpenDate) } : {}),
      joinMode: form.joinMode,
      ...(photos.length > 0 ? { photos } : {}),
    };

    setSaving(true);

    try {
      const updated = await updateCampaign(campaignId, payload);
      setCampaign(updated);
      setForm(toFormState(updated));
      setIsEditing(false);
      setSuccess('Campaign updated successfully.');
    } catch {
      setError('Unable to update campaign.');
    } finally {
      setSaving(false);
    }
  }

  function openDeleteModal() {
    setDeleteReason('');
    setDeleteModalOpen(true);
  }

  function closeDeleteModal() {
    if (deleting) {
      return;
    }

    setDeleteModalOpen(false);
    setDeleteReason('');
  }

  async function confirmDelete() {
    if (!campaignId) {
      return;
    }

    setError('');
    setSuccess('');
    setDeleting(true);

    try {
      await deleteCampaign(campaignId, deleteReason);
      closeDeleteModal();
      window.location.href = '/campaigns/details';
    } catch {
      setError('Unable to delete campaign.');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
          Loading campaign details...
        </div>
      </div>
    );
  }

  const minimumJoinOpenDateTime = formatDateTimeLocal(new Date());
  const minimumStartDateTime = formatDateTimeLocal(
    new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
  );

  if (error && !campaign) {
    return (
      <div className="p-8 space-y-4">
        <Link href="/campaigns/details" className="inline-flex items-center gap-2 text-sm text-blue-700 hover:text-blue-800">
          <FiArrowLeft size={14} />
          Back to Campaign Details
        </Link>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1 min-w-0">
          <Link href="/campaigns/details" className="inline-flex items-center gap-2 text-sm text-blue-700 hover:text-blue-800">
            <FiArrowLeft size={14} />
            Back to Campaign Details
          </Link>
          <h1 className="text-3xl font-bold text-slate-900">Campaign View</h1>
          <p className="text-sm text-slate-600">View and edit a campaign connected to backend.</p>
          <p className="text-sm text-slate-500">
            System ID: <span className="font-semibold text-slate-700">{campaignCode}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {!isEditing && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-white hover:bg-amber-600"
            >
              <FiEdit2 size={16} />
              Edit
            </button>
          )}

          {isEditing && (
            <button
              type="button"
              onClick={() => {
                if (campaign) {
                  setForm(toFormState(campaign));
                }
                setIsEditing(false);
                setError('');
              }}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
            >
              <FiX size={16} />
              Cancel
            </button>
          )}

          {isEditing && (
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
            >
              <FiSave size={16} />
              {saving ? 'Saving...' : 'Save'}
            </button>
          )}

          <button
            type="button"
            onClick={openDeleteModal}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
          >
            <FiTrash2 size={16} />
            Delete
          </button>
        </div>
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

      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-6">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h2 className="text-sm font-semibold text-slate-900">Campaign Creator</h2>
          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3 text-sm text-slate-700">
            <p>
              Name: <span className="font-medium">{campaign?.creator?.name || 'N/A'}</span>
            </p>
            <p>
              Role:{' '}
              <span className="font-medium capitalize">{campaign?.creator?.role || 'N/A'}</span>
            </p>
            <p>
              Phone: <span className="font-medium">{campaign?.creator?.phoneNumber || 'N/A'}</span>
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-slate-700">
              Campaign ID: <span className="font-semibold">{campaignCode}</span>
            </p>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(campaignCode);
                setSuccess(`Copied ${campaignCode}`);
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              <FiCopy size={14} />
              Copy ID
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-900">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(event) => updateField('title', event.target.value)}
              readOnly={readonly}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 read-only:bg-slate-50"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-900">Description</label>
            <textarea
              value={form.description}
              onChange={(event) => updateField('description', event.target.value)}
              readOnly={readonly}
              rows={4}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 read-only:bg-slate-50"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-900">Location</label>
            <input
              type="text"
              value={form.location}
              onChange={(event) => updateField('location', event.target.value)}
              readOnly={readonly}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 read-only:bg-slate-50"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-900">Difficulty</label>
            <select
              value={form.difficulty}
              onChange={(event) => updateField('difficulty', event.target.value)}
              disabled={readonly || difficultyLoading}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
            >
              <option value="">
                {difficultyLoading ? 'Loading difficulty options...' : 'Select difficulty'}
              </option>
              {difficultyOptionNames.map((difficultyName) => (
                <option key={difficultyName} value={difficultyName}>
                  {difficultyName}
                </option>
              ))}
            </select>
            {!difficultyLoading && difficultyOptionNames.length === 0 && (
              <p className="mt-1 text-xs text-amber-700">
                No enabled difficulty options found in Extra category.
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-900">Duration (days)</label>
            <input
              type="number"
              min={1}
              value={form.durationDays}
              onChange={(event) => updateField('durationDays', event.target.value)}
              readOnly={readonly}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 read-only:bg-slate-50"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-900">Max participants</label>
            <input
              type="number"
              min={1}
              value={form.maxParticipants}
              onChange={(event) => updateField('maxParticipants', event.target.value)}
              readOnly={readonly}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 read-only:bg-slate-50"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-900">Estimated NPR</label>
            <input
              type="number"
              min={0}
              value={form.estimatedNPR}
              onChange={(event) => updateField('estimatedNPR', event.target.value)}
              readOnly={readonly}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 read-only:bg-slate-50"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-900">Join mode</label>
            <select
              value={form.joinMode}
              onChange={(event) => updateField('joinMode', event.target.value as JoinMode)}
              disabled={readonly}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
            >
              <option value="open">Open</option>
              <option value="request">Request</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-900">Start date</label>
            <input
              type="datetime-local"
              value={form.startDate}
              onChange={(event) => updateField('startDate', event.target.value)}
              readOnly={readonly}
              min={minimumStartDateTime}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 read-only:bg-slate-50"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-900">Join open date</label>
            <input
              type="datetime-local"
              value={form.joinOpenDate}
              onChange={(event) => updateField('joinOpenDate', event.target.value)}
              readOnly={readonly}
              min={minimumJoinOpenDateTime}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 read-only:bg-slate-50"
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Photos</h3>
            {!readonly && (
              <button
                type="button"
                onClick={addPhotoRow}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                Add Photo
              </button>
            )}
          </div>

          {form.photos.map((photo, index) => (
            <div key={`photo-${index}`} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 p-3 md:grid-cols-12">
              <input
                type="url"
                value={photo.url}
                onChange={(event) => updatePhotoField(index, 'url', event.target.value)}
                readOnly={readonly}
                className="md:col-span-6 rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 read-only:bg-slate-50"
              />
              <input
                type="text"
                value={photo.publicId}
                onChange={(event) => updatePhotoField(index, 'publicId', event.target.value)}
                readOnly={readonly}
                className="md:col-span-3 rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 read-only:bg-slate-50"
              />
              <input
                type="text"
                value={photo.caption}
                onChange={(event) => updatePhotoField(index, 'caption', event.target.value)}
                readOnly={readonly}
                className="md:col-span-2 rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 read-only:bg-slate-50"
              />
              {!readonly && (
                <button
                  type="button"
                  onClick={() => removePhotoRow(index)}
                  className="md:col-span-1 inline-flex items-center justify-center rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
                  title="Remove photo row"
                >
                  <FiTrash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <ConfirmModal
        open={deleteModalOpen}
        title="Delete Campaign"
        description={campaign ? `You are deleting \"${campaign.title}\". This action cannot be undone.` : 'This action cannot be undone.'}
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
