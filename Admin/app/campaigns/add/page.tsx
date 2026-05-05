'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  FiCalendar,
  FiCheck,
  FiChevronRight,
  FiCompass,
  FiImage,
  FiMapPin,
  FiPlus,
  FiTrash2,
  FiUsers,
} from 'react-icons/fi';
import {
  CampaignPayload,
  CampaignScheduleType,
  JoinMode,
  createCampaign,
  formatDateTimeLocal,
} from '@/lib/campaigns';
import {
  DifficultyTier,
  ExtraItem,
  PlaceProvinceNode,
  fetchAdminPlaceHierarchy,
  fetchDifficultySettings,
  fetchExtras,
} from '@/lib/extras';
import { apiClient } from '@/lib/api';

const INSTANT_CAMPAIGN_DURATION_HOURS = 12;

/* ================= NEW LOGIC ================= */

function getMinStartDate(hikeType: 'solo' | 'group') {
  const d = new Date();
  d.setDate(d.getDate() + (hikeType === 'group' ? 8 : 1));
  return d;
}

/* ================= TYPES ================= */

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
  municipality: string;
  spotName: string;
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
  hikeType: 'group',
  province: '',
  district: '',
  municipality: '',
  spotName: '',
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

/* ================= COMPONENT ================= */

export default function AddCampaignPage() {
  const [form, setForm] = useState<CampaignFormState>(defaultFormState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  /* ================= VALIDATION ================= */

  function validateForm() {
    if (!form.title.trim()) return 'Title required';
    if (!form.category.trim()) return 'Activity required';

    const max = Number(form.maxParticipants);

    if (form.hikeType === 'group') {
      if (form.scheduleType === 'instant') {
        return 'Group campaigns cannot be instant';
      }

      if (!form.startDate) return 'Start date required';

      if (max < 2) return 'Minimum 2 participants required';

      const minDate = getMinStartDate('group');

      if (new Date(form.startDate) < minDate) {
        return 'Group campaign must be at least 8 days later';
      }
    }

    return null;
  }

  /* ================= SUBMIT ================= */

  async function handleCreateCampaign(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    const err = validateForm();
    if (err) {
      setError(err);
      return;
    }

    const startDate = new Date(form.startDate);

    const payload: CampaignPayload = {
      title: form.title,
      description: form.description,
      category: form.category,
      hikeType: form.hikeType as 'solo' | 'group',
      maxParticipants:
        form.hikeType === 'group'
          ? Number(form.maxParticipants)
          : undefined,
      startDate: startDate.toISOString(),
      joinMode: form.joinMode,
    };

    try {
      setSubmitting(true);

      const res = await createCampaign(payload);

      setSuccess(`Created: ${res._id}`);

      setForm(defaultFormState);
    } catch (e) {
      setError('Failed to create campaign');
    } finally {
      setSubmitting(false);
    }
  }

  /* ================= UI ================= */

  const minDate = formatDateTimeLocal(getMinStartDate(form.hikeType as any));

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold">Create Campaign</h1>

      {error && <div className="text-red-500">{error}</div>}
      {success && <div className="text-green-600">{success}</div>}

      <form onSubmit={handleCreateCampaign} className="space-y-4">
        <input
          placeholder="Title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="border p-2 w-full"
        />

        <textarea
          placeholder="Description"
          value={form.description}
          onChange={(e) =>
            setForm({ ...form, description: e.target.value })
          }
          className="border p-2 w-full"
        />

        <select
          value={form.hikeType}
          onChange={(e) =>
            setForm({
              ...form,
              hikeType: e.target.value as any,
            })
          }
          className="border p-2 w-full"
        >
          <option value="solo">Solo</option>
          <option value="group">Group</option>
        </select>

        {form.hikeType === 'group' && (
          <input
            type="number"
            value={form.maxParticipants}
            onChange={(e) =>
              setForm({
                ...form,
                maxParticipants: e.target.value,
              })
            }
            className="border p-2 w-full"
            placeholder="Max participants"
          />
        )}

        <select
          value={form.scheduleType}
          onChange={(e) =>
            setForm({
              ...form,
              scheduleType: e.target.value as any,
            })
          }
          className="border p-2 w-full"
        >
          <option value="instant" disabled={form.hikeType === 'group'}>
            Instant
          </option>
          <option value="scheduled">Scheduled</option>
        </select>

        <input
          type="datetime-local"
          value={form.startDate}
          onChange={(e) =>
            setForm({ ...form, startDate: e.target.value })
          }
          min={minDate}
          className="border p-2 w-full"
        />

        <button
          type="submit"
          disabled={submitting}
          className="bg-black text-white px-4 py-2"
        >
          {submitting ? 'Creating...' : 'Create Campaign'}
        </button>
      </form>
    </div>
  );
}