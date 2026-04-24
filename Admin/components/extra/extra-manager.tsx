'use client';

import { useEffect, useMemo, useState } from 'react';
import { FiCopy, FiEdit2, FiPlus, FiRefreshCw, FiSave, FiSearch, FiTrash2 } from 'react-icons/fi';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import {
  createExtra,
  deleteExtra,
  ExtraCategory,
  ExtraItem,
  fetchExtras,
  updateExtra,
} from '@/lib/extras';

type ExtraManagerProps = {
  category: ExtraCategory;
  title: string;
  description: string;
  itemLabel: string;
  showValueField?: boolean;
  showDescriptionField?: boolean;
  valueLabel?: string;
  valuePlaceholder?: string;
  valueColumnLabel?: string;
  descriptionLabel?: string;
  descriptionPlaceholder?: string;
};

type ExtraFormState = {
  name: string;
  description: string;
  value: string;
  enabled: boolean;
};

const defaultFormState: ExtraFormState = {
  name: '',
  description: '',
  value: '',
  enabled: true,
};

export function ExtraManager({
  category,
  title,
  description,
  itemLabel,
  showValueField = true,
  showDescriptionField = true,
  valueLabel = 'Value',
  valuePlaceholder = 'Optional value',
  valueColumnLabel = 'Value',
  descriptionLabel = 'Description',
  descriptionPlaceholder = 'Optional description',
}: ExtraManagerProps) {
  const [items, setItems] = useState<ExtraItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ExtraItem | null>(null);
  const [form, setForm] = useState<ExtraFormState>(defaultFormState);

  async function loadItems(targetPage = page) {
    setLoading(true);
    setError('');

    try {
      const response = await fetchExtras(category, { page: targetPage, limit });
      setItems(response.items);
      setPage(response.pagination.page);
      setTotalPages(response.pagination.totalPages);
      setTotalItems(response.pagination.total);
    } catch {
      setError(`Failed to load ${title.toLowerCase()} from backend.`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadItems(page);
  }, [category, page, limit]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return items;
    }

    return items.filter((item) => {
      return (
        item.name.toLowerCase().includes(query)
        || (item.extraCode ?? '').toLowerCase().includes(query)
        || (showValueField && (item.value ?? '').toLowerCase().includes(query))
        || (showDescriptionField && (item.description ?? '').toLowerCase().includes(query))
      );
    });
  }, [items, search, showDescriptionField, showValueField]);

  function resetForm() {
    setForm(defaultFormState);
    setEditId(null);
  }

  function startEdit(item: ExtraItem) {
    setEditId(item._id);
    setForm({
      name: item.name ?? '',
      description: item.description ?? '',
      value: item.value ?? '',
      enabled: item.enabled ?? true,
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

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!form.name.trim()) {
      setError('Name is required.');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        category,
        name: form.name.trim(),
        ...(showDescriptionField
          ? (form.description.trim() ? { description: form.description.trim() } : {})
          : (editId ? { description: '' } : {})),
        ...(showValueField
          ? (form.value.trim() ? { value: form.value.trim() } : {})
          : (editId ? { value: '' } : {})),
        enabled: form.enabled,
      };

      if (editId) {
        await updateExtra(editId, payload);
        setSuccess(`${title} updated successfully.`);
      } else {
        await createExtra(payload);
        setSuccess(`${title} created successfully.`);
      }

      resetForm();
      await loadItems(page);
    } catch {
      setError(`Unable to save ${title.toLowerCase()}.`);
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
      const nextPage = items.length === 1 && page > 1 ? page - 1 : page;
      await loadItems(nextPage);
      setSuccess(`${title} deleted successfully.`);
    } catch {
      setError(`Unable to delete ${title.toLowerCase()}.`);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>

        <button
          type="button"
          onClick={() => void loadItems(page)}
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

      <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <FiPlus size={16} />
          {editId ? `Edit ${itemLabel}` : `Create ${itemLabel}`}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={`Enter ${title.toLowerCase()}`}
            />
          </div>

          {showValueField && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">{valueLabel}</label>
              <input
                value={form.value}
                onChange={(event) => setForm((current) => ({ ...current, value: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={valuePlaceholder}
              />
            </div>
          )}

          {showDescriptionField && (
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">{descriptionLabel}</label>
              <textarea
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                rows={3}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={descriptionPlaceholder}
              />
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Enabled
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FiSave size={16} />
            {saving ? 'Saving...' : editId ? 'Update Item' : 'Create Item'}
          </button>

          {editId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Cancel edit
            </button>
          )}
        </div>
      </form>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-3 text-slate-400" size={18} />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={showValueField || showDescriptionField
                ? 'Search by name, code, value, or description'
                : 'Search by name or code'}
              className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor={`${category}-page-size`} className="text-sm text-slate-600 whitespace-nowrap">
              Rows per page
            </label>
            <select
              id={`${category}-page-size`}
              value={limit}
              onChange={(event) => {
                const nextLimit = Number(event.target.value);
                setLimit(nextLimit);
                setPage(1);
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Code</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Name</th>
              {showValueField && (
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">{valueColumnLabel}</th>
              )}
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Status</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Created</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {loading && (
              <tr>
                <td className="px-6 py-8 text-sm text-slate-500" colSpan={showValueField ? 6 : 5}>
                  Loading {title.toLowerCase()}...
                </td>
              </tr>
            )}

            {!loading && filteredItems.length === 0 && (
              <tr>
                <td className="px-6 py-8 text-sm text-slate-500" colSpan={showValueField ? 6 : 5}>
                  No {title.toLowerCase()} found.
                </td>
              </tr>
            )}

            {!loading && filteredItems.map((item) => (
              <tr key={item._id} className="hover:bg-slate-50">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                      {item.extraCode ?? item._id}
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        await navigator.clipboard.writeText(item.extraCode ?? item._id);
                        setSuccess(`Copied ${item.extraCode ?? item._id}`);
                      }}
                      className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                      title="Copy code"
                    >
                      <FiCopy size={12} />
                    </button>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div>
                    <p className="font-medium text-slate-900">{item.name}</p>
                    {showDescriptionField && (
                      <p className="mt-1 text-xs text-slate-500 line-clamp-2">{item.description || 'No description'}</p>
                    )}
                  </div>
                </td>
                {showValueField && (
                  <td className="px-6 py-4 text-sm text-slate-700">{item.value || 'N/A'}</td>
                )}
                <td className="px-6 py-4 text-sm">
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${item.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                    {item.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-slate-700">
                  {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'N/A'}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      className="rounded-lg p-2 text-amber-600 hover:bg-amber-50"
                      title="Edit item"
                    >
                      <FiEdit2 size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => openDeleteModal(item)}
                      className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                      title="Delete item"
                    >
                      <FiTrash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-600">
          Showing page {page} of {Math.max(totalPages, 1)} • {totalItems} total items
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={loading || page <= 1}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Prev
          </button>

          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={loading || page >= totalPages}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Next
          </button>
        </div>
      </div>

      <ConfirmModal
        open={deleteModalOpen}
        title={`Delete ${itemLabel}`}
        description={`This will permanently remove the selected ${title.toLowerCase()} item.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isProcessing={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={closeDeleteModal}
      />
    </div>
  );
}