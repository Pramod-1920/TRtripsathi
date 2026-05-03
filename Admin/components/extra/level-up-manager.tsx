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

type LevelUpValuePayload = {
  requiredXp: number;
  minLevel?: number;
  maxLevel?: number;
  subRanks?: string[];
  displayName?: string;
  title?: string;
  feeling?: string;
  requireRank?: string;
  hidden?: boolean;
  requirements?: {
    hikes?: number;
    treks?: number;
    temples?: number;
    routes?: number;
    uniqueLocations?: number;
    difficultRoutes?: number;
    legendaryRoutes?: number;
    questChains?: number;
    achievements?: number;
  };
};

type LevelUpFormState = {
  rankCode: string;
  displayName: string;
  title: string;
  feeling: string;
  requiredXp: string;
  minLevel: string;
  maxLevel: string;
  subRanks: string;
  requireRank: string;
  hikes: string;
  treks: string;
  temples: string;
  routes: string;
  uniqueLocations: string;
  difficultRoutes: string;
  legendaryRoutes: string;
  questChains: string;
  achievements: string;
  hidden: boolean;
  enabled: boolean;
};

const defaultFormState: LevelUpFormState = {
  rankCode: '',
  displayName: '',
  title: '',
  feeling: '',
  requiredXp: '',
  minLevel: '',
  maxLevel: '',
  subRanks: '',
  requireRank: '',
  hikes: '',
  treks: '',
  temples: '',
  routes: '',
  uniqueLocations: '',
  difficultRoutes: '',
  legendaryRoutes: '',
  questChains: '',
  achievements: '',
  hidden: false,
  enabled: true,
};

function parseLevelUpValue(rawValue?: string | null): LevelUpValuePayload | null {
  if (!rawValue?.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<LevelUpValuePayload>;
    const requiredXp = Number(parsed.requiredXp);

    if (!Number.isFinite(requiredXp)) {
      return null;
    }

    return {
      requiredXp,
      ...(parsed.minLevel !== undefined ? { minLevel: Number(parsed.minLevel) } : {}),
      ...(parsed.maxLevel !== undefined ? { maxLevel: Number(parsed.maxLevel) } : {}),
      ...(Array.isArray(parsed.subRanks)
        ? { subRanks: parsed.subRanks.map((entry) => String(entry).trim()).filter((entry) => entry.length > 0) }
        : typeof parsed.subRanks === 'string'
          ? {
              subRanks: String(parsed.subRanks)
                .split(',')
                .map((entry) => entry.trim())
                .filter((entry) => entry.length > 0),
            }
          : {}),
      ...(parsed.displayName ? { displayName: String(parsed.displayName) } : {}),
      ...(parsed.title ? { title: String(parsed.title) } : {}),
      ...(parsed.feeling ? { feeling: String(parsed.feeling) } : {}),
      ...(parsed.requireRank ? { requireRank: String(parsed.requireRank) } : {}),
      ...(parsed.hidden ? { hidden: true } : {}),
      ...(parsed.requirements ? { requirements: parsed.requirements } : {}),
    };
  } catch {
    const requiredXp = Number(rawValue);

    if (!Number.isFinite(requiredXp)) {
      return null;
    }

    return { requiredXp };
  }
}

function buildLevelUpValue(form: LevelUpFormState) {
  const requiredXp = Number(form.requiredXp);

  if (!Number.isFinite(requiredXp) || requiredXp < 0) {
    throw new Error('Required XP must be a number greater than or equal to 0.');
  }

  const requirements: LevelUpValuePayload['requirements'] = {};

  const minLevel = Number(form.minLevel);
  const maxLevel = Number(form.maxLevel);

  if (form.minLevel.trim()) {
    if (!Number.isFinite(minLevel) || minLevel < 1 || minLevel > 100) {
      throw new Error('Minimum level must be between 1 and 100.');
    }
  }

  if (form.maxLevel.trim()) {
    if (!Number.isFinite(maxLevel) || maxLevel < 1 || maxLevel > 100) {
      throw new Error('Maximum level must be between 1 and 100.');
    }
  }

  if (
    form.minLevel.trim()
    && form.maxLevel.trim()
    && minLevel > maxLevel
  ) {
    throw new Error('Minimum level cannot be greater than maximum level.');
  }

  const subRanks = form.subRanks
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  const hikes = Number(form.hikes);
  if (Number.isFinite(hikes) && hikes > 0) {
    requirements.hikes = Math.floor(hikes);
  }

  const treks = Number(form.treks);
  if (Number.isFinite(treks) && treks > 0) {
    requirements.treks = Math.floor(treks);
  }

  const temples = Number(form.temples);
  if (Number.isFinite(temples) && temples > 0) {
    requirements.temples = Math.floor(temples);
  }

  const routes = Number(form.routes);
  if (Number.isFinite(routes) && routes > 0) {
    requirements.routes = Math.floor(routes);
  }

  const uniqueLocations = Number(form.uniqueLocations);
  if (Number.isFinite(uniqueLocations) && uniqueLocations > 0) {
    requirements.uniqueLocations = Math.floor(uniqueLocations);
  }

  const difficultRoutes = Number(form.difficultRoutes);
  if (Number.isFinite(difficultRoutes) && difficultRoutes > 0) {
    requirements.difficultRoutes = Math.floor(difficultRoutes);
  }

  const legendaryRoutes = Number(form.legendaryRoutes);
  if (Number.isFinite(legendaryRoutes) && legendaryRoutes > 0) {
    requirements.legendaryRoutes = Math.floor(legendaryRoutes);
  }

  const questChains = Number(form.questChains);
  if (Number.isFinite(questChains) && questChains > 0) {
    requirements.questChains = Math.floor(questChains);
  }

  const achievements = Number(form.achievements);
  if (Number.isFinite(achievements) && achievements > 0) {
    requirements.achievements = Math.floor(achievements);
  }

  const payload: LevelUpValuePayload = {
    requiredXp: Math.floor(requiredXp),
    ...(form.minLevel.trim() ? { minLevel: Math.floor(minLevel) } : {}),
    ...(form.maxLevel.trim() ? { maxLevel: Math.floor(maxLevel) } : {}),
    ...(subRanks.length > 0 ? { subRanks } : {}),
    ...(form.displayName.trim() ? { displayName: form.displayName.trim() } : {}),
    ...(form.title.trim() ? { title: form.title.trim() } : {}),
    ...(form.feeling.trim() ? { feeling: form.feeling.trim() } : {}),
    ...(form.requireRank.trim() ? { requireRank: form.requireRank.trim() } : {}),
    ...(form.hidden ? { hidden: true } : {}),
    ...(Object.keys(requirements).length > 0 ? { requirements } : {}),
  };

  return JSON.stringify(payload);
}

export function LevelUpManager() {
  const [items, setItems] = useState<ExtraItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ExtraItem | null>(null);
  const [form, setForm] = useState<LevelUpFormState>(defaultFormState);

  async function loadRules() {
    setLoading(true);
    setError('');

    try {
      const response = await fetchExtras('level-up', { page: 1, limit: 200 });
      setItems(response.items);
    } catch {
      setError('Failed to load level-up rules. Please verify backend API and admin session.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRules();
  }, []);

  const parsedRows = useMemo(() => {
    return items.map((item) => {
      const parsed = parseLevelUpValue(item.value);

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
    const parsed = parseLevelUpValue(item.value);

    setEditId(item._id);
    setForm({
      rankCode: item.name ?? '',
      displayName: parsed?.displayName ?? parsed?.title ?? '',
      title: parsed?.title ?? '',
      feeling: parsed?.feeling ?? '',
      requiredXp: parsed?.requiredXp !== undefined ? String(parsed.requiredXp) : '',
      minLevel: parsed?.minLevel !== undefined ? String(parsed.minLevel) : '',
      maxLevel: parsed?.maxLevel !== undefined ? String(parsed.maxLevel) : '',
      subRanks: Array.isArray(parsed?.subRanks) ? parsed.subRanks.join(', ') : '',
      requireRank: parsed?.requireRank ?? '',
      hikes: parsed?.requirements?.hikes !== undefined
        ? String(parsed.requirements.hikes)
        : '',
      treks: parsed?.requirements?.treks !== undefined
        ? String(parsed.requirements.treks)
        : '',
      temples: parsed?.requirements?.temples !== undefined
        ? String(parsed.requirements.temples)
        : '',
      routes: parsed?.requirements?.routes !== undefined
        ? String(parsed.requirements.routes)
        : '',
      uniqueLocations: parsed?.requirements?.uniqueLocations !== undefined
        ? String(parsed.requirements.uniqueLocations)
        : '',
      difficultRoutes: parsed?.requirements?.difficultRoutes !== undefined
        ? String(parsed.requirements.difficultRoutes)
        : '',
      legendaryRoutes: parsed?.requirements?.legendaryRoutes !== undefined
        ? String(parsed.requirements.legendaryRoutes)
        : '',
      questChains: parsed?.requirements?.questChains !== undefined
        ? String(parsed.requirements.questChains)
        : '',
      achievements: parsed?.requirements?.achievements !== undefined
        ? String(parsed.requirements.achievements)
        : '',
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

  async function submitRule(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!form.rankCode.trim()) {
      setError('Rank code is required.');
      return;
    }

    setSaving(true);

    try {
      const value = buildLevelUpValue(form);
      const payload = {
        category: 'level-up' as const,
        name: form.rankCode.trim(),
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
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Level Up</h1>
          <p className="mt-1 text-sm text-slate-600">
            Configure rank progression rules. User level is now computed on a 1-100 XP progression curve.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadRules()}
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

      <form onSubmit={submitRule} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <FiPlus size={16} />
          {editId ? 'Edit Level-Up Rule' : 'Create Level-Up Rule'}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Rank Code</label>
            <input
              value={form.rankCode}
              onChange={(event) => setForm((current) => ({ ...current, rankCode: event.target.value }))}
                disabled={!!editId}
                className={`w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${editId ? 'bg-slate-100 cursor-not-allowed text-slate-500' : ''}`}
                title={editId ? 'Rank code cannot be changed after creation' : ''}
              placeholder="e.g. E, D, C"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Display Name</label>
            <input
              value={form.displayName}
              onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Novice Wanderer"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Required XP</label>
            <input
              value={form.requiredXp}
              onChange={(event) => setForm((current) => ({ ...current, requiredXp: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. 300"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Minimum Level</label>
            <input
              value={form.minLevel}
              onChange={(event) => setForm((current) => ({ ...current, minLevel: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. 1"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Maximum Level</label>
            <input
              value={form.maxLevel}
              onChange={(event) => setForm((current) => ({ ...current, maxLevel: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. 10"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Sub-Ranks</label>
            <input
              value={form.subRanks}
              onChange={(event) => setForm((current) => ({ ...current, subRanks: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Spark, Path, Rise"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Requires Rank</label>
            <input
              value={form.requireRank}
              onChange={(event) => setForm((current) => ({ ...current, requireRank: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. SSS (optional)"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Title</label>
            <input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Novice Wanderer"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Feeling</label>
            <input
              value={form.feeling}
              onChange={(event) => setForm((current) => ({ ...current, feeling: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Beginner"
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">Achievement requirements (optional)</p>
          <p className="text-xs text-slate-600">Only promote if the user has these counts in their achievement stats.</p>
          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Hikes</label>
              <input
                value={form.hikes}
                onChange={(event) => setForm((current) => ({ ...current, hikes: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. 15"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Treks</label>
              <input
                value={form.treks}
                onChange={(event) => setForm((current) => ({ ...current, treks: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. 5"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Temples</label>
              <input
                value={form.temples}
                onChange={(event) => setForm((current) => ({ ...current, temples: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. 10"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Routes</label>
              <input
                value={form.routes}
                onChange={(event) => setForm((current) => ({ ...current, routes: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. 8"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Unique Locations</label>
              <input
                value={form.uniqueLocations}
                onChange={(event) => setForm((current) => ({ ...current, uniqueLocations: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. 12"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Difficult Routes</label>
              <input
                value={form.difficultRoutes}
                onChange={(event) => setForm((current) => ({ ...current, difficultRoutes: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. 5"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Legendary Routes</label>
              <input
                value={form.legendaryRoutes}
                onChange={(event) => setForm((current) => ({ ...current, legendaryRoutes: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. 3"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Quest Chains</label>
              <input
                value={form.questChains}
                onChange={(event) => setForm((current) => ({ ...current, questChains: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. 1"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Achievements</label>
              <input
                value={form.achievements}
                onChange={(event) => setForm((current) => ({ ...current, achievements: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. 25"
              />
            </div>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.hidden}
            onChange={(event) => setForm((current) => ({ ...current, hidden: event.target.checked }))}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          Hidden until eligible
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
          {saving ? 'Saving...' : editId ? 'Update Rule' : 'Create Rule'}
        </button>
      </form>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
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
                <tr key={item._id} className="text-slate-700">
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
                    {parsed?.requirements
                      ? Object.entries(parsed.requirements)
                          .filter(([, value]) => value !== undefined)
                          .map(([key, value]) => `${key}: ${value}`)
                          .join(', ')
                      : '-'}
                  </td>
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
