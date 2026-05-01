'use client';

import { useEffect, useMemo, useState } from 'react';
import { FiCopy, FiEdit2, FiMapPin, FiPlus, FiRefreshCw, FiSave, FiSearch, FiTrash2 } from 'react-icons/fi';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import {
  createExtra,
  deleteExtra,
  ExtraItem,
  fetchAdminPlaceHierarchy,
  fetchExtras,
  PlaceCatalogItem,
  updateExtra,
} from '@/lib/extras';

type PlaceType = 'province' | 'district' | 'place';

type PlaceFormState = {
  type: PlaceType;
  name: string;
  province: string;
  district: string;
  description: string;
  enabled: boolean;
};

type ParsedPlaceMetadata = {
  type: PlaceType;
  province?: string;
  district?: string;
};

const defaultFormState: PlaceFormState = {
  type: 'province',
  name: '',
  province: '',
  district: '',
  description: '',
  enabled: true,
};

function parsePlaceMetadata(rawValue?: string | null): ParsedPlaceMetadata {
  if (!rawValue || !rawValue.trim()) {
    return { type: 'district' };
  }

  try {
    const parsed = JSON.parse(rawValue) as {
      type?: unknown;
      province?: unknown;
      district?: unknown;
    };

    const type: PlaceType =
      parsed.type === 'province' || parsed.type === 'district' || parsed.type === 'place'
        ? parsed.type
        : 'district';

    const province = typeof parsed.province === 'string' ? parsed.province.trim() : undefined;
    const district = typeof parsed.district === 'string' ? parsed.district.trim() : undefined;

    return {
      type,
      ...(province ? { province } : {}),
      ...(district ? { district } : {}),
    };
  } catch {
    return { type: 'district' };
  }
}

function toMetadataValue(form: PlaceFormState): string {
  if (form.type === 'province') {
    return JSON.stringify({ type: 'province' });
  }

  if (form.type === 'district') {
    return JSON.stringify({
      type: 'district',
      province: form.province.trim(),
    });
  }

  return JSON.stringify({
    type: 'place',
    province: form.province.trim(),
    district: form.district.trim(),
  });
}

export function PlacesManager() {
  const [items, setItems] = useState<ExtraItem[]>([]);
  const [placeHierarchy, setPlaceHierarchy] = useState<PlaceCatalogItem[]>([]);
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
  const [form, setForm] = useState<PlaceFormState>(defaultFormState);

  async function loadHierarchy() {
    const response = await fetchAdminPlaceHierarchy({ includeDisabled: true });
    setPlaceHierarchy(response.items ?? []);
  }

  async function loadItems(targetPage = page) {
    setLoading(true);
    setError('');

    try {
      const [listResponse] = await Promise.all([
        fetchExtras('places', { page: targetPage, limit }),
        loadHierarchy(),
      ]);

      setItems(listResponse.items);
      setPage(listResponse.pagination.page);
      setTotalPages(listResponse.pagination.totalPages);
      setTotalItems(listResponse.pagination.total);
    } catch {
      setError('Failed to load places from backend.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadItems(page);
  }, [page, limit]);

  const provinceOptions = useMemo(() => {
    const values = placeHierarchy
      .map((item) => item.province.trim())
      .filter((item) => item.length > 0);

    if (form.province.trim() && !values.includes(form.province.trim())) {
      values.unshift(form.province.trim());
    }

    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
  }, [form.province, placeHierarchy]);

  const districtOptions = useMemo(() => {
    if (!form.province.trim()) {
      return [];
    }

    const provinceNode = placeHierarchy.find((item) => item.province === form.province);
    const fromDistrictItems = (provinceNode?.districtItems ?? []).map((item) => item.district.trim());
    const fromDistrictsArray = (provinceNode?.districts ?? []).map((item) => item.trim());
    const values = Array.from(new Set([...fromDistrictItems, ...fromDistrictsArray])).filter(Boolean);

    if (form.district.trim() && !values.includes(form.district.trim())) {
      values.unshift(form.district.trim());
    }

    return values.sort((a, b) => a.localeCompare(b));
  }, [form.district, form.province, placeHierarchy]);

  useEffect(() => {
    if (form.type === 'province') {
      if (form.province || form.district) {
        setForm((current) => ({ ...current, province: '', district: '' }));
      }
      return;
    }

    if (!form.province.trim()) {
      if (form.district) {
        setForm((current) => ({ ...current, district: '' }));
      }
      return;
    }

    if (form.type === 'place' && form.district && !districtOptions.includes(form.district)) {
      setForm((current) => ({ ...current, district: '' }));
    }
  }, [districtOptions, form.district, form.province, form.type]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return items;
    }

    return items.filter((item) => {
      const metadata = parsePlaceMetadata(item.value);
      return (
        item.name.toLowerCase().includes(query)
        || (item.extraCode ?? '').toLowerCase().includes(query)
        || metadata.type.toLowerCase().includes(query)
        || (metadata.province ?? '').toLowerCase().includes(query)
        || (metadata.district ?? '').toLowerCase().includes(query)
        || (item.description ?? '').toLowerCase().includes(query)
      );
    });
  }, [items, search]);

  function resetForm() {
    setForm(defaultFormState);
    setEditId(null);
  }

  function startEdit(item: ExtraItem) {
    const metadata = parsePlaceMetadata(item.value);

    setEditId(item._id);
    setForm({
      type: metadata.type,
      name: item.name ?? '',
      province: metadata.province ?? '',
      district: metadata.district ?? '',
      description: item.description ?? '',
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

    if (form.type !== 'province' && !form.province.trim()) {
      setError('Province is required for district/place entries.');
      return;
    }

    if (form.type === 'place' && !form.district.trim()) {
      setError('District is required for place entries.');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        category: 'places' as const,
        name: form.name.trim(),
        value: toMetadataValue(form),
        ...(form.description.trim() ? { description: form.description.trim() } : {}),
        enabled: form.enabled,
      };

      if (editId) {
        await updateExtra(editId, payload);
        setSuccess('Place entry updated successfully.');
      } else {
        await createExtra(payload);
        setSuccess('Place entry created successfully.');
      }

      resetForm();
      await loadItems(page);
    } catch {
      setError('Unable to save place entry.');
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
      setSuccess('Place entry deleted successfully.');
    } catch {
      setError('Unable to delete place entry.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Places</h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage Province, District, and Place hierarchy for campaign dropdowns.
          </p>
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

      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <FiPlus size={16} />
          {editId ? 'Edit Place Entry' : 'Create Place Entry'}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Entry Type</label>
            <select
              value={form.type}
              onChange={(event) => {
                const nextType = event.target.value as PlaceType;
                setForm((current) => ({
                  ...current,
                  type: nextType,
                  province: nextType === 'province' ? '' : current.province,
                  district: nextType === 'place' ? current.district : '',
                }));
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="province">Province</option>
              <option value="district">District</option>
              <option value="place">Place</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {form.type === 'province' ? 'Province Name' : form.type === 'district' ? 'District Name' : 'Place Name'}
            </label>
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={form.type === 'place' ? 'PASHUPATINATH TEMPLE' : 'Enter name'}
            />
          </div>

          {form.type !== 'province' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Province</label>
              <select
                value={form.province}
                onChange={(event) => setForm((current) => ({ ...current, province: event.target.value, district: '' }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select province</option>
                {provinceOptions.map((province) => (
                  <option key={province} value={province}>
                    {province}
                  </option>
                ))}
              </select>
            </div>
          )}

          {form.type === 'place' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">District</label>
              <select
                value={form.district}
                onChange={(event) => setForm((current) => ({ ...current, district: event.target.value }))}
                disabled={!form.province}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
              >
                <option value="">{form.province ? 'Select district' : 'Select province first'}</option>
                {districtOptions.map((district) => (
                  <option key={district} value={district}>
                    {district}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
            <textarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              rows={2}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Optional description"
            />
          </div>

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
            {saving ? 'Saving...' : editId ? 'Update Entry' : 'Create Entry'}
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
              placeholder="Search by name, code, type, province, or district"
              className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="places-page-size" className="whitespace-nowrap text-sm text-slate-600">
              Rows per page
            </label>
            <select
              id="places-page-size"
              value={limit}
              onChange={(event) => {
                setLimit(Number(event.target.value));
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
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Type</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Province</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">District</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Name</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Status</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Created</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {loading && (
              <tr>
                <td className="px-6 py-8 text-sm text-slate-500" colSpan={8}>
                  Loading place entries...
                </td>
              </tr>
            )}

            {!loading && filteredItems.length === 0 && (
              <tr>
                <td className="px-6 py-8 text-sm text-slate-500" colSpan={8}>
                  No place entries found.
                </td>
              </tr>
            )}

            {!loading && filteredItems.map((item) => {
              const metadata = parsePlaceMetadata(item.value);

              return (
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
                  <td className="px-6 py-4 text-sm text-slate-700">
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium uppercase text-blue-700">
                      <FiMapPin size={12} />
                      {metadata.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">{metadata.province ?? 'N/A'}</td>
                  <td className="px-6 py-4 text-sm text-slate-700">{metadata.district ?? 'N/A'}</td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-slate-900">{item.name}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500">{item.description || 'No description'}</p>
                    </div>
                  </td>
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
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-600">
          Showing page {page} of {Math.max(totalPages, 1)} - {totalItems} total items
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
        title="Delete Place Entry"
        description="This will permanently remove the selected place entry."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isProcessing={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={closeDeleteModal}
      />
    </div>
  );
}
