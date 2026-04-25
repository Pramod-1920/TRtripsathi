'use client';

import { useEffect, useMemo, useState } from 'react';
import { FiPlus, FiRefreshCw, FiSave } from 'react-icons/fi';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import {
  createExtra,
  deleteExtra,
  ExtraItem,
  fetchExtras,
  updateExtra,
} from '@/lib/extras';

type AchievementValuePayload = {
  key: string;
  subcategory: string;
  targetCount: number;
  hidden?: boolean;
  rewardXp?: number;
  badge?: string;
};

type AchievementFormState = {
  title: string;
  description: string;
  key: string;
  subcategory: string;
  targetCount: string;
  rewardXp: string;
  badge: string;
  hidden: boolean;
  enabled: boolean;
};

const defaultFormState: AchievementFormState = {
  title: '',
  description: '',
  key: '',
  subcategory: '',
  targetCount: '',
  rewardXp: '',
  badge: '',
  hidden: false,
  enabled: true,
};

function parseAchievementValue(rawValue?: string | null): AchievementValuePayload | null {
  if (!rawValue?.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<AchievementValuePayload>;

    if (!parsed.key || !parsed.subcategory || parsed.targetCount === undefined) {
      return null;
    }

    const targetCount = Number(parsed.targetCount);

    if (!Number.isFinite(targetCount) || targetCount < 1) {
      return null;
    }

    return {
      key: String(parsed.key),
      subcategory: String(parsed.subcategory),
      targetCount,
      ...(parsed.hidden ? { hidden: true } : {}),
      ...(parsed.rewardXp !== undefined && Number.isFinite(Number(parsed.rewardXp)) && Number(parsed.rewardXp) > 0
        ? { rewardXp: Math.floor(Number(parsed.rewardXp)) }
        : {}),
      ...(parsed.badge?.trim() ? { badge: String(parsed.badge).trim() } : {}),
    };
  } catch {
    return null;
  }
}

function buildAchievementValue(form: AchievementFormState) {
  const targetCount = Number(form.targetCount);

  if (!Number.isFinite(targetCount) || targetCount < 1) {
    throw new Error('Target count must be a number greater than or equal to 1.');
  }

  if (!form.key.trim()) {
    throw new Error('Key is required.');
  }

  if (!form.subcategory.trim()) {
    throw new Error('Subcategory is required.');
  }

  const payload: AchievementValuePayload = {
    key: form.key.trim(),
    subcategory: form.subcategory.trim(),
    targetCount: Math.floor(targetCount),
    ...(form.hidden ? { hidden: true } : {}),
    ...(Number.isFinite(Number(form.rewardXp)) && Number(form.rewardXp) > 0
      ? { rewardXp: Math.floor(Number(form.rewardXp)) }
      : {}),
    ...(form.badge.trim() ? { badge: form.badge.trim() } : {}),
  };

  return JSON.stringify(payload);
}

export function AchievementManager() {
  const [items, setItems] = useState<ExtraItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ExtraItem | null>(null);
  const [form, setForm] = useState<AchievementFormState>(defaultFormState);

  async function loadAchievements() {
    setLoading(true);
    setError('');

    try {
      const response = await fetchExtras('achievement', { page: 1, limit: 200 });
      setItems(response.items);
    } catch {
      setError('Failed to load achievements. Please verify backend API and admin session.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAchievements();
  }, []);

  const parsedRows = useMemo(() => {
    return items.map((item) => {
      const parsed = parseAchievementValue(item.value);

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
    const parsed = parseAchievementValue(item.value);

    setEditId(item._id);
    setForm({
      title: item.name ?? '',
      description: item.description ?? '',
      key: parsed?.key ?? '',
      subcategory: parsed?.subcategory ?? '',
      targetCount: parsed?.targetCount !== undefined ? String(parsed.targetCount) : '',
      rewardXp: parsed?.rewardXp !== undefined ? String(parsed.rewardXp) : '',
      badge: parsed?.badge ?? '',
      hidden: parsed?.hidden ?? false,
      enabled: item.enabled !== false,
    });
  }

  function openDeleteModal(item: ExtraItem) {
    setSelectedItem(item);
    setDeleteModalOpen(true);
  }

  function closeDeleteModal() {
    if (deleting) {
      return;
    }

    setDeleteModalOpen(false);
    setSelectedItem(null);
  }

  async function submitAchievement(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!form.title.trim()) {
      setError('Title is required.');
      return;
    }

    setSaving(true);

    try {
      const value = buildAchievementValue(form);
      const payload = {
        category: 'achievement' as const,
        name: form.title.trim(),
        description: form.description.trim() || undefined,
        value,
        enabled: form.enabled,
      };

      if (editId) {
        await updateExtra(editId, payload);
        setSuccess('Achievement updated successfully.');
      } else {
        await createExtra(payload);
        setSuccess('Achievement created successfully.');
      }

      resetForm();
      await loadAchievements();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save achievement.');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!selectedItem) {
      return;
    }

    setDeleting(true);
    setError('');
    setSuccess('');

    try {
      await deleteExtra(selectedItem._id);
      closeDeleteModal();
      await loadAchievements();
      setSuccess('Achievement deleted successfully.');
    } catch {
      setError('Unable to delete achievement.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Achievements</h1>
          <p className="mt-1 text-sm text-slate-600">
            Define achievements with subcategories (hikes, treks, temples, routes, quest chains) and targets.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadAchievements()}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
        >
          <FiRefreshCw size={18} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {success}
        </div>
      )}

      <form onSubmit={submitAchievement} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <FiPlus size={16} />
          {editId ? 'Edit Achievement' : 'Create Achievement'}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Title</label>
            <input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Temple Guardian"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Key</label>
            <input
              value={form.key}
              onChange={(event) => setForm((current) => ({ ...current, key: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="temple_guardian"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Subcategory</label>
            <input
              value={form.subcategory}
              onChange={(event) => setForm((current) => ({ ...current, subcategory: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="temples, hikes, treks, difficult_routes"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Target Count</label>
            <input
              value={form.targetCount}
              onChange={(event) => setForm((current) => ({ ...current, targetCount: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. 10"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Reward XP</label>
            <input
              value={form.rewardXp}
              onChange={(event) => setForm((current) => ({ ...current, rewardXp: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Optional XP granted on completion"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Badge Reward</label>
            <input
              value={form.badge}
              onChange={(event) => setForm((current) => ({ ...current, badge: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Optional badge name to assign"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
            <input
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Complete 10 temple visits."
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.hidden}
            onChange={(event) => setForm((current) => ({ ...current, hidden: event.target.checked }))}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          Hidden until completed
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          Enabled
        </label>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FiSave size={18} />
          {saving ? 'Saving...' : editId ? 'Update Achievement' : 'Create Achievement'}
        </button>
      </form>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold">Title</th>
              <th className="px-4 py-3 font-semibold">Key</th>
              <th className="px-4 py-3 font-semibold">Subcategory</th>
              <th className="px-4 py-3 font-semibold text-right">Target</th>
              <th className="px-4 py-3 font-semibold text-right">Reward XP</th>
              <th className="px-4 py-3 font-semibold">Badge</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-center text-slate-500" colSpan={8}>
                  Loading achievements...
                </td>
              </tr>
            ) : parsedRows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-slate-500" colSpan={8}>
                  No achievements found.
                </td>
              </tr>
            ) : (
              parsedRows.map(({ item, parsed }) => (
                <tr key={item._id} className="text-slate-700">
                  <td className="px-4 py-3 font-semibold text-slate-900">{item.name}</td>
                  <td className="px-4 py-3">{parsed?.key ?? '-'}</td>
                  <td className="px-4 py-3">{parsed?.subcategory ?? '-'}</td>
                  <td className="px-4 py-3 text-right">{parsed?.targetCount ?? '-'}</td>
                  <td className="px-4 py-3 text-right">{parsed?.rewardXp ?? '-'}</td>
                  <td className="px-4 py-3">{parsed?.badge ?? '-'}</td>
                  <td className="px-4 py-3">
                    {item.enabled === false ? (
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                        Disabled
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                        Enabled
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(item)}
                        className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => openDeleteModal(item)}
                        className="rounded-lg border border-red-200 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        open={deleteModalOpen}
        title="Delete Achievement"
        description="Are you sure you want to delete this achievement? This action cannot be undone."
        confirmLabel="Delete"
        isProcessing={deleting}
        onCancel={closeDeleteModal}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
