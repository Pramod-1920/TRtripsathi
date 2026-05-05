'use client';

import { ChangeEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import {
  CampaignPayload,
  CampaignScheduleType,
  JoinMode,
  createCampaign,
  formatDateTimeLocal,
} from '@/lib/campaigns';
import {
  ExtraItem,
  PlaceProvinceNode,
  fetchAdminPlaceHierarchy,
  fetchDifficultySettings,
  fetchExtras,
} from '@/lib/extras';
import { apiClient } from '@/lib/api';

type CampaignPhotoInput = {
  url: string;
  publicId: string;
  caption: string;
};

type CampaignFormState = {
  title: string;
  description: string;
  category: string;
  hikeType: 'solo' | 'group';
  province: string;
  district: string;
  municipality: string;
  placeName: string;
  difficulty: string;
  durationDays: string;
  minParticipants: string;
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
  hikeType: 'group',
  province: '',
  district: '',
  municipality: '',
  placeName: '',
  difficulty: '',
  durationDays: '1',
  minParticipants: '2',
  maxParticipants: '10',
  estimatedNPR: '0',
  scheduleType: 'scheduled',
  startDate: '',
  endDate: '',
  joinMode: 'open',
  photos: [],
};

function getMinStartDate(hikeType: 'solo' | 'group') {
  const date = new Date();
  date.setDate(date.getDate() + (hikeType === 'group' ? 7 : 2));
  return date;
}

function FieldBox({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="text-xs text-slate-600">{description}</p>
      </div>
      {children}
    </div>
  );
}

export default function AddCampaignPage() {
  const [form, setForm] = useState<CampaignFormState>(defaultFormState);
  const [categories, setCategories] = useState<ExtraItem[]>([]);
  const [difficulties, setDifficulties] = useState<Array<{ id: string; label: string; enabled: boolean }>>([]);
  const [places, setPlaces] = useState<PlaceProvinceNode[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let active = true;

    async function loadOptions() {
      setLoadingOptions(true);
      try {
        const [activityResponse, difficultyResponse, placeResponse] = await Promise.all([
          fetchExtras('activities', { page: 1, limit: 200 }),
          fetchDifficultySettings(),
          fetchAdminPlaceHierarchy(),
        ]);

        if (!active) {
          return;
        }

        setCategories(activityResponse.items.filter((item) => item.enabled !== false));
        setDifficulties(difficultyResponse.filter((item) => item.enabled !== false));
        setPlaces(placeResponse.provinces.filter((item) => item.deleted !== true));
      } catch {
        if (active) {
          setError('Failed to load campaign creation options.');
        }
      } finally {
        if (active) {
          setLoadingOptions(false);
        }
      }
    }

    void loadOptions();
    return () => {
      active = false;
    };
  }, []);

  const districtOptions = useMemo(() => {
    const province = places.find((item) => item.name === form.province);
    return province?.districts.filter((item) => item.deleted !== true).map((item) => item.name) ?? [];
  }, [form.province, places]);

  const municipalityOptions = useMemo(() => {
    const province = places.find((item) => item.name === form.province);
    const district = province?.districts.find((item) => item.name === form.district);
    return district?.municipalities
      .filter((item) => item.deleted !== true)
      .map((item) => item.name) ?? [];
  }, [form.district, form.province, places]);

  const minDate = formatDateTimeLocal(getMinStartDate(form.hikeType));
  const previewLocation = [form.placeName, form.municipality, form.district, form.province].filter(Boolean).join(', ') || 'Not set';

  function updateField<K extends keyof CampaignFormState>(field: K, value: CampaignFormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updatePhotoCaption(index: number, caption: string) {
    setForm((current) => ({
      ...current,
      photos: current.photos.map((photo, photoIndex) => (
        photoIndex === index
          ? { ...photo, caption }
          : photo
      )),
    }));
  }

  function removePhoto(index: number) {
    setForm((current) => ({
      ...current,
      photos: current.photos.filter((_, photoIndex) => photoIndex !== index),
    }));
  }

  async function uploadPhoto(file: File) {
    const signatureResponse = await apiClient.post('/cloudinary/signature', { folder: 'campaigns' });
    const { cloudName, apiKey, timestamp, signature, folder } = signatureResponse.data as {
      cloudName: string;
      apiKey: string;
      timestamp: number;
      signature: string;
      folder?: string;
    };

    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', apiKey);
    formData.append('timestamp', String(timestamp));
    formData.append('signature', signature);
    if (folder) {
      formData.append('folder', folder);
    }

    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;
    const uploadResponse = await fetch(uploadUrl, { method: 'POST', body: formData });
    if (!uploadResponse.ok) {
      throw new Error('Upload failed');
    }

    const uploadJson = await uploadResponse.json() as { secure_url?: string; public_id?: string };
    if (!uploadJson.secure_url) {
      throw new Error('Invalid upload response');
    }

    return {
      url: uploadJson.secure_url,
      publicId: uploadJson.public_id ?? '',
      caption: '',
    };
  }

  async function handlePhotoFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }

    setError('');
    setUploadingPhotos(true);
    try {
      const uploaded: CampaignPhotoInput[] = [];
      for (const file of files) {
        const photo = await uploadPhoto(file);
        uploaded.push(photo);
      }

      setForm((current) => ({
        ...current,
        photos: [...current.photos, ...uploaded],
      }));
    } catch {
      setError('Failed to upload one or more images.');
    } finally {
      setUploadingPhotos(false);
      event.target.value = '';
    }
  }

  function validateForm() {
    if (!form.title.trim()) {
      return 'Title is required.';
    }
    if (!form.category.trim()) {
      return 'Activity category is required.';
    }
    if (form.scheduleType === 'scheduled' && !form.startDate) {
      return 'Start date/time is required for scheduled campaigns.';
    }
    if (!Number.isFinite(Number(form.durationDays)) || Number(form.durationDays) < 1) {
      return 'Duration must be at least 1 day.';
    }
    if (!Number.isFinite(Number(form.estimatedNPR)) || Number(form.estimatedNPR) < 0) {
      return 'Estimated cost must be zero or positive.';
    }
    if (form.endDate && form.startDate) {
      const endDate = new Date(form.endDate);
      const startDate = new Date(form.startDate);
      if (endDate.getTime() <= startDate.getTime()) {
        return 'End date must be after start date.';
      }
    }

    if (form.hikeType === 'group') {
      if (form.scheduleType !== 'scheduled') {
        return 'Group campaigns must be scheduled.';
      }
      const minParticipants = Number(form.minParticipants);
      const maxParticipants = Number(form.maxParticipants);
      if (!Number.isFinite(minParticipants) || minParticipants < 1) {
        return 'Minimum participants must be at least 1.';
      }
      if (!Number.isFinite(maxParticipants) || maxParticipants < 2) {
        return 'Maximum participants must be at least 2.';
      }
      if (minParticipants > maxParticipants) {
        return 'Minimum participants cannot exceed maximum participants.';
      }
      if (!form.startDate) {
        return 'Group campaign start date is required.';
      }
      if (new Date(form.startDate).getTime() < getMinStartDate('group').getTime()) {
        return 'Group campaign must start at least 7 days in the future.';
      }
    }

    if (form.hikeType === 'solo' && form.scheduleType === 'scheduled' && form.startDate) {
      if (new Date(form.startDate).getTime() < getMinStartDate('solo').getTime()) {
        return 'Solo scheduled campaign must start at least 2 days in the future.';
      }
    }

    return null;
  }

  async function handleCreateCampaign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    const payload: CampaignPayload = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      category: form.category.trim(),
      hikeType: form.hikeType,
      province: form.province.trim() || undefined,
      district: form.district.trim() || undefined,
      municipality: form.municipality.trim() || undefined,
      placeName: form.placeName.trim() || undefined,
      difficulty: form.difficulty.trim() || undefined,
      durationDays: Number(form.durationDays),
      estimatedNPR: Number(form.estimatedNPR),
      scheduleType: form.hikeType === 'group' ? 'scheduled' : form.scheduleType,
      startDate: form.startDate ? new Date(form.startDate).toISOString() : undefined,
      endDate: form.endDate ? new Date(form.endDate).toISOString() : undefined,
      joinMode: form.joinMode,
      minParticipants: form.hikeType === 'group' ? Number(form.minParticipants) : undefined,
      maxParticipants: form.hikeType === 'group' ? Number(form.maxParticipants) : undefined,
      photos: form.photos.length > 0
        ? form.photos.map((photo) => ({
          url: photo.url,
          publicId: photo.publicId || undefined,
          caption: photo.caption.trim() || undefined,
        }))
        : undefined,
    };

    setSubmitting(true);
    try {
      const created = await createCampaign(payload);
      setSuccess(`Campaign created successfully (${created.campaignCode ?? created._id}).`);
      setForm((current) => ({
        ...defaultFormState,
        hikeType: current.hikeType,
      }));
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      const normalized = Array.isArray(message) ? message.join(', ') : message;
      setError(normalized || 'Failed to create campaign.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Create Campaign</h1>
        <p className="mt-1 text-sm text-slate-600">
          Left side is the form, right side is a real-time preview of how users will view your campaign.
        </p>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">{success}</div>}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <form onSubmit={handleCreateCampaign} className="space-y-5">
            <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">1. Basic Information</h2>
                <p className="text-sm text-slate-600">Set campaign identity and trip style.</p>
              </div>

              <FieldBox title="Campaign Title" description="This is the main name shown to users in listings and details pages.">
                <input className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" placeholder="Campaign title" value={form.title} onChange={(event) => updateField('title', event.target.value)} />
              </FieldBox>

              <FieldBox title="Description" description="Explain what this campaign is about, highlights, and expectations.">
                <textarea className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" placeholder="Description" value={form.description} onChange={(event) => updateField('description', event.target.value)} rows={4} />
              </FieldBox>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <FieldBox title="Campaign Type" description="Group uses lifecycle phases; solo is simpler.">
                  <select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" value={form.hikeType} onChange={(event) => {
                    const nextType = event.target.value as 'solo' | 'group';
                    setForm((current) => ({ ...current, hikeType: nextType, scheduleType: nextType === 'group' ? 'scheduled' : current.scheduleType }));
                  }}>
                    <option value="group">Group</option>
                    <option value="solo">Solo</option>
                  </select>
                </FieldBox>

                <FieldBox title="Schedule Type" description="Group campaigns are always scheduled; solo can be instant.">
                  <select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" value={form.scheduleType} disabled={form.hikeType === 'group'} onChange={(event) => updateField('scheduleType', event.target.value as CampaignScheduleType)}>
                    <option value="scheduled">Scheduled</option>
                    <option value="instant">Instant (solo only)</option>
                  </select>
                </FieldBox>
              </div>
            </section>

            <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">2. Activity & Location</h2>
                <p className="text-sm text-slate-600">Choose what users will do and where it will happen.</p>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <FieldBox title="Activity Category" description="This controls how the campaign is categorized and filtered.">
                  <select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" value={form.category} onChange={(event) => updateField('category', event.target.value)} disabled={loadingOptions}>
                    <option value="">Select activity</option>
                    {categories.map((item) => <option key={item._id} value={item.name}>{item.name}</option>)}
                  </select>
                </FieldBox>

                <FieldBox title="Difficulty" description="Difficulty affects admin approval and user expectations.">
                  <select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" value={form.difficulty} onChange={(event) => updateField('difficulty', event.target.value)} disabled={loadingOptions}>
                    <option value="">Select difficulty</option>
                    {difficulties.map((item) => <option key={item.id} value={item.label}>{item.label}</option>)}
                  </select>
                </FieldBox>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <FieldBox title="Province" description="Select the main province for the trip.">
                  <select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" value={form.province} onChange={(event) => {
                    updateField('province', event.target.value);
                    updateField('district', '');
                    updateField('municipality', '');
                  }} disabled={loadingOptions}>
                    <option value="">Select province</option>
                    {places.map((province) => <option key={province.id} value={province.name}>{province.name}</option>)}
                  </select>
                </FieldBox>

                <FieldBox title="District" description="Pick the district inside the selected province.">
                  <select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" value={form.district} onChange={(event) => {
                    updateField('district', event.target.value);
                    updateField('municipality', '');
                  }} disabled={loadingOptions || !form.province}>
                    <option value="">{form.province ? 'Select district' : 'Select province first'}</option>
                    {districtOptions.map((district) => <option key={district} value={district}>{district}</option>)}
                  </select>
                </FieldBox>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <FieldBox title="Municipality" description="Select municipality under the chosen district.">
                  <select
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    value={form.municipality}
                    onChange={(event) => updateField('municipality', event.target.value)}
                    disabled={loadingOptions || !form.district}
                  >
                    <option value="">{form.district ? 'Select municipality' : 'Select district first'}</option>
                    {municipalityOptions.map((municipality) => (
                      <option key={municipality} value={municipality}>{municipality}</option>
                    ))}
                  </select>
                </FieldBox>

                <FieldBox title="Place Name" description="Specific place/spot name shown in campaign cards.">
                  <input className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" placeholder="Place name" value={form.placeName} onChange={(event) => updateField('placeName', event.target.value)} />
                </FieldBox>
              </div>
            </section>

            <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">3. Schedule & Capacity</h2>
                <p className="text-sm text-slate-600">Set timeline, cost, joining mode, and participant limits.</p>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <FieldBox title="Duration (days)" description="Expected trip duration in days.">
                  <input className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" type="number" min={1} placeholder="Duration days" value={form.durationDays} onChange={(event) => updateField('durationDays', event.target.value)} />
                </FieldBox>

                <FieldBox title="Estimated Cost (NPR)" description="Total estimated cost users should expect.">
                  <input className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" type="number" min={0} placeholder="Estimated cost (NPR)" value={form.estimatedNPR} onChange={(event) => updateField('estimatedNPR', event.target.value)} />
                </FieldBox>

                <FieldBox title="Join Mode" description="Open = instant join, Request = host approval flow.">
                  <select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" value={form.joinMode} onChange={(event) => updateField('joinMode', event.target.value as JoinMode)}>
                    <option value="open">Open join</option>
                    <option value="request">Request to join</option>
                  </select>
                </FieldBox>
              </div>

              {form.hikeType === 'group' && (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <FieldBox title="Minimum Participants" description="Minimum people required before campaign can proceed.">
                    <input className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" type="number" min={1} placeholder="Min participants" value={form.minParticipants} onChange={(event) => updateField('minParticipants', event.target.value)} />
                  </FieldBox>

                  <FieldBox title="Maximum Participants" description="Maximum group size allowed for this campaign.">
                    <input className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" type="number" min={2} placeholder="Max participants" value={form.maxParticipants} onChange={(event) => updateField('maxParticipants', event.target.value)} />
                  </FieldBox>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <FieldBox title="Start Date/Time" description="Campaign kickoff time (group requires at least 7 days lead).">
                  <input className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" type="datetime-local" value={form.startDate} onChange={(event) => updateField('startDate', event.target.value)} min={minDate} />
                </FieldBox>

                <FieldBox title="End Date/Time" description="Optional explicit end time; leave empty to auto-calculate.">
                  <input className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" type="datetime-local" value={form.endDate} onChange={(event) => updateField('endDate', event.target.value)} />
                </FieldBox>
              </div>
            </section>

            <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">4. Campaign Images (Optional)</h2>
                <p className="text-sm text-slate-600">Upload single or multiple images, preview them, set caption, and remove any image.</p>
              </div>

              <FieldBox title="Upload Images" description="Images are uploaded to cloud storage and attached to the campaign.">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoFiles}
                  disabled={uploadingPhotos}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
                {uploadingPhotos && <p className="text-xs text-blue-600">Uploading images...</p>}
              </FieldBox>

              {form.photos.length > 0 && (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {form.photos.map((photo, index) => (
                    <div key={`${photo.url}-${index}`} className="rounded-lg border border-slate-200 bg-white p-3">
                      <img src={photo.url} alt={`Campaign ${index + 1}`} className="h-36 w-full rounded-md object-cover" />
                      <div className="mt-2 space-y-2">
                        <input
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          placeholder="Photo caption (optional)"
                          value={photo.caption}
                          onChange={(event) => updatePhotoCaption(index, event.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => removePhoto(index)}
                          className="w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 hover:bg-red-100"
                        >
                          Delete image
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <button type="submit" disabled={submitting || loadingOptions || uploadingPhotos} className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60">
              {submitting ? 'Creating...' : 'Create campaign'}
            </button>
          </form>
        </div>

        <aside className="xl:col-span-1">
          <div className="sticky top-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Live Preview</h2>
              <p className="text-xs text-slate-500">Styled as a user-facing campaign card preview.</p>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="relative">
                {form.photos.length > 0 ? (
                  <img
                    src={form.photos[0].url}
                    alt={form.photos[0].caption || form.title || 'Campaign preview'}
                    className="h-48 w-full object-cover"
                  />
                ) : (
                  <div className="h-48 w-full bg-gradient-to-br from-sky-400 to-indigo-600" />
                )}
                <div className="absolute left-3 top-3 rounded-full bg-black/60 px-2 py-1 text-xs font-medium text-white">
                  {form.hikeType.toUpperCase()}
                </div>
                <div className="absolute right-3 top-3 rounded-full bg-white/90 px-2 py-1 text-xs font-medium text-slate-900">
                  {form.hikeType === 'group' ? 'Lifecycle Managed' : 'Solo Trip'}
                </div>
              </div>

              <div className="space-y-3 p-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{form.title || 'Untitled campaign'}</h3>
                  <p className="text-sm text-slate-600">{form.description || 'No description provided yet.'}</p>
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">{form.category || 'Activity'}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">{form.difficulty || 'Difficulty'}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">{form.hikeType === 'group' ? 'Scheduled' : form.scheduleType}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg bg-slate-50 p-2"><span className="font-medium">Location:</span> {previewLocation}</div>
                  <div className="rounded-lg bg-slate-50 p-2"><span className="font-medium">Start:</span> {form.startDate || 'Not set'}</div>
                  <div className="rounded-lg bg-slate-50 p-2"><span className="font-medium">Duration:</span> {form.durationDays} day(s)</div>
                  <div className="rounded-lg bg-slate-50 p-2"><span className="font-medium">Budget:</span> NPR {form.estimatedNPR || '0'}</div>
                  {form.hikeType === 'group' && (
                    <div className="col-span-2 rounded-lg bg-slate-50 p-2">
                      <span className="font-medium">Participants:</span> min {form.minParticipants || '0'} / max {form.maxParticipants || '0'}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {form.photos.length > 1 && (
              <div>
                <p className="mb-2 text-xs font-medium text-slate-600">Gallery Preview</p>
                <div className="grid grid-cols-3 gap-2">
                  {form.photos.slice(0, 6).map((photo, index) => (
                    <img key={`${photo.url}-${index}`} src={photo.url} alt={`Gallery ${index + 1}`} className="h-16 w-full rounded-md object-cover" />
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

