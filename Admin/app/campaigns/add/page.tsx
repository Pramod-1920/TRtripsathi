'use client';

import { useEffect, useMemo, useState } from 'react';
import { FiCalendar, FiCompass, FiMapPin, FiPlus, FiTrash2, FiUsers } from 'react-icons/fi';
import {
  CampaignPayload,
  CampaignScheduleType,
  formatDateTimeLocal,
  JoinMode,
  createCampaign,
  submitCampaign,
} from '@/lib/campaigns';
import { ExtraItem, fetchExtras, fetchPlaceCatalog, PlaceCatalogItem } from '@/lib/extras';
import { apiClient } from '@/lib/api';

const INSTANT_CAMPAIGN_DURATION_HOURS = 12;

type CampaignPhotoInput = {
  url: string;
  publicId: string;
  caption: string;
};

type CampaignFormState = {
  title: string;
  description: string;
  category: string;
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
  hikeType: '',
  province: '',
  district: '',
  placeName: '',
  difficulty: '',
  durationDays: '1',
  maxParticipants: '10',
  estimatedNPR: '0',
  scheduleType: 'instant',
  startDate: '',
  endDate: '',
  joinMode: 'open',
  photos: [{ url: '', publicId: '', caption: '' }],
};

export default function AddCampaignPage() {
  const [form, setForm] = useState<CampaignFormState>(defaultFormState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [difficultyOptions, setDifficultyOptions] = useState<ExtraItem[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<ExtraItem[]>([]);
  const [placeCatalog, setPlaceCatalog] = useState<PlaceCatalogItem[]>([]);
  const [difficultyLoading, setDifficultyLoading] = useState(true);
  const [categoryLoading, setCategoryLoading] = useState(true);
  const [placeLoading, setPlaceLoading] = useState(true);

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

    void loadDifficultyOptions();
    void loadCategoryOptions();
    void loadPlaceCatalog();

    return () => {
      active = false;
    };
  }, []);

  const uniqueDifficultyNames = useMemo(() => {
    const sortedByCreatedAt = [...difficultyOptions].sort((first, second) => {
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
  }, [difficultyOptions]);

  const uniqueCategoryNames = useMemo(() => {
    const sortedByCreatedAt = [...categoryOptions].sort((first, second) => {
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

  const instantEndDateValue = useMemo(() => {
    const now = new Date();
    const endDate = new Date(now.getTime() + INSTANT_CAMPAIGN_DURATION_HOURS * 60 * 60 * 1000);
    return formatDateTimeLocal(endDate);
  }, [form.scheduleType]);

  useEffect(() => {
    if (form.scheduleType === 'instant') {
      setForm((current) => ({
        ...current,
        startDate: '',
        endDate: instantEndDateValue,
      }));
      return;
    }

    setForm((current) => (
      current.endDate === instantEndDateValue
        ? { ...current, endDate: '' }
        : current
    ));
  }, [form.scheduleType, instantEndDateValue]);

  useEffect(() => {
    if (!form.province || districtOptions.includes(form.district)) {
      return;
    }

    setForm((current) => ({ ...current, district: '' }));
  }, [districtOptions, form.district, form.province]);

  useEffect(() => {
    if (!form.placeName || placeNameOptions.length === 0 || placeNameOptions.includes(form.placeName)) {
      return;
    }

    setForm((current) => ({ ...current, placeName: '' }));
  }, [form.placeName, placeNameOptions]);

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
      } catch (e) {
        setError('Image upload failed.');
      }
    })();
  }

  function addPhotoRow() {
    setForm((current) => ({
      ...current,
      photos: [...current.photos, { url: '', publicId: '', caption: '' }],
    }));
  }

  function removePhotoRow(index: number) {
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

  async function handleCreateCampaign(event: React.FormEvent) {
    event.preventDefault();
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
    const autoCloseEndDate = new Date(now.getTime() + INSTANT_CAMPAIGN_DURATION_HOURS * 60 * 60 * 1000);

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

    const computedEndDate = form.scheduleType === 'instant'
      ? autoCloseEndDate
      : selectedEndDate;

    if (!computedStartDate) {
      setError('Unable to resolve campaign start date/time.');
      return;
    }

    if (computedEndDate && computedEndDate <= computedStartDate) {
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
      ...(computedEndDate ? { endDate: computedEndDate.toISOString() } : {}),
      joinMode: form.joinMode,
      ...(photos.length > 0 ? { photos } : {}),
    };

    setSubmitting(true);

    try {
      const createdCampaign = await createCampaign(payload);
      const requiresSubmission = createdCampaign.approvalStatus === 'draft' || createdCampaign.approvalStatus === 'rejected';

      if (requiresSubmission) {
        await submitCampaign(createdCampaign._id);
      }

      setForm(defaultFormState);
      setSuccess(
        requiresSubmission
          ? `Campaign submitted for admin review. System ID: ${createdCampaign.campaignCode ?? createdCampaign._id}`
          : `Campaign created successfully. System ID: ${createdCampaign.campaignCode ?? createdCampaign._id}`,
      );
    } catch {
      setError('Could not submit campaign. Check form values and session permissions.');
    } finally {
      setSubmitting(false);
    }
  }

  const minimumStartDateTime = formatDateTimeLocal(new Date());
  const minimumEndDateTime = form.scheduleType === 'scheduled' && form.startDate
    ? form.startDate
    : minimumStartDateTime;

  return (
    <div className="relative p-8">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-8 top-6 h-64 w-64 rounded-full bg-cyan-200/40 blur-3xl" />
        <div className="absolute right-10 top-24 h-72 w-72 rounded-full bg-blue-200/50 blur-3xl" />
      </div>

      <div className="space-y-8">
        <header className="rounded-2xl border border-slate-200 bg-linear-to-r from-slate-900 via-blue-900 to-cyan-800 p-8 text-white shadow-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-blue-100">Campaign Management</p>
              <h1 className="mt-2 text-3xl font-bold">Create a New Campaign</h1>
              <p className="mt-2 max-w-2xl text-sm text-blue-100">
                Build a complete campaign record and publish it directly to your backend in one flow.
              </p>
            </div>

            <button
              type="submit"
              form="create-campaign-form"
              disabled={submitting}
              className="inline-flex shrink-0 items-center justify-center rounded-lg bg-white/15 px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/40 transition hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Submitting...' : 'Submit Campaign'}
            </button>
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            {success}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <form id="create-campaign-form" onSubmit={handleCreateCampaign} className="xl:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-lg space-y-6">
            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">Basic Information</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-900">Title *</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(event) => updateField('title', event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Everest Base Camp Trail"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-900">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(event) => updateField('description', event.target.value)}
                    rows={4}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Brief itinerary and campaign details"
                  />
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
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={placeLoading}
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
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={placeLoading || !form.province}
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
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={placeLoading || !form.province || !form.district || placeNameOptions.length === 0}
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

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-900">Difficulty</label>
                  <select
                    value={form.difficulty}
                    onChange={(event) => updateField('difficulty', event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={difficultyLoading}
                  >
                    <option value="">
                      {difficultyLoading ? 'Loading difficulty options...' : 'Select difficulty'}
                    </option>
                    {uniqueDifficultyNames.map((difficultyName) => (
                      <option key={difficultyName} value={difficultyName}>
                        {difficultyName}
                      </option>
                    ))}
                  </select>
                  {!difficultyLoading && uniqueDifficultyNames.length === 0 && (
                    <p className="mt-1 text-xs text-amber-700">
                      No enabled difficulty options found in Extra category.
                    </p>
                  )}
                </div>
              </div>
            </section>

            <section className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h2 className="text-lg font-semibold text-slate-900">Planning & Enrollment</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-900">Campaign Activity *</label>
                  <select
                    value={form.category}
                    onChange={(event) => updateField('category', event.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={categoryLoading}
                  >
                    <option value="">{categoryLoading ? 'Loading activities...' : 'Select activity'}</option>
                    {uniqueCategoryNames.map((categoryName) => (
                      <option key={categoryName} value={categoryName}>
                        {categoryName}
                      </option>
                    ))}
                  </select>
                  {!categoryLoading && uniqueCategoryNames.length === 0 && (
                    <p className="mt-1 text-xs text-amber-700">
                      No enabled activities found. Create them in Extra {'>'} Activities first.
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-900">Type *</label>
                  <select
                    value={form.hikeType}
                    onChange={(event) => updateField('hikeType', event.target.value as 'solo' | 'group')}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select type</option>
                    <option value="solo">Solo</option>
                    <option value="group">Group</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-900">Duration (days)</label>
                  <input
                    type="number"
                    min={1}
                    value={form.durationDays}
                    onChange={(event) => updateField('durationDays', event.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-900">Join mode</label>
                  <select
                    value={form.joinMode}
                    onChange={(event) => updateField('joinMode', event.target.value as JoinMode)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    min={minimumStartDateTime}
                    disabled={form.scheduleType === 'instant'}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    min={minimumEndDateTime}
                    disabled={form.scheduleType === 'instant'}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {form.scheduleType === 'instant' && (
                    <p className="mt-1 text-xs text-slate-600">
                      Instant campaigns auto-close 12 hours after start. Close time is set to {form.endDate || instantEndDateValue}.
                    </p>
                  )}
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">Photos (optional)</h3>
                <button
                  type="button"
                  onClick={addPhotoRow}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <FiPlus size={14} />
                  Add Photo
                </button>
              </div>

              {form.photos.map((photo, index) => (
                <div key={`photo-${index}`} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 p-3 md:grid-cols-12">
                  <div className="md:col-span-6">
                    <label className="sr-only">Photo file</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => handlePhotoFileSelect(index, event)}
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
                    className="md:col-span-3 rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="publicId"
                  />
                  <input
                    type="text"
                    value={photo.caption}
                    onChange={(event) => updatePhotoField(index, 'caption', event.target.value)}
                    className="md:col-span-2 rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="caption"
                  />
                  <button
                    type="button"
                    onClick={() => removePhotoRow(index)}
                    className="md:col-span-1 inline-flex items-center justify-center rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
                    title="Remove photo row"
                  >
                    <FiTrash2 size={16} />
                  </button>
                </div>
              ))}
            </section>

            <div>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {submitting ? 'Submitting...' : 'Submit Campaign'}
              </button>
            </div>
          </form>

          <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg space-y-5">
            <h2 className="text-lg font-semibold text-slate-900">Live Preview</h2>

            <div className="rounded-xl bg-linear-to-br from-slate-900 via-blue-900 to-cyan-800 p-5 text-white">
              <p className="text-xs uppercase tracking-widest text-blue-100">Campaign Card</p>
              <h3 className="mt-2 text-xl font-bold">{form.title.trim() || 'Untitled Campaign'}</h3>
              <p className="mt-2 text-sm text-blue-100 line-clamp-4">{form.description.trim() || 'No description added yet.'}</p>

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <span className="inline-flex items-center gap-1 rounded-md bg-white/15 px-2 py-1">
                  <FiMapPin size={12} />
                  {displayLocation || 'No location'}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-white/15 px-2 py-1">
                  <FiCompass size={12} />
                  {form.difficulty.trim() || 'No level'}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-white/15 px-2 py-1">
                  <FiCalendar size={12} />
                  {form.durationDays} day(s)
                </span>
                {form.hikeType !== 'solo' && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-white/15 px-2 py-1">
                    <FiUsers size={12} />
                    {form.maxParticipants} seats
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p>System ID: <span className="font-semibold">Auto-generated by system</span></p>
              <p>Estimated budget: <span className="font-semibold">NPR {form.estimatedNPR || '0'}</span></p>
              <p>Join mode: <span className="font-semibold capitalize">{form.joinMode}</span></p>
              <p>Activity: <span className="font-semibold">{form.category || 'Not set'}</span></p>
              <p>Type: <span className="font-semibold capitalize">{form.hikeType || 'Not set'}</span></p>
              <p>Province: <span className="font-semibold">{form.province || 'Not set'}</span></p>
              <p>District: <span className="font-semibold">{form.district || 'Not set'}</span></p>
              <p>Place: <span className="font-semibold">{form.placeName || 'Not set'}</span></p>
              <p>Location label: <span className="font-semibold">{displayLocation || 'Not set'}</span></p>
              <p>Timing mode: <span className="font-semibold capitalize">{form.scheduleType}</span></p>
              <p>Start date: <span className="font-semibold">{form.scheduleType === 'instant' ? 'Now (automatic)' : (form.startDate || 'Not set')}</span></p>
              <p>Visibility: <span className="font-semibold">At campaign start time</span></p>
              <p>End date: <span className="font-semibold">{form.endDate || 'Duration days fallback'}</span></p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
