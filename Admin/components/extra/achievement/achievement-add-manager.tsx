'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { FiPlus, FiRefreshCw, FiSave } from 'react-icons/fi';
import { createExtra, ExtraItem, fetchExtras, updateExtra } from '@/lib/extras';
import {
  achievementSubcategoryPresets,
  achievementTemplates,
  buildAchievementValue,
  defaultAchievementFormState,
  parseAchievementValue,
  type AchievementFormState,
} from './achievement-shared';

export function AchievementAddManager() {
  const [items, setItems] = useState<ExtraItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const queryEditId = searchParams.get('edit');
  const [form, setForm] = useState<AchievementFormState>(
    defaultAchievementFormState,
  );

  async function loadAchievements() {
    setLoading(true);
    setError('');

    try {
      const response = await fetchExtras('achievement', { page: 1, limit: 200 });
      setItems(response.items);
    } catch {
      setError(
        'Failed to load achievements. Please verify backend API and admin session.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAchievements();
  }, []);

  const parsedRows = useMemo(() => {
    return items
      .map((item) => ({
        item,
        parsed: parseAchievementValue(item.value),
      }))
      .filter(({ parsed }) => Boolean(parsed));
  }, [items]);

  useEffect(() => {
    if (!queryEditId) {
      setEditId(null);
      return;
    }

    const editable = parsedRows.find(({ item }) => item._id === queryEditId);
    if (!editable || !editable.parsed) {
      return;
    }

    setEditId(editable.item._id);
    setForm({
      title: editable.item.name ?? '',
      description: editable.item.description ?? '',
      key: editable.parsed.key ?? '',
      subcategory: editable.parsed.subcategory ?? '',
      targetCount:
        editable.parsed.targetCount !== undefined
          ? String(editable.parsed.targetCount)
          : '',
      rewardXp:
        editable.parsed.rewardXp !== undefined
          ? String(editable.parsed.rewardXp)
          : '',
      hidden: editable.parsed.hidden ?? false,
      enabled: editable.item.enabled !== false,
    });
  }, [parsedRows, queryEditId]);

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
        category: 'achievement',
        name: form.title.trim(),
        description: form.description.trim() || undefined,
        value,
        enabled: form.enabled,
      } as const;

      if (editId) {
        await updateExtra(editId, payload);
      } else {
        await createExtra(payload);
      }

      setSuccess(editId ? 'Achievement updated successfully.' : 'Achievement created successfully.');
      setForm(defaultAchievementFormState);
      setEditId(null);
      await loadAchievements();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save achievement.');
    } finally {
      setSaving(false);
    }
  }

  function generateKeyFromTitle() {
    if (!form.title.trim()) {
      return;
    }

    const key = form.title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    setForm((current) => ({ ...current, key }));
  }

  function applyTemplate(template: (typeof achievementTemplates)[number]) {
    const generatedKey = template.title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    setForm((current) => ({
      ...current,
      title: template.title,
      subcategory: template.subcategory,
      targetCount: template.targetCount,
      rewardXp: template.rewardXp,
      description: template.description,
      key: generatedKey,
    }));
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Add Achievement</h1>
          <p className="mt-1 text-sm text-slate-600">
            Create achievement rules once. Progress is now auto-tracked from user XP events.
          </p>
        </div>
        <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-1">
          <Link
            href="/extra/achievement/add"
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
          >
            Add
          </Link>
          <Link
            href="/extra/achievement/view"
            className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            View
          </Link>
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

      <form
        onSubmit={submitAchievement}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4"
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <FiPlus size={14} />
          {editId ? 'Edit Achievement' : 'Create Achievement'}
        </div>

        <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          Achievements are one-time objectives by default. Once completed by a user, the same achievement will not unlock again.
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Quick templates
          </p>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {achievementTemplates.map((template) => (
              <button
                key={template.label}
                type="button"
                onClick={() => applyTemplate(template)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left hover:bg-slate-50"
              >
                <p className="text-xs font-semibold text-slate-800">{template.label}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {template.subcategory} • target {template.targetCount} • XP {template.rewardXp}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {achievementSubcategoryPresets.map((subcategory) => (
            <button
              key={subcategory}
              type="button"
              onClick={() => setForm((current) => ({ ...current, subcategory }))}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              {subcategory}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Title</label>
            <input
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({ ...current, title: event.target.value }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Temple Guardian"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Key
            </label>
            <div className="flex gap-2">
              <input
                value={form.key}
                onChange={(event) =>
                  setForm((current) => ({ ...current, key: event.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="temple_guardian"
              />
              <button
                type="button"
                onClick={generateKeyFromTitle}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Generate
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Subcategory
            </label>
            <input
              value={form.subcategory}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  subcategory: event.target.value,
                }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="treks"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Target Count
            </label>
            <input
              value={form.targetCount}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  targetCount: event.target.value,
                }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. 10"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Reward XP (required)
            </label>
            <input
              type="number"
              min={1}
              value={form.rewardXp}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  rewardXp: event.target.value,
                }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. 120"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Description
            </label>
            <input
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Complete 10 temple visits."
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.hidden}
            onChange={(event) =>
              setForm((current) => ({ ...current, hidden: event.target.checked }))
            }
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          Hidden until completed
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(event) =>
              setForm((current) => ({ ...current, enabled: event.target.checked }))
            }
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          Enabled
        </label>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FiSave size={16} />
          {saving ? 'Saving...' : editId ? 'Update Achievement' : 'Create Achievement'}
        </button>
      </form>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Existing Achievements ({parsedRows.length})
          </h2>
          <button
            type="button"
            onClick={() => void loadAchievements()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <FiRefreshCw size={14} />
            Refresh
          </button>
        </div>
        {loading ? (
          <p className="text-sm text-slate-500">Loading achievements...</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {parsedRows.slice(0, 12).map(({ item, parsed }) => (
              <button
                key={item._id}
                type="button"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    title: item.name ?? current.title,
                    description: item.description ?? '',
                    key: parsed?.key ?? current.key,
                    subcategory: parsed?.subcategory ?? current.subcategory,
                    targetCount:
                      parsed?.targetCount !== undefined
                        ? String(parsed.targetCount)
                        : current.targetCount,
                    rewardXp:
                      parsed?.rewardXp !== undefined
                        ? String(parsed.rewardXp)
                        : '',
                    hidden: parsed?.hidden ?? false,
                    enabled: item.enabled !== false,
                  }))
                }
                className="rounded-xl border border-slate-200 p-4 text-left hover:bg-slate-50"
              >
                <p className="font-semibold text-slate-900">{item.name}</p>
                <p className="mt-1 text-xs text-slate-600">
                  {parsed?.subcategory ?? '-'} • target {parsed?.targetCount ?? '-'}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
