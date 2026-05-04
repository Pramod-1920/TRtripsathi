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
import type { LevelUpFormState } from './level-up-manager.types';
import {
  buildLevelUpEditForm,
  buildLevelUpValue,
  formatLevelUpRequirements,
  getDefaultLevelUpFormState,
  parseLevelUpValue,
} from './level-up-manager.utils';

const RANK_OPTIONS = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS', 'Mythic', 'Heroic'] as const;

function normalizeActivityKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '_');
}

function normalizeRankInput(value: string) {
  const normalized = value.trim().toLowerCase();

  if (normalized === 'mythic' || normalized === 'ultimate') {
    return 'Mythic';
  }

  if (normalized === 'heroic') {
    return 'Heroic';
  }

  return normalized.toUpperCase();
}

export function LevelUpManager() {
  const [items, setItems] = useState<ExtraItem[]>([]);
  const [activityOptions, setActivityOptions] = useState<Array<{ key: string; label: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ExtraItem | null>(null);
  const [form, setForm] = useState<LevelUpFormState>(getDefaultLevelUpFormState());

  async function loadRules() {
    setLoading(true);
    setError('');

    try {
      const [levelUpResponse, activitiesResponse] = await Promise.all([
        fetchExtras('level-up', { page: 1, limit: 200 }),
        fetchExtras('activities', { page: 1, limit: 200 }),
      ]);
      setItems(levelUpResponse.items);
      setActivityOptions(
        activitiesResponse.items
          .filter((item) => item.enabled !== false)
          .map((item) => {
            const label = item.name?.trim() ?? '';
            return {
              key: normalizeActivityKey(label),
              label,
            };
          })
          .filter((item) => item.key.length > 0 && item.label.length > 0)
          .sort((first, second) => first.label.localeCompare(second.label)),
      );
    } catch {
      setError('Failed to load level-up rules. Please verify backend API and admin session.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRules();
  }, []);

  useEffect(() => {
    if (activityOptions.length === 0) {
      return;
    }

    setForm((current) => {
      const nextRequirements = { ...current.activityRequirements };

      for (const activity of activityOptions) {
        if (nextRequirements[activity.key] === undefined) {
          nextRequirements[activity.key] = '';
        }
      }

      return {
        ...current,
        activityRequirements: nextRequirements,
      };
    });
  }, [activityOptions]);

  const parsedRows = useMemo(() => {
    return items.map((item) => {
      const parsed = parseLevelUpValue(item.value);

      return {
        item,
        parsed,
      };
    }).sort((first, second) => {
      const firstXp = Number(first.parsed?.requiredXp ?? Number.MAX_SAFE_INTEGER);
      const secondXp = Number(second.parsed?.requiredXp ?? Number.MAX_SAFE_INTEGER);
      return firstXp - secondXp;
    });
  }, [items]);

  const enabledRulesCount = useMemo(
    () => parsedRows.filter((row) => row.item.enabled !== false).length,
    [parsedRows],
  );
  const hiddenRulesCount = useMemo(
    () => parsedRows.filter((row) => row.parsed?.hidden).length,
    [parsedRows],
  );
  const rankOptions = useMemo(() => {
    const collected = new Map<string, number>();

    for (const [index, rank] of RANK_OPTIONS.entries()) {
      collected.set(rank, index);
    }

    for (const item of items) {
      const normalizedRank = normalizeRankInput(item.name ?? '');
      if (!normalizedRank) {
        continue;
      }

      if (!collected.has(normalizedRank)) {
        collected.set(normalizedRank, Number.MAX_SAFE_INTEGER);
      }
    }

    return Array.from(collected.entries())
      .sort((first, second) => first[1] - second[1] || first[0].localeCompare(second[0]))
      .map(([rank]) => rank);
  }, [items]);

  function updateFormField<Key extends keyof LevelUpFormState>(key: Key, value: LevelUpFormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function resetForm() {
    setForm({
      ...getDefaultLevelUpFormState(),
      activityRequirements: Object.fromEntries(
        activityOptions.map((activity) => [activity.key, '']),
      ),
    });
    setEditId(null);
  }

  function startEdit(item: ExtraItem) {
    setEditId(item._id);
    const nextForm = buildLevelUpEditForm(item);
    const mergedRequirements = { ...nextForm.activityRequirements };

    for (const activity of activityOptions) {
      if (mergedRequirements[activity.key] === undefined) {
        mergedRequirements[activity.key] = '';
      }
    }

    setForm({
      ...nextForm,
      activityRequirements: mergedRequirements,
    });
  }

  function updateActivityRequirement(activityKey: string, value: string) {
    setForm((current) => ({
      ...current,
      activityRequirements: {
        ...current.activityRequirements,
        [activityKey]: value,
      },
    }));
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

  async function submitRule(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setSuccess('');

    const normalizedRankCode = normalizeRankInput(form.rankCode);

    if (!normalizedRankCode) {
      setError('Rank code is required.');
      return;
    }

    if (
      items.some(
        (item) => normalizeRankInput(item.name ?? '') === normalizedRankCode && item._id !== editId,
      )
    ) {
      setError(`A rule for rank ${normalizedRankCode} already exists.`);
      return;
    }

    setSaving(true);

    try {
      const value = buildLevelUpValue(
        form,
        activityOptions.map((activity) => activity.key),
      );
      const payload = {
        category: 'level-up' as const,
        name: normalizedRankCode,
        value,
        enabled: form.enabled,
      };

      if (editId) {
        await updateExtra(editId, payload);
        setSuccess('Level-up rule updated successfully.');
      } else {
        await createExtra(payload);
        setSuccess('Level-up rule created successfully.');
      }

      resetForm();
      await loadRules();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save level-up rule.');
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
      await loadRules();
      setSuccess('Level-up rule deleted successfully.');
    } catch {
      setError('Unable to delete level-up rule.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 to-slate-800 p-6 text-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold lg:text-3xl">Level Up Rules</h1>
            <p className="mt-2 text-sm text-slate-200">
              Configure rank progression rules across fixed ranks and requirement gates.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadRules()}
            className="inline-flex items-center gap-2 rounded-lg bg-white/15 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/25"
          >
            <FiRefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total Rules</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{parsedRows.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Enabled</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{enabledRulesCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Hidden Rules</p>
          <p className="mt-2 text-2xl font-bold text-amber-600">{hiddenRulesCount}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            {editId ? 'Edit Level-Up Rule' : 'Create Level-Up Rule'}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Default users start from rank F. You can add new ranks or edit current rank codes.
          </p>
        </div>
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

      <form onSubmit={submitRule} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <FiPlus size={16} />
          Rule details
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Rank Code</label>
            <input
              value={form.rankCode}
              onChange={(event) => updateFormField('rankCode', event.target.value)}
              list="level-up-rank-options"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. F, E, D, Heroic"
            />
            <datalist id="level-up-rank-options">
              {rankOptions.map((rank) => (
                <option key={rank} value={rank} />
              ))}
            </datalist>
            <p className="mt-1 text-xs text-slate-500">
              Recommended order: F → E → D → C → B → A → S → SS → SSS → Mythic → Heroic
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Display Name</label>
            <input
              value={form.displayName}
              onChange={(event) => updateFormField('displayName', event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Novice Wanderer"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Required XP</label>
            <input
              type="number"
              min={0}
              value={form.requiredXp}
              onChange={(event) => updateFormField('requiredXp', event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. 300"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Minimum Level</label>
            <input
              type="number"
              min={1}
              max={100}
              value={form.minLevel}
              onChange={(event) => updateFormField('minLevel', event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. 1"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Maximum Level</label>
            <input
              type="number"
              min={1}
              max={100}
              value={form.maxLevel}
              onChange={(event) => updateFormField('maxLevel', event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. 10"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Sub-Ranks</label>
            <input
              value={form.subRanks}
              onChange={(event) => updateFormField('subRanks', event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Spark, Path, Rise"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Requires Rank</label>
            <select
              value={form.requireRank}
              onChange={(event) => updateFormField('requireRank', event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">No rank gate</option>
              {rankOptions.map((rank) => (
                <option key={rank} value={rank}>
                  {rank}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Title</label>
            <input
              value={form.title}
              onChange={(event) => updateFormField('title', event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Novice Wanderer"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Feeling</label>
            <input
              value={form.feeling}
              onChange={(event) => updateFormField('feeling', event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Beginner"
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">Achievement requirements (optional)</p>
          <p className="text-xs text-slate-600">
            These requirements are tied to Activities. New activities appear here automatically.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
            {activityOptions.length === 0 ? (
              <div className="md:col-span-3 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600">
                No activity found. Add activities in Extra → Activities first.
              </div>
            ) : (
              activityOptions.map((activity) => (
                <div key={activity.key}>
                  <label className="mb-1 block text-xs font-medium text-slate-600">{activity.label}</label>
                  <input
                    type="number"
                    min={0}
                    value={form.activityRequirements[activity.key] ?? ''}
                    onChange={(event) => updateActivityRequirement(activity.key, event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={`Required ${activity.label} count`}
                  />
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
          <div className="flex flex-wrap gap-5">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.hidden}
                onChange={(event) => updateFormField('hidden', event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Hidden until eligible
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(event) => updateFormField('enabled', event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Enabled
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {editId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Cancel edit
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiSave size={18} />
              {saving ? 'Saving...' : editId ? 'Update Rule' : 'Create Rule'}
            </button>
          </div>
        </div>
      </form>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">Configured rules</h3>
          <p className="mt-1 text-xs text-slate-600">Rules are sorted by required XP in ascending order.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold">Rank</th>
              <th className="px-4 py-3 font-semibold">Display Name</th>
              <th className="px-4 py-3 font-semibold">Level Range</th>
              <th className="px-4 py-3 font-semibold">Sub-Ranks</th>
              <th className="px-4 py-3 font-semibold">Feeling</th>
              <th className="px-4 py-3 font-semibold text-right">Required XP</th>
              <th className="px-4 py-3 font-semibold">Requirements</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-500" colSpan={9}>
                    Loading level-up rules...
                  </td>
                </tr>
              ) : parsedRows.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-500" colSpan={9}>
                    No level-up rules found.
                  </td>
                </tr>
              ) : (
                parsedRows.map(({ item, parsed }) => (
                  <tr key={item._id} className="text-slate-700 hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-semibold text-slate-900">{item.name}</td>
                    <td className="px-4 py-3">{parsed?.displayName ?? parsed?.title ?? '-'}</td>
                    <td className="px-4 py-3">
                      {parsed?.minLevel !== undefined || parsed?.maxLevel !== undefined
                        ? `${parsed?.minLevel ?? '?'} - ${parsed?.maxLevel ?? '?'}`
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {parsed?.subRanks?.length ? parsed.subRanks.join(', ') : '-'}
                    </td>
                    <td className="px-4 py-3">{parsed?.feeling ?? '-'}</td>
                    <td className="px-4 py-3 text-right">{parsed?.requiredXp ?? '-'}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {formatLevelUpRequirements(parsed?.requirements)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {item.enabled === false ? (
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                            Disabled
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                            Enabled
                          </span>
                        )}
                        {parsed?.hidden && (
                          <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">
                            Hidden
                          </span>
                        )}
                      </div>
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
      </div>

      <ConfirmModal
        open={deleteModalOpen}
        title="Delete Level-Up Rule"
        description="Are you sure you want to delete this level-up rule? This action cannot be undone."
        confirmLabel="Delete"
        isProcessing={deleting}
        onCancel={closeDeleteModal}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
