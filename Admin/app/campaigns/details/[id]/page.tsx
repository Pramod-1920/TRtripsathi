'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { FiArrowLeft, FiCheck, FiCopy, FiEdit2, FiSave, FiSend, FiTrash2, FiX } from 'react-icons/fi';
import {
  Campaign,
  CampaignApprovalStatus,
  CampaignPayload,
  CampaignScheduleType,
  approveCampaign,
  formatDateTimeLocal,
  JoinMode,
  deleteCampaign,
  fetchCampaignById,
  rejectCampaign,
  restoreCampaign,
  submitCampaign,
  toDateTimeLocalValue,
  toIsoFromDateInput,
  updateCampaign,
} from '@/lib/campaigns';
import { ExtraItem, fetchExtras, fetchPlaceCatalog, PlaceCatalogItem } from '@/lib/extras';
import { useAuthStore } from '@/lib/auth-store';
import { apiClient } from '@/lib/api';
import { ConfirmModal } from '@/components/ui/confirm-modal';

type CampaignPhotoInput = {
  url: string;
  publicId: string;
  caption: string;
};

type CampaignFormState = {
  title: string;
  description: string;
  category: string;
  subcategory: string;
  hikeType: 'solo' | 'group' | '';
  province: string;
  district: string;
  placeName: string;
  difficulty: string;
  durationDays: string;
  maxParticipants: string;
  estimatedNPR: string;
  scheduleType: CampaignScheduleType;
  startDate: string;
  endDate: string;
  joinMode: JoinMode;
  photos: CampaignPhotoInput[];
};

const defaultFormState: CampaignFormState = {
  title: '',
  description: '',
  category: '',
  subcategory: '',
  hikeType: '',
  province: '',
  district: '',
  placeName: '',
  difficulty: '',
  durationDays: '1',
  maxParticipants: '10',
  estimatedNPR: '0',
  scheduleType: 'scheduled',
  startDate: '',
  endDate: '',
  joinMode: 'open',
  photos: [{ url: '', publicId: '', caption: '' }],
};

function toFormState(campaign: Campaign): CampaignFormState {
  return {
    title: campaign.title ?? '',
    description: campaign.description ?? '',
    category: campaign.category ?? '',
    subcategory: campaign.subcategory ?? '',
    hikeType: campaign.hikeType ?? '',
    province: campaign.province ?? '',
    district: campaign.district ?? '',
    placeName: campaign.placeName ?? '',
    difficulty: campaign.difficulty ?? '',
    durationDays: String(campaign.durationDays ?? 1),
    maxParticipants: String(campaign.maxParticipants ?? 10),
    estimatedNPR: String(campaign.estimatedNPR ?? 0),
    scheduleType: campaign.scheduleType ?? 'scheduled',
    startDate: toDateTimeLocalValue(campaign.startDate),
    endDate: toDateTimeLocalValue(campaign.endDate),
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

function getApprovalBadgeClass(status?: CampaignApprovalStatus) {
  switch (status) {
    case 'approved':
      return 'bg-emerald-50 text-emerald-700';
    case 'submitted':
      return 'bg-amber-50 text-amber-700';
    case 'rejected':
      return 'bg-red-50 text-red-700';
    case 'draft':
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

function formatTimelineDate(value?: string | null) {
  if (!value) {
    return 'N/A';
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'N/A' : parsed.toLocaleString();
}

function buildTimeline(campaign: Campaign) {
  const hostName = campaign.creator?.name || 'Host';
  const events = [
    {
      label: 'Created',
      timestamp: campaign.createdAt,
      actor: hostName,
      tone: 'bg-blue-600',
    },
    {
      label: 'Submitted for approval',
      timestamp: campaign.submittedAt,
      actor: hostName,
      tone: 'bg-amber-500',
    },
    {
      label: campaign.approvalStatus === 'rejected' ? 'Rejected' : 'Approved',
      timestamp: campaign.approvalStatus === 'rejected' ? campaign.rejectedAt : campaign.approvedAt,
      actor: campaign.approvalStatus === 'rejected'
        ? (campaign.rejectedBy ? 'Admin' : 'System')
        : (campaign.approvedBy ? 'Admin' : 'System'),
      tone: campaign.approvalStatus === 'rejected' ? 'bg-red-600' : 'bg-emerald-600',
    },
    {
      label: 'Started',
      timestamp: campaign.startDate,
      actor: 'Schedule',
      tone: 'bg-cyan-600',
    },
    {
      label: 'Ended',
      timestamp: campaign.endDate,
      actor: 'Schedule',
      tone: 'bg-slate-600',
    },
    {
      label: campaign.hostVerified ? 'Verification completed' : 'Verification requested',
      timestamp: campaign.verifiedAt ?? campaign.verificationDeadline,
      actor: campaign.hostVerified ? hostName : 'System',
      tone: campaign.hostVerified ? 'bg-emerald-600' : 'bg-violet-600',
    },
    {
      label: 'Failed',
      timestamp: campaign.failedAt,
      actor: 'System',
      tone: 'bg-red-700',
    },
  ];

  return events.filter((event) => Boolean(event.timestamp));
}

export default function CampaignDetailsByIdPage() {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'admin';
  const params = useParams();
  const searchParams = useSearchParams();
  const campaignId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [form, setForm] = useState<CampaignFormState>(defaultFormState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isEditing, setIsEditing] = useState(searchParams.get('mode') === 'edit');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [difficultyOptions, setDifficultyOptions] = useState<ExtraItem[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<ExtraItem[]>([]);
  const [placeCatalog, setPlaceCatalog] = useState<PlaceCatalogItem[]>([]);
  const [difficultyLoading, setDifficultyLoading] = useState(true);
  const [categoryLoading, setCategoryLoading] = useState(true);
  const [placeLoading, setPlaceLoading] = useState(true);
  const campaignCode = campaign?.campaignCode || campaign?._id || 'N/A';

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

  useEffect(() => {
    let active = true;

    async function loadPlaceCatalog() {
      setPlaceLoading(true);

      try {
        const response = await fetchPlaceCatalog();

        if (!active) {
          return;
        }

        setPlaceCatalog(response.items ?? []);
      } catch {
        if (active) {
          setPlaceCatalog([]);
        }
      } finally {
        if (active) {
          setPlaceLoading(false);
        }
      }
    }

    void loadPlaceCatalog();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadCategoryOptions() {
      setCategoryLoading(true);

      try {
        const response = await fetchExtras('activities', { page: 1, limit: 100 });

        if (!active) {
          return;
        }

        setCategoryOptions(response.items.filter((item) => item.enabled !== false));
      } catch {
        if (active) {
          setCategoryOptions([]);
        }
      } finally {
        if (active) {
          setCategoryLoading(false);
        }
      }
    }

    void loadCategoryOptions();

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

  const categoryOptionNames = useMemo(() => {
    const sortedByCreatedAt = categoryOptions.filter((item) => !item.parentId).sort((first, second) => {
      const firstTime = first.createdAt ? new Date(first.createdAt).getTime() : Number.MAX_SAFE_INTEGER;
      const secondTime = second.createdAt ? new Date(second.createdAt).getTime() : Number.MAX_SAFE_INTEGER;
      return firstTime - secondTime;
    });

    return Array.from(
      new Set(
        sortedByCreatedAt
          .map((item) => item.name?.trim())
          .filter((name): name is string => Boolean(name))
      )
    );
  }, [categoryOptions]);

  const selectedCategoryOption = useMemo(
    () => categoryOptions.find(
      (item) => !item.parentId && item.name.trim() === form.category.trim(),
    ),
    [categoryOptions, form.category],
  );

  const subcategoryOptionNames = useMemo(() => {
    const names = selectedCategoryOption
      ? categoryOptions
        .filter((item) => item.parentId === selectedCategoryOption._id)
        .map((item) => item.name.trim())
        .filter(Boolean)
      : [];

    if (form.subcategory.trim() && !names.includes(form.subcategory.trim())) {
      names.push(form.subcategory.trim());
    }

    return names;
  }, [categoryOptions, form.subcategory, selectedCategoryOption]);

  const displayLocation = useMemo(() => {
    const parts = [form.province.trim(), form.district.trim(), form.placeName.trim()]
      .filter((part) => part.length > 0);
    return parts.join(', ');
  }, [form.province, form.district, form.placeName]);

  const provinceOptions = useMemo(() => {
    const values = placeCatalog.map((item) => item.province).filter(Boolean);
    const current = form.province.trim();

    if (current && !values.includes(current)) {
      values.unshift(current);
    }

    return values;
  }, [form.province, placeCatalog]);

  const districtOptions = useMemo(() => {
    if (!form.province) {
      return [];
    }

    const found = placeCatalog.find((item) => item.province === form.province);
    const values = found?.districts ? [...found.districts] : [];
    const currentDistrict = form.district.trim();

    if (currentDistrict && !values.includes(currentDistrict)) {
      values.unshift(currentDistrict);
    }

    return values;
  }, [form.province, placeCatalog]);

  const placeNameOptions = useMemo(() => {
    if (!form.province || !form.district) {
      return [];
    }

    const foundProvince = placeCatalog.find((item) => item.province === form.province);
    const districtNode = (foundProvince?.districtItems ?? [])
      .find((item) => item.district === form.district);
    const values = districtNode?.places ? [...districtNode.places] : [];
    const currentPlace = form.placeName.trim();

    if (currentPlace && !values.includes(currentPlace)) {
      values.unshift(currentPlace);
    }

    return values;
  }, [form.district, form.placeName, form.province, placeCatalog]);

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

  function handlePhotoFileSelect(index: number, event: React.ChangeEvent<HTMLInputElement>) {
    if (readonly) return;
    const file = event.target.files?.[0];
    if (!file) return;
    (async () => {
      try {
        const sig = await apiClient.post('/cloudinary/signature', { folder: 'campaigns' });
        const { cloudName, apiKey, timestamp, signature, folder } = sig.data;
        const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;
        const fd = new FormData();
        fd.append('file', file);
        fd.append('api_key', apiKey);
        fd.append('timestamp', String(timestamp));
        fd.append('signature', signature);
        if (folder) fd.append('folder', folder);

        const res = await fetch(uploadUrl, { method: 'POST', body: fd });
        if (!res.ok) throw new Error('Upload failed');
        const data = await res.json();

        updatePhotoField(index, 'url', data.secure_url ?? data.url ?? '');
        updatePhotoField(index, 'publicId', data.public_id ?? '');
      } catch {
        setError('Image upload failed.');
      }
    })();
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

    if (!form.category.trim()) {
      setError('Category is required.');
      return;
    }

    if (!form.hikeType) {
      setError('Type is required.');
      return;
    }

    const durationDays = Number(form.durationDays);
    const maxParticipants = Number(form.maxParticipants);
    const estimatedNPR = Number(form.estimatedNPR);
    const now = new Date();
    const selectedStartDate = form.startDate ? new Date(form.startDate) : null;
    const selectedEndDate = form.endDate ? new Date(form.endDate) : null;

    if (!Number.isFinite(durationDays) || durationDays < 1) {
      setError('Duration must be a number greater than or equal to 1.');
      return;
    }

    if (form.hikeType !== 'solo') {
      if (!Number.isFinite(maxParticipants) || maxParticipants < 1) {
        setError('Max participants must be a number greater than or equal to 1.');
        return;
      }
    }

    if (!Number.isFinite(estimatedNPR) || estimatedNPR < 0) {
      setError('Estimated budget must be 0 or a positive number.');
      return;
    }

    if (form.scheduleType === 'scheduled' && !selectedStartDate) {
      setError('Start date/time is required for scheduled campaigns.');
      return;
    }

    const computedStartDate = form.scheduleType === 'instant'
      ? now
      : selectedStartDate;

    if (!computedStartDate) {
      setError('Unable to resolve campaign start date/time.');
      return;
    }

    if (selectedEndDate && selectedEndDate <= computedStartDate) {
      setError('End date/time must be later than the start date/time.');
      return;
    }

    const photos = form.photos
      .filter((photo) => String(photo.url).trim().length > 0)
      .map((photo) => ({
        url: String(photo.url).trim(),
        ...(String(photo.publicId).trim() ? { publicId: String(photo.publicId).trim() } : {}),
        ...(String(photo.caption).trim() ? { caption: String(photo.caption).trim() } : {}),
      }));

    const payload: CampaignPayload = {
      title: form.title.trim(),
      ...(form.description.trim() ? { description: form.description.trim() } : {}),
      category: form.category.trim(),
      subcategory: form.subcategory.trim(),
      hikeType: form.hikeType,
      ...(form.province.trim() ? { province: form.province.trim() } : {}),
      ...(form.district.trim() ? { district: form.district.trim() } : {}),
      ...(form.placeName.trim() ? { placeName: form.placeName.trim() } : {}),
      ...(displayLocation ? { location: displayLocation } : {}),
      ...(form.difficulty.trim() ? { difficulty: form.difficulty.trim() } : {}),
      durationDays,
      ...(form.hikeType !== 'solo' ? { maxParticipants } : {}),
      estimatedNPR,
      scheduleType: form.scheduleType,
      startDate: computedStartDate.toISOString(),
      joinOpenDate: computedStartDate.toISOString(),
      ...(form.endDate ? { endDate: toIsoFromDateInput(form.endDate) } : {}),
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
      window.location.replace('/campaigns/details');
    } catch {
      setError('Unable to delete campaign.');
    } finally {
      setDeleting(false);
    }
  }

  async function handleRestore() {
    if (!campaignId) {
      return;
    }

    setError('');
    setSuccess('');
    setRestoring(true);

    try {
      const restored = await restoreCampaign(campaignId);
      setCampaign(restored);
      setForm(toFormState(restored));
      setSuccess('Campaign restored successfully.');
    } catch {
      setError('Unable to restore campaign.');
    } finally {
      setRestoring(false);
    }
  }

  async function handleSubmitForReview() {
    if (!campaignId) {
      return;
    }

    setError('');
    setSuccess('');
    setReviewing(true);

    try {
      const updated = await submitCampaign(campaignId);
      setCampaign(updated);
      setForm(toFormState(updated));
      setSuccess('Campaign submitted for admin review.');
    } catch {
      setError('Unable to submit campaign for review.');
    } finally {
      setReviewing(false);
    }
  }

  async function handleApprove() {
    if (!campaignId) {
      return;
    }

    setError('');
    setSuccess('');
    setReviewing(true);

    try {
      const updated = await approveCampaign(campaignId);
      setCampaign(updated);
      setForm(toFormState(updated));
      setSuccess('Campaign approved successfully.');
    } catch {
      setError('Unable to approve campaign.');
    } finally {
      setReviewing(false);
    }
  }

  async function handleReject() {
    if (!campaignId) {
      return;
    }

    const reason = window.prompt('Enter reject reason');
    if (!reason || !reason.trim()) {
      return;
    }

    setError('');
    setSuccess('');
    setReviewing(true);

    try {
      const updated = await rejectCampaign(campaignId, reason.trim());
      setCampaign(updated);
      setForm(toFormState(updated));
      setSuccess('Campaign rejected successfully.');
    } catch {
      setError('Unable to reject campaign.');
    } finally {
      setReviewing(false);
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

  const minimumStartDateTime = formatDateTimeLocal(new Date());
  const minimumEndDateTime = form.scheduleType === 'scheduled' && form.startDate
    ? form.startDate
    : minimumStartDateTime;
  const timelineEvents = campaign ? buildTimeline(campaign) : [];

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
            Approval status:{' '}
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${getApprovalBadgeClass(campaign?.approvalStatus)}`}>
              {campaign?.approvalStatus ?? 'draft'}
            </span>
          </p>
          <p className="text-sm text-slate-500">
            System ID: <span className="font-semibold text-slate-700">{campaignCode}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {(campaign?.approvalStatus === 'draft' || campaign?.approvalStatus === 'rejected') && (
            <button
              type="button"
              onClick={() => void handleSubmitForReview()}
              disabled={reviewing || saving}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-white hover:bg-slate-900 disabled:opacity-60"
            >
              <FiSend size={16} />
              {reviewing ? 'Submitting...' : 'Submit for Review'}
            </button>
          )}

          {isAdmin && campaign?.approvalStatus === 'submitted' && (
            <button
              type="button"
              onClick={() => void handleApprove()}
              disabled={reviewing || saving}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              <FiCheck size={16} />
              {reviewing ? 'Processing...' : 'Approve'}
            </button>
          )}

          {isAdmin && campaign?.approvalStatus === 'submitted' && (
            <button
              type="button"
              onClick={() => void handleReject()}
              disabled={reviewing || saving}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-60"
            >
              <FiX size={16} />
              {reviewing ? 'Processing...' : 'Reject'}
            </button>
          )}

          {isAdmin && campaign?.deletedByAdmin && (
            <button
              type="button"
              onClick={() => void handleRestore()}
              disabled={restoring || saving}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              <FiCheck size={16} />
              {restoring ? 'Restoring...' : 'Restore'}
            </button>
          )}

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
          <h2 className="text-sm font-semibold text-slate-900">Campaign Timeline</h2>
          {timelineEvents.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">No timeline events are available yet.</p>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
              {timelineEvents.map((event) => (
                <div key={`${event.label}-${event.timestamp}`} className="flex gap-3 rounded-lg border border-slate-200 bg-white p-3">
                  <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${event.tone}`} />
                  <div>
                    <p className="text-sm font-medium text-slate-900">{event.label}</p>
                    <p className="text-xs text-slate-600">{formatTimelineDate(event.timestamp)}</p>
                    <p className="text-xs text-slate-500">By {event.actor}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

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
            <p className="text-sm text-slate-700">
              Approval note: <span className="font-semibold">{campaign?.approvalNote || 'N/A'}</span>
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

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h2 className="text-sm font-semibold text-slate-900">Campaign Metadata</h2>
            <dl className="mt-3 grid grid-cols-1 gap-2 text-sm text-slate-700 md:grid-cols-2">
              <div>
                <dt className="text-xs uppercase text-slate-500">Activity</dt>
                <dd className="font-medium">{campaign?.category || 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-500">Difficulty</dt>
                <dd className="font-medium">{campaign?.difficulty || 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-500">Province</dt>
                <dd className="font-medium">{campaign?.province || 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-500">District</dt>
                <dd className="font-medium">{campaign?.district || 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-500">Spot</dt>
                <dd className="font-medium">{campaign?.placeName || 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-500">Participants</dt>
                <dd className="font-medium">{campaign?.participants?.length ?? 0}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h2 className="text-sm font-semibold text-slate-900">Participants</h2>
            {!campaign?.participants || campaign.participants.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">No participants have joined this campaign.</p>
            ) : (
              <div className="mt-3 max-h-56 overflow-auto overscroll-x-contain rounded-lg border border-slate-200 bg-white">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-slate-50 text-left text-slate-600">
                    <tr>
                      <th className="px-3 py-2 font-medium">User ID</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Verified</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {campaign.participants.map((participant) => (
                      <tr key={participant.userId}>
                        <td className="px-3 py-2 text-slate-700">{participant.userId}</td>
                        <td className="px-3 py-2 capitalize text-slate-700">{participant.status ?? 'pending'}</td>
                        <td className="px-3 py-2 text-slate-700">{participant.verified ? 'Yes' : 'No'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
            <label className="mb-1 block text-sm font-medium text-slate-900">Activity</label>
            <select
              value={form.category}
              onChange={(event) => setForm((current) => ({
                ...current,
                category: event.target.value,
                subcategory: '',
              }))}
              disabled={readonly || categoryLoading}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
            >
              <option value="">
                {categoryLoading ? 'Loading activities...' : 'Select activity'}
              </option>
              {categoryOptionNames.map((categoryName) => (
                <option key={categoryName} value={categoryName}>
                  {categoryName}
                </option>
              ))}
            </select>
            {!categoryLoading && categoryOptionNames.length === 0 && (
              <p className="mt-1 text-xs text-amber-700">
                No enabled activities found. Create them in Extra &gt; Activities first.
              </p>
            )}
          </div>

          {subcategoryOptionNames.length > 0 && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-900">Activity Subcategory</label>
              <select
                value={form.subcategory}
                onChange={(event) => updateField('subcategory', event.target.value)}
                disabled={readonly || categoryLoading}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
              >
                <option value="">General {form.category}</option>
                {subcategoryOptionNames.map((subcategoryName) => (
                  <option key={subcategoryName} value={subcategoryName}>{subcategoryName}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-900">Type</label>
            <select
              value={form.hikeType}
              onChange={(event) => updateField('hikeType', event.target.value as 'solo' | 'group')}
              disabled={readonly}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
            >
              <option value="">Select type</option>
              <option value="solo">Solo</option>
              <option value="group">Group</option>
            </select>
            <p className="mt-1 text-xs text-slate-600">Select whether this campaign is for a solo or group hike.</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-900">Province</label>
            <select
              value={form.province}
              onChange={(event) => {
                updateField('province', event.target.value);
                updateField('district', '');
                updateField('placeName', '');
              }}
              disabled={readonly || placeLoading}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
            >
              <option value="">{placeLoading ? 'Loading provinces...' : 'Select province'}</option>
              {provinceOptions.map((provinceName) => (
                <option key={provinceName} value={provinceName}>
                  {provinceName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-900">District</label>
            <select
              value={form.district}
              onChange={(event) => {
                updateField('district', event.target.value);
                updateField('placeName', '');
              }}
              disabled={readonly || placeLoading || !form.province}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
            >
              <option value="">
                {placeLoading ? 'Loading districts...' : form.province ? 'Select district' : 'Select province first'}
              </option>
              {districtOptions.map((districtName) => (
                <option key={districtName} value={districtName}>
                  {districtName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-900">Place Name</label>
            <select
              value={form.placeName}
              onChange={(event) => updateField('placeName', event.target.value)}
              disabled={readonly || placeLoading || !form.province || !form.district || placeNameOptions.length === 0}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
            >
              <option value="">
                {placeLoading
                  ? 'Loading places...'
                  : !form.province
                    ? 'Select province first'
                    : !form.district
                      ? 'Select district first'
                      : placeNameOptions.length > 0
                        ? 'Select place'
                        : 'No active places in this district'}
              </option>
              {placeNameOptions.map((placeName) => (
                <option key={placeName} value={placeName}>
                  {placeName}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-900">Location Label</label>
            <input
              type="text"
              value={displayLocation || campaign?.location || ''}
              readOnly
              className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-slate-50"
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

          {form.hikeType !== 'solo' && (
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
          )}

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
            <label className="mb-1 block text-sm font-medium text-slate-900">Timing mode</label>
            <select
              value={form.scheduleType}
              onChange={(event) => updateField('scheduleType', event.target.value as CampaignScheduleType)}
              disabled={readonly}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
            >
              <option value="instant">Instant (start now)</option>
              <option value="scheduled">Scheduled (pick start time)</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-900">Start date/time</label>
            <input
              type="datetime-local"
              value={form.startDate}
              onChange={(event) => updateField('startDate', event.target.value)}
              readOnly={readonly || form.scheduleType === 'instant'}
              min={minimumStartDateTime}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 read-only:bg-slate-50"
            />
            {form.scheduleType === 'instant' && (
              <p className="mt-1 text-xs text-slate-600">Instant campaigns automatically start at current time.</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-900">End date/time (optional)</label>
            <input
              type="datetime-local"
              value={form.endDate}
              onChange={(event) => updateField('endDate', event.target.value)}
              readOnly={readonly || form.scheduleType === 'instant'}
              min={minimumEndDateTime}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 read-only:bg-slate-50"
            />
            {form.scheduleType === 'instant' && (
              <p className="mt-1 text-xs text-slate-600">
                Instant campaigns auto-close 12 hours after start.
              </p>
            )}
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
              <div className="md:col-span-6">
                <label className="sr-only">Photo file</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => handlePhotoFileSelect(index, event)}
                  disabled={readonly}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {photo.url && (
                  <img src={photo.url} alt={`photo-${index}`} className="mt-2 max-h-32 w-auto rounded-md object-cover" />
                )}
              </div>
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
