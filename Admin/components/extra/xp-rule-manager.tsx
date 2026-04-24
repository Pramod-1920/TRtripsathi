'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  createExtra,
  deleteExtra,
  ExtraItem,
  fetchExtras,
  updateExtra,
} from '@/lib/extras';

type RuleRepeatMode =
  | 'always'
  | 'once_per_user'
  | 'once_per_campaign'
  | 'once_per_district'
  | 'once_per_difficulty'
  | 'once_per_referred_user';

type RuleConditions = {
  difficulty?: string;
  district?: string;
  ratingGte?: number;
  solo?: boolean;
  hostOnly?: boolean;
};

type RuleValuePayload = {
  eventKey: string;
  points: number;
  repeat: RuleRepeatMode;
  conditions?: RuleConditions;
};

type RuleFormState = {
  name: string;
  description: string;
  eventKey: string;
  points: string;
  repeat: RuleRepeatMode;
  difficulty: string;
  district: string;
  ratingGte: string;
  soloOnly: boolean;
  hostOnly: boolean;
  enabled: boolean;
};

const eventPresets = [
  { key: 'campaign_completed', label: 'Campaign completed (participant)' },
  { key: 'host_campaign_completed', label: 'Hosted campaign completed' },
  { key: 'group_photo_uploaded', label: 'Group photo uploaded' },
  { key: 'solo_photo_uploaded', label: 'Solo photo uploaded' },
  { key: 'first_solo_trek', label: 'First solo trek' },
  { key: 'first_trek_new_district', label: 'First trek in new district' },
  { key: 'received_five_star_rating', label: 'Received 5-star rating' },
  { key: 'referral_completed_trek', label: 'Referral completed trek' },
  { key: 'manual', label: 'Manual award' },
];

const defaultFormState: RuleFormState = {
  name: '',
  description: '',
  eventKey: 'campaign_completed',
  points: '0',
  repeat: 'always',
  difficulty: '',
  district: '',
  ratingGte: '',
  soloOnly: false,
  hostOnly: false,
  enabled: true,
};

function normalizeKey(value: string) {
  return value.trim().toLowerCase();
}

function parseRuleValue(rawValue?: string | null): RuleValuePayload | null {
  if (!rawValue?.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<RuleValuePayload>;

    if (!parsed.eventKey || parsed.points === undefined || !parsed.repeat) {
      return null;
    }

    const points = Number(parsed.points);

    if (!Number.isFinite(points)) {
      return null;
    }

    return {
      eventKey: normalizeKey(parsed.eventKey),
      points,
      repeat: parsed.repeat,
      ...(parsed.conditions ? { conditions: parsed.conditions } : {}),
    };
  } catch {
    const points = Number(rawValue);

    if (!Number.isFinite(points)) {
      return null;
    }

    return {
      eventKey: 'manual',
      points,
      repeat: 'always',
    };
  }
}

function buildRuleValue(form: RuleFormState) {
  const points = Number(form.points);

  if (!Number.isFinite(points) || points <= 0) {
    throw new Error('Points must be a positive number.');
  }

  const eventKey = normalizeKey(form.eventKey);

  if (!eventKey) {
    throw new Error('Event key is required.');
  }

  const conditions: RuleConditions = {};

  if (form.difficulty.trim()) {
    conditions.difficulty = normalizeKey(form.difficulty);
  }

  if (form.district.trim()) {
    conditions.district = normalizeKey(form.district);
  }

  if (form.ratingGte.trim()) {
    const ratingGte = Number(form.ratingGte);

    if (!Number.isFinite(ratingGte)) {
      throw new Error('Minimum rating must be a valid number.');
    }

    conditions.ratingGte = ratingGte;
  }

  if (form.soloOnly) {
    conditions.solo = true;
  }

  if (form.hostOnly) {
    conditions.hostOnly = true;
  }

  const payload: RuleValuePayload = {
    eventKey,
    points: Math.floor(points),
    repeat: form.repeat,
    ...(Object.keys(conditions).length > 0 ? { conditions } : {}),
  };

  return JSON.stringify(payload);
}

export function XpRuleManager() {
  const [items, setItems] = useState<ExtraItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState<RuleFormState>(defaultFormState);
  const [editId, setEditId] = useState<string | null>(null);

  async function loadRules() {
    setLoading(true);
    setError('');

    try {
      const response = await fetchExtras('xp', { page: 1, limit: 200 });
      setItems(response.items);
    } catch {
      setError('Failed to load XP rules. Please verify backend API and admin session.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRules();
  }, []);

  const parsedRows = useMemo(() => {
    return items.map((item) => {
      const parsed = parseRuleValue(item.value);

      return {
        item,
        parsed,
      };
    });
  }, [items]);

  function resetForm() {
    setForm(defaultFormState);
    setEditId(null);
  }

  function startEdit(item: ExtraItem) {
    const parsed = parseRuleValue(item.value);

    setEditId(item._id);
    setForm({
      name: item.name,
      description: item.description ?? '',
      eventKey: parsed?.eventKey ?? 'manual',
      points: String(parsed?.points ?? 0),
      repeat: parsed?.repeat ?? 'always',
      difficulty: parsed?.conditions?.difficulty ?? '',
      district: parsed?.conditions?.district ?? '',
      ratingGte: parsed?.conditions?.ratingGte !== undefined
        ? String(parsed.conditions.ratingGte)
        : '',
      soloOnly: parsed?.conditions?.solo ?? false,
      hostOnly: parsed?.conditions?.hostOnly ?? false,
      enabled: item.enabled !== false,
    });
  }

  async function submitRule(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      if (!form.name.trim()) {
        throw new Error('Rule name is required.');
      }

      const value = buildRuleValue(form);
      const payload = {
        category: 'xp' as const,
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        value,
        enabled: form.enabled,
      };

      if (editId) {
        await updateExtra(editId, payload);
        setSuccess('XP rule updated successfully.');
      } else {
        await createExtra(payload);
        setSuccess('XP rule created successfully.');
      }

      resetForm();
      await loadRules();
    } catch (caughtError) {
      if (caughtError instanceof Error) {
        setError(caughtError.message);
      } else {
        setError('Failed to save XP rule.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function removeRule(id: string) {
    setDeletingId(id);
    setError('');
    setSuccess('');

    try {
      await deleteExtra(id);
      setSuccess('XP rule deleted successfully.');
      if (editId === id) {
        resetForm();
      }
      await loadRules();
    } catch {
      setError('Failed to delete XP rule.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">XP Rule Management</h1>
        <p className="mt-2 text-sm text-slate-600">
          Configure event-based XP rewards. Add new event keys anytime to expand the XP system without backend code changes.
        </p>
      </section>

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
        <form onSubmit={submitRule} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
          <h2 className="text-lg font-semibold text-slate-900">
            {editId ? 'Edit XP Rule' : 'Create XP Rule'}
          </h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-900">Rule Name</label>
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Difficulty: Hard campaign completion"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-900">Description</label>
              <textarea
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                rows={2}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Awarded when a participant completes a hard difficulty campaign"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-900">Event Key</label>
              <input
                list="xp-event-presets"
                value={form.eventKey}
                onChange={(event) => setForm((current) => ({ ...current, eventKey: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="campaign_completed"
              />
              <datalist id="xp-event-presets">
                {eventPresets.map((preset) => (
                  <option key={preset.key} value={preset.key}>
                    {preset.label}
                  </option>
                ))}
              </datalist>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-900">Points</label>
              <input
                type="number"
                min={1}
                value={form.points}
                onChange={(event) => setForm((current) => ({ ...current, points: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-900">Repeat Mode</label>
              <select
                value={form.repeat}
                onChange={(event) => setForm((current) => ({ ...current, repeat: event.target.value as RuleRepeatMode }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="always">Always</option>
                <option value="once_per_user">Once per user</option>
                <option value="once_per_campaign">Once per campaign</option>
                <option value="once_per_district">Once per district</option>
                <option value="once_per_difficulty">Once per difficulty</option>
                <option value="once_per_referred_user">Once per referred user</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-900">Difficulty Condition</label>
              <input
                value={form.difficulty}
                onChange={(event) => setForm((current) => ({ ...current, difficulty: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="easy, moderate, hard"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-900">District Condition</label>
              <input
                value={form.district}
                onChange={(event) => setForm((current) => ({ ...current, district: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Kathmandu District"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-900">Minimum Rating</label>
              <input
                type="number"
                min={1}
                max={5}
                step={0.1}
                value={form.ratingGte}
                onChange={(event) => setForm((current) => ({ ...current, ratingGte: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="5"
              />
            </div>

            <div className="flex items-center gap-6 rounded-lg border border-slate-200 p-3">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.soloOnly}
                  onChange={(event) => setForm((current) => ({ ...current, soloOnly: event.target.checked }))}
                />
                Solo only
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.hostOnly}
                  onChange={(event) => setForm((current) => ({ ...current, hostOnly: event.target.checked }))}
                />
                Host only
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))}
                />
                Enabled
              </label>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? 'Saving...' : editId ? 'Update Rule' : 'Create Rule'}
            </button>
            {editId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel Edit
              </button>
            )}
          </div>
        </form>

        <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Recommended Events</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {eventPresets.map((preset) => (
              <li key={preset.key} className="rounded-md bg-slate-50 px-3 py-2">
                <p className="font-medium text-slate-900">{preset.key}</p>
                <p className="text-xs text-slate-600">{preset.label}</p>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Configured XP Rules</h2>

        {loading ? (
          <p className="mt-3 text-sm text-slate-600">Loading rules...</p>
        ) : parsedRows.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No XP rules configured yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-600">
                  <th className="px-3 py-2">Rule</th>
                  <th className="px-3 py-2">Event</th>
                  <th className="px-3 py-2">Points</th>
                  <th className="px-3 py-2">Repeat</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {parsedRows.map(({ item, parsed }) => (
                  <tr key={item._id} className="border-b border-slate-100 align-top">
                    <td className="px-3 py-2">
                      <p className="font-medium text-slate-900">{item.name}</p>
                      {item.description && <p className="text-xs text-slate-600">{item.description}</p>}
                    </td>
                    <td className="px-3 py-2 text-slate-700">{parsed?.eventKey ?? 'Invalid JSON value'}</td>
                    <td className="px-3 py-2 text-slate-700">{parsed?.points ?? '-'}</td>
                    <td className="px-3 py-2 text-slate-700">{parsed?.repeat ?? '-'}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-1 text-xs ${item.enabled === false ? 'bg-slate-100 text-slate-500' : 'bg-emerald-100 text-emerald-700'}`}>
                        {item.enabled === false ? 'Disabled' : 'Enabled'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(item)}
                          className="rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => removeRule(item._id)}
                          disabled={deletingId === item._id}
                          className="rounded-md border border-red-200 px-3 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-60"
                        >
                          {deletingId === item._id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
