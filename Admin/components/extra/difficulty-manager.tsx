'use client';

import { useEffect, useMemo, useState } from 'react';
import { FiArrowDown, FiArrowUp, FiPlus, FiRefreshCw, FiSave } from 'react-icons/fi';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import {
  DEFAULT_DIFFICULTY_TIERS,
  DifficultyTier,
  DifficultyValidationError,
  fetchDifficultySettings,
  saveDifficultySettings,
} from '@/lib/extras';

type FieldErrorMap = Record<string, string>;

function withSequentialOrder(items: DifficultyTier[]) {
  return items.map((item, index) => ({ ...item, order: index + 1 }));
}

function cloneDefaultDifficulties() {
  return DEFAULT_DIFFICULTY_TIERS.map((item) => ({ ...item }));
}

function createNewDifficultyId(items: DifficultyTier[]) {
  const used = new Set(items.map((item) => item.id.trim().toLowerCase()).filter(Boolean));
  let index = 1;

  while (used.has(`new_${index}`)) {
    index += 1;
  }

  return `new_${index}`;
}

function buildFieldErrors(errors: DifficultyValidationError[]): FieldErrorMap {
  const result: FieldErrorMap = {};

  errors.forEach((error) => {
    const key = `${error.index}:${error.field}`;
    if (!result[key]) {
      result[key] = error.message;
    }
  });

  return result;
}

function getLocalValidationErrors(items: DifficultyTier[]): DifficultyValidationError[] {
  const errors: DifficultyValidationError[] = [];
  const usedIds = new Set<string>();

  if (items.length === 0) {
    errors.push({
      index: -1,
      field: 'root',
      message: 'At least one difficulty is required.',
    });
  }

  items.forEach((item, index) => {
    const id = item.id.trim();
    const label = item.label.trim();
    const normalizedId = id.toLowerCase();

    if (!id) {
      errors.push({ index, field: 'id', message: 'ID is required.' });
    }

    if (!label) {
      errors.push({ index, field: 'label', message: 'Label is required.' });
    }

    if (normalizedId) {
      if (usedIds.has(normalizedId)) {
        errors.push({
          index,
          field: 'id',
          message: 'Duplicate ID values are not allowed.',
        });
      } else {
        usedIds.add(normalizedId);
      }
    }
  });

  return errors;
}

export function DifficultyManager() {
  const [rows, setRows] = useState<DifficultyTier[]>([]);
  const [lockedIds, setLockedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrorMap>({});
  const [resetModalOpen, setResetModalOpen] = useState(false);

  async function loadDifficulties() {
    setLoading(true);
    setError('');
    setSuccess('');
    setFieldErrors({});

    try {
      const settings = await fetchDifficultySettings();
      setRows(withSequentialOrder(settings));
      setLockedIds(new Set(settings.map((item) => item.id.trim().toLowerCase()).filter(Boolean)));
    } catch {
      setError('Failed to load difficulty settings.');
      setRows([]);
      setLockedIds(new Set());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDifficulties();
  }, []);

  const hasRows = rows.length > 0;

  const rowErrorIndexes = useMemo(() => {
    const indexes = new Set<number>();

    Object.keys(fieldErrors).forEach((key) => {
      const [indexText] = key.split(':');
      const index = Number(indexText);
      if (Number.isFinite(index) && index >= 0) {
        indexes.add(index);
      }
    });

    return indexes;
  }, [fieldErrors]);

  function getError(index: number, field: DifficultyValidationError['field']) {
    return fieldErrors[`${index}:${field}`] ?? '';
  }

  function updateRow(index: number, next: DifficultyTier) {
    setRows((current) => withSequentialOrder(current.map((row, rowIndex) => (rowIndex === index ? next : row))));
  }

  function moveRow(index: number, direction: -1 | 1) {
    setRows((current) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= current.length) {
        return current;
      }

      const next = [...current];
      const [selected] = next.splice(index, 1);
      next.splice(targetIndex, 0, selected);
      return withSequentialOrder(next);
    });
  }

  function addDifficulty() {
    const placeholderId = createNewDifficultyId(rows);
    setRows((current) => withSequentialOrder([
      ...current,
      {
        id: placeholderId,
        label: '',
        adminApprovalRequired: false,
        xpMultiplier: 1,
        order: current.length + 1,
        enabled: true,
      },
    ]));
  }

  function resetToDefaults() {
    setRows(cloneDefaultDifficulties());
    setLockedIds(new Set(cloneDefaultDifficulties().map((item) => item.id.toLowerCase())));
    setFieldErrors({});
    setError('');
    setSuccess('Defaults loaded. Click Save to persist changes.');
    setResetModalOpen(false);
  }

  async function handleSave() {
    setError('');
    setSuccess('');
    setFieldErrors({});

    const localErrors = getLocalValidationErrors(rows);
    if (localErrors.length > 0) {
      setFieldErrors(buildFieldErrors(localErrors));
      setError('Please fix validation errors before saving.');
      return;
    }

    setSaving(true);

    try {
      const saved = await saveDifficultySettings(withSequentialOrder(rows));
      setRows(withSequentialOrder(saved));
      setLockedIds(new Set(saved.map((item) => item.id.trim().toLowerCase()).filter(Boolean)));
      setSuccess('Difficulty settings saved.');
      setFieldErrors({});
    } catch (err) {
      const apiErrors = (
        err as {
          response?: {
            data?: {
              errors?: DifficultyValidationError[];
            };
          };
        }
      ).response?.data?.errors;

      if (Array.isArray(apiErrors) && apiErrors.length > 0) {
        setFieldErrors(buildFieldErrors(apiErrors));
        setError('Validation failed. Review highlighted fields.');
      } else {
        setError('Unable to save difficulty settings.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Difficulty</h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage campaign difficulty tiers, approval behavior, and ordering.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void loadDifficulties()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <FiRefreshCw size={16} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setResetModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-amber-300 px-4 py-2 text-sm text-amber-800 hover:bg-amber-50"
          >
            Reset to Defaults
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || loading}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FiSave size={16} />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div>}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[780px] w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Label</th>
              <th className="px-4 py-3">Admin Approval</th>
              <th className="px-4 py-3">Enabled</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                  Loading difficulty settings...
                </td>
              </tr>
            )}

            {!loading && !hasRows && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                  No difficulty tiers found.
                </td>
              </tr>
            )}

            {!loading && rows.map((row, index) => {
              const disabledRow = row.enabled === false;
              const hasRowError = rowErrorIndexes.has(index);
              const normalizedId = row.id.trim().toLowerCase();
              const idLocked = Boolean(normalizedId) && lockedIds.has(normalizedId);

              return (
                <tr
                  key={`${row.id || 'new'}-${index}`}
                  className={`${disabledRow ? 'bg-slate-50 text-slate-500' : ''} ${hasRowError ? 'bg-red-50/60' : ''}`}
                >
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-md bg-slate-100 px-2 text-xs font-semibold text-slate-700">
                        {row.order}
                      </span>
                      <button
                        type="button"
                        onClick={() => moveRow(index, -1)}
                        disabled={index === 0}
                        className="rounded border border-slate-300 p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                      >
                        <FiArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveRow(index, 1)}
                        disabled={index === rows.length - 1}
                        className="rounded border border-slate-300 p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                      >
                        <FiArrowDown size={14} />
                      </button>
                    </div>
                  </td>

                  <td className="px-4 py-3 align-top">
                    {idLocked ? (
                      <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm text-slate-700">
                        {row.id}
                      </div>
                    ) : (
                      <input
                        value={row.id}
                        onChange={(event) => updateRow(index, { ...row, id: event.target.value })}
                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="new_1"
                      />
                    )}
                    {idLocked && <p className="mt-1 text-xs text-slate-500">ID is permanent after creation.</p>}
                    {getError(index, 'id') && <p className="mt-1 text-xs text-red-600">{getError(index, 'id')}</p>}
                  </td>

                  <td className="px-4 py-3 align-top">
                    <input
                      value={row.label}
                      onChange={(event) => updateRow(index, { ...row, label: event.target.value })}
                      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Easy"
                    />
                    {getError(index, 'label') && <p className="mt-1 text-xs text-red-600">{getError(index, 'label')}</p>}
                  </td>

                  <td className="px-4 py-3 align-top">
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={row.adminApprovalRequired}
                        onChange={(event) => updateRow(index, { ...row, adminApprovalRequired: event.target.checked })}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Required</span>
                    </label>
                    {getError(index, 'adminApprovalRequired') && (
                      <p className="mt-1 text-xs text-red-600">{getError(index, 'adminApprovalRequired')}</p>
                    )}
                  </td>

                  <td className="px-4 py-3 align-top">
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={row.enabled}
                        onChange={(event) => updateRow(index, { ...row, enabled: event.target.checked })}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>{row.enabled ? 'Enabled' : 'Disabled'}</span>
                    </label>
                    {getError(index, 'enabled') && <p className="mt-1 text-xs text-red-600">{getError(index, 'enabled')}</p>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={addDifficulty}
        className="inline-flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        <FiPlus size={16} />
        Add Difficulty
      </button>

      <ConfirmModal
        open={resetModalOpen}
        title="Reset difficulty tiers?"
        description="This will replace the entire difficulty list with the five default tiers. Continue?"
        confirmLabel="Reset"
        cancelLabel="Cancel"
        onConfirm={resetToDefaults}
        onCancel={() => setResetModalOpen(false)}
      />
    </div>
  );
}
