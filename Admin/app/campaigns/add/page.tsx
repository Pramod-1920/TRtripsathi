'use client';

import { useEffect, useMemo, useState } from 'react';
import { FiCalendar, FiCompass, FiMapPin, FiPlus, FiTrash2, FiUsers } from 'react-icons/fi';
import {
  CampaignPayload,
  formatDateTimeLocal,
  JoinMode,
  createCampaign,
  toIsoFromDateInput,
} from '@/lib/campaigns';
import { ExtraItem, fetchExtras } from '@/lib/extras';

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

export default function AddCampaignPage() {
  const [form, setForm] = useState<CampaignFormState>(defaultFormState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [difficultyOptions, setDifficultyOptions] = useState<ExtraItem[]>([]);
  const [difficultyLoading, setDifficultyLoading] = useState(true);

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

    setSubmitting(true);

    try {
      const createdCampaign = await createCampaign(payload);
      setForm(defaultFormState);
      setSuccess(
        `Campaign created successfully. System ID: ${createdCampaign.campaignCode ?? createdCampaign._id}`,
      );
    } catch {
      setError('Could not create campaign. Check form values and admin session.');
    } finally {
      setSubmitting(false);
    }
  }

  const minimumJoinOpenDateTime = formatDateTimeLocal(new Date());
  const minimumStartDateTime = formatDateTimeLocal(
    new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
  );

  return (
    <div className="relative p-8">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-8 top-6 h-64 w-64 rounded-full bg-cyan-200/40 blur-3xl" />
        <div className="absolute right-10 top-24 h-72 w-72 rounded-full bg-blue-200/50 blur-3xl" />
      </div>

      <div className="space-y-8">
        <header className="rounded-2xl border border-slate-200 bg-linear-to-r from-slate-900 via-blue-900 to-cyan-800 p-8 text-white shadow-xl">
          <p className="text-xs uppercase tracking-[0.22em] text-blue-100">Campaign Management</p>
          <h1 className="mt-2 text-3xl font-bold">Create a New Campaign</h1>
          <p className="mt-2 max-w-2xl text-sm text-blue-100">
            Build a complete campaign record and publish it directly to your backend in one flow.
          </p>
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
          <form onSubmit={handleCreateCampaign} className="xl:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-lg space-y-6">
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
                  <label className="mb-1 block text-sm font-medium text-slate-900">Location</label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={(event) => updateField('location', event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Solukhumbu"
                  />
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
                  <label className="mb-1 block text-sm font-medium text-slate-900">Duration (days)</label>
                  <input
                    type="number"
                    min={1}
                    value={form.durationDays}
                    onChange={(event) => updateField('durationDays', event.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

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
                  <label className="mb-1 block text-sm font-medium text-slate-900">Start date</label>
                  <input
                    type="datetime-local"
                    value={form.startDate}
                    onChange={(event) => updateField('startDate', event.target.value)}
                    min={minimumStartDateTime}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-900">Join open date</label>
                  <input
                    type="datetime-local"
                    value={form.joinOpenDate}
                    onChange={(event) => updateField('joinOpenDate', event.target.value)}
                    min={minimumJoinOpenDateTime}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
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
                  <input
                    type="url"
                    value={photo.url}
                    onChange={(event) => updatePhotoField(index, 'url', event.target.value)}
                    className="md:col-span-6 rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://..."
                  />
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
                {submitting ? 'Creating...' : 'Create Campaign'}
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
                  {form.location.trim() || 'No location'}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-white/15 px-2 py-1">
                  <FiCompass size={12} />
                  {form.difficulty.trim() || 'No level'}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-white/15 px-2 py-1">
                  <FiCalendar size={12} />
                  {form.durationDays} day(s)
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-white/15 px-2 py-1">
                  <FiUsers size={12} />
                  {form.maxParticipants} seats
                </span>
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p>System ID: <span className="font-semibold">Auto-generated by system</span></p>
              <p>Estimated budget: <span className="font-semibold">NPR {form.estimatedNPR || '0'}</span></p>
              <p>Join mode: <span className="font-semibold capitalize">{form.joinMode}</span></p>
              <p>Start date: <span className="font-semibold">{form.startDate || 'Not set'}</span></p>
              <p>Join open date: <span className="font-semibold">{form.joinOpenDate || 'Not set'}</span></p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
