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

type PlaceFormState = {
  type: 'province' | 'district' | 'place';
  provinceNumber: string;
  provinceName: string;
  district: string;
  activity: string;
  name: string;
  description: string;
  enabled: boolean;
};

type ParsedPlaceMetadata = {
  type: string;
  provinceNumber?: number;
  province?: string;
  district?: string;
  activity?: string;
};

const defaultFormState: PlaceFormState = {
  type: 'province',
  provinceNumber: '',
  provinceName: '',
  district: '',
  activity: '',
  name: '',
  description: '',
  enabled: true,
};

function parsePlaceMetadata(rawValue?: string | null): ParsedPlaceMetadata {
  if (!rawValue || !rawValue.trim()) {
    return { type: 'place' };
  }

  try {
    const parsed = JSON.parse(rawValue) as {
      type?: unknown;
      provinceNumber?: unknown;
      province?: unknown;
      district?: unknown;
      activity?: unknown;
    };

    return {
      type: 'place',
      ...(typeof parsed.provinceNumber === 'number' ? { provinceNumber: parsed.provinceNumber } : {}),
      ...(typeof parsed.province === 'string' ? { province: parsed.province.trim() } : {}),
      ...(typeof parsed.district === 'string' ? { district: parsed.district.trim() } : {}),
      ...(typeof parsed.activity === 'string' ? { activity: parsed.activity.trim() } : {}),
    };
  } catch {
    return { type: 'place' };
  }
}

function toMetadataValue(form: PlaceFormState): string {
  if (form.type === 'province') {
    return JSON.stringify({
      type: 'province',
      provinceNumber: parseInt(form.provinceNumber) || 0,
    });
  }

  if (form.type === 'district') {
    return JSON.stringify({
      type: 'district',
      provinceNumber: parseInt(form.provinceNumber) || 0,
      province: form.provinceName.trim(),
    });
  }

  return JSON.stringify({
    type: 'place',
    provinceNumber: parseInt(form.provinceNumber) || 0,
    province: form.provinceName.trim(),
    district: form.district.trim(),
    activity: form.activity.trim(),
  });
}

export function PlacesManager() {
  const [items, setItems] = useState<ExtraItem[]>([]);
  const [placeHierarchy, setPlaceHierarchy] = useState<PlaceCatalogItem[]>([]);
  const [activities, setActivities] = useState<ExtraItem[]>([]);
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

  async function loadActivities() {
    try {
      const response = await fetchExtras('activities', { page: 1, limit: 100 });
      setActivities(response.items);
    } catch {
      console.error('Failed to load activities');
    }
  }

  async function loadItems(targetPage = page) {
    setLoading(true);
    setError('');

    try {
      const [listResponse] = await Promise.all([
        fetchExtras('places', { page: targetPage, limit }),
        loadHierarchy(),
        loadActivities(),
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
    return placeHierarchy.map((item) => ({
      number: item.provinceNumber || 0,
      name: item.province,
    })).sort((a, b) => a.number - b.number);
  }, [placeHierarchy]);

  const districtOptions = useMemo(() => {
    if (!form.provinceName) {
      return [];
    }

    const provinceNode = placeHierarchy.find((item) => item.province === form.provinceName);
    return (provinceNode?.districts ?? []).sort((a, b) => a.localeCompare(b));
  }, [form.provinceName, placeHierarchy]);

  const activityOptions = useMemo(() => {
    return activities
      .filter((a) => a.enabled !== false)
      .map((a) => a.name)
      .sort((a, b) => a.localeCompare(b));
  }, [activities]);

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
    const type = (metadata.type as 'province' | 'district' | 'place') || 'place';

    setEditId(item._id);
    setForm({
      type,
      provinceNumber: String(metadata.provinceNumber ?? ''),
      provinceName: metadata.province ?? '',
      district: metadata.district ?? '',
      activity: metadata.activity ?? '',
      name: item.name ?? '',
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

    // Province validation
    if (form.type === 'province') {
      if (!form.provinceNumber) {
        setError('Province Number (1-7) is required.');
        return;
      }
      if (!form.provinceName.trim()) {
        setError('Province Name is required.');
        return;
      }
    }

    // District validation
    if (form.type === 'district') {
      if (!form.provinceNumber) {
        setError('Province Number is required.');
        return;
      }
      if (!form.provinceName.trim()) {
        setError('Province Name is required.');
        return;
      }
      if (!form.district.trim()) {
        setError('District Name is required.');
        return;
      }
    }

    // Place validation
    if (form.type === 'place') {
      if (!form.name.trim()) {
        setError('Place Name is required.');
        return;
      }
      if (!form.provinceNumber || !form.provinceName) {
        setError('Province is required.');
        return;
      }
      if (!form.district.trim()) {
        setError('District is required.');
        return;
      }
      if (!form.activity.trim()) {
        setError('Activity is required.');
        return;
      }
    }

    setSaving(true);

    try {
      const label =
        form.type === 'province' ? form.provinceName
          : form.type === 'district' ? form.district
            : form.name;

      const payload = {
        category: 'places' as const,
        name: label.trim(),
        value: toMetadataValue(form),
        enabled: form.enabled,
      };

      if (editId) {
        await updateExtra(editId, payload);
        setSuccess(`${form.type === 'province' ? 'Province' : form.type === 'district' ? 'District' : 'Place'} updated successfully.`);
      } else {
        await createExtra(payload);
        setSuccess(`${form.type === 'province' ? 'Province' : form.type === 'district' ? 'District' : 'Place'} created successfully.`);
      }

      resetForm();
      await loadItems(page);
    } catch {
      setError(`Unable to save ${form.type}.`);
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

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Entry Type</label>
            <select
              value={form.type}
              onChange={(event) => {
                const newType = event.target.value as 'province' | 'district' | 'place';
                setForm((current) => ({
                  ...current,
                  type: newType,
                  district: '',
                  activity: '',
                  name: '',
                }));
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="province">Province (Add New)</option>
              <option value="district">District (Add New)</option>
              <option value="place">Place Name (Add New)</option>
            </select>
          </div>

          {form.type === 'province' && (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Province Number (1-7)</label>
                <input
                  type="number"
                  min="1"
                  max="7"
                  value={form.provinceNumber}
                  onChange={(event) => setForm((current) => ({ ...current, provinceNumber: event.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="1"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Province Name</label>
                <input
                  type="text"
                  value={form.provinceName}
                  onChange={(event) => setForm((current) => ({ ...current, provinceName: event.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="BAGMATI PROVINCE"
                />
              </div>
            </>
          )}

          {form.type === 'district' && (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Province</label>
                <select
                  value={form.provinceNumber}
                  onChange={(event) => {
                    const selected = provinceOptions.find((p) => String(p.number) === event.target.value);
                    setForm((current) => ({
                      ...current,
                      provinceNumber: event.target.value,
                      provinceName: selected?.name ?? '',
                    }));
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select province</option>
                  {provinceOptions.map((province) => (
                    <option key={province.number} value={province.number}>
                      {province.number} - {province.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">District Name</label>
                <input
                  type="text"
                  value={form.district}
                  onChange={(event) => setForm((current) => ({ ...current, district: event.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="KATHMANDU"
                />
              </div>
            </>
          )}

          {form.type === 'place' && (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Province</label>
                <select
                  value={form.provinceNumber}
                  onChange={(event) => {
                    const selected = provinceOptions.find((p) => String(p.number) === event.target.value);
                    setForm((current) => ({
                      ...current,
                      provinceNumber: event.target.value,
                      provinceName: selected?.name ?? '',
                      district: '',
                    }));
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select province</option>
                  {provinceOptions.map((province) => (
                    <option key={province.number} value={province.number}>
                      {province.number} - {province.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">District</label>
                <select
                  value={form.district}
                  onChange={(event) => setForm((current) => ({ ...current, district: event.target.value }))}
                  disabled={!form.provinceName}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
                >
                  <option value="">{form.provinceName ? 'Select district' : 'Select province first'}</option>
                  {districtOptions.map((district) => (
                    <option key={district} value={district}>
                      {district}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Activity</label>
                <select
                  value={form.activity}
                  onChange={(event) => setForm((current) => ({ ...current, activity: event.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select activity</option>
                  {activityOptions.map((activity) => (
                    <option key={activity} value={activity}>
                      {activity}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-3">
                <label className="mb-1 block text-sm font-medium text-slate-700">Place Name</label>
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="PASHUPATINATH TEMPLE"
                />
              </div>
            </>
          )}
        </div>

        <div className="space-y-4">
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
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Province</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">District</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Activity</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Place Name</th>
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
                    {metadata.provinceNumber ? `${metadata.provinceNumber} - ${metadata.province}` : metadata.province || 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">{metadata.district || 'N/A'}</td>
                  <td className="px-6 py-4 text-sm text-slate-700">{metadata.activity || 'N/A'}</td>
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
