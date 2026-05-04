'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { FiEdit2, FiRefreshCw } from 'react-icons/fi';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { deleteExtra, ExtraItem, fetchExtras, updateExtra } from '@/lib/extras';
import { parseAchievementValue } from './achievement-shared';

export function AchievementViewManager() {
  const [items, setItems] = useState<ExtraItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ExtraItem | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function loadAchievements() {
    setLoading(true);
    setError('');

    try {
      const response = await fetchExtras('achievement', { page: 1, limit: 300 });
      setItems(response.items);
    } catch {
      setError('Failed to load achievements.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAchievements();
  }, []);

  const parsedRows = useMemo(() => {
    return items.map((item) => ({
      item,
      parsed: parseAchievementValue(item.value),
    }));
  }, [items]);

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
      setSuccess('Achievement deleted successfully.');
      await loadAchievements();
    } catch {
      setError('Unable to delete achievement.');
    } finally {
      setDeleting(false);
    }
  }

  async function toggleEnabled(item: ExtraItem) {
    setError('');
    setSuccess('');

    try {
      await updateExtra(item._id, {
        category: 'achievement',
        name: item.name,
        description: item.description ?? undefined,
        value: item.value ?? undefined,
        enabled: item.enabled === false,
        adminApprovalRequired: item.adminApprovalRequired,
      });

      setSuccess(
        `Achievement ${item.enabled === false ? 'enabled' : 'disabled'} successfully.`,
      );
      await loadAchievements();
    } catch {
      setError('Unable to update achievement status.');
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">View Achievements</h1>
          <p className="mt-1 text-sm text-slate-600">
            Review definitions and status. User progress is awarded automatically from XP activity.
          </p>
        </div>
        <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-1">
          <Link
            href="/extra/achievement/add"
            className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Add
          </Link>
          <Link
            href="/extra/achievement/view"
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
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

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <p className="text-sm font-medium text-slate-700">
            Total: {parsedRows.length}
          </p>
          <button
            type="button"
            onClick={() => void loadAchievements()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <FiRefreshCw size={14} />
            Refresh
          </button>
        </div>
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold">Title</th>
              <th className="px-4 py-3 font-semibold">Key</th>
              <th className="px-4 py-3 font-semibold">Subcategory</th>
              <th className="px-4 py-3 font-semibold text-right">Target</th>
              <th className="px-4 py-3 font-semibold text-right">Reward XP</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-center text-slate-500" colSpan={7}>
                  Loading achievements...
                </td>
              </tr>
            ) : parsedRows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-slate-500" colSpan={7}>
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
                      <Link
                        href={`/extra/achievement/add?edit=${item._id}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-blue-200 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
                      >
                        <FiEdit2 size={12} />
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => void toggleEnabled(item)}
                        className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        {item.enabled === false ? 'Enable' : 'Disable'}
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
