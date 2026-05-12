'use client';

import { useEffect, useMemo, useState } from 'react';
import { FiPlus, FiRefreshCw, FiSave, FiTrash2 } from 'react-icons/fi';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { apiClient } from '@/lib/api';
import {
  createExtra,
  deleteExtra,
  ExtraItem,
  fetchExtras,
  updateExtra,
} from '@/lib/extras';

type BadgeValuePayload = {
  imageUrl: string;
  publicId?: string;
};

type BadgeFormState = {
  rankCode: string;
  imageUrl: string;
  imagePublicId: string;
  enabled: boolean;
};

type CloudinarySignatureResponse = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder?: string;
};

type CloudinaryUploadResponse = {
  secure_url: string;
  public_id: string;
};

const FALLBACK_RANK_OPTIONS = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS', 'Mythic', 'Heroic'] as const;

const defaultFormState: BadgeFormState = {
  rankCode: '',
  imageUrl: '',
  imagePublicId: '',
  enabled: true,
};

function normalizeRankCode(value?: string | null): string {
  const normalized = String(value ?? '').trim().toLowerCase();

  if (normalized === 'mythic' || normalized === 'ultimate') {
    return 'Mythic';
  }

  return normalized.toUpperCase();
}

function parseBadgeValue(rawValue?: string | null): BadgeValuePayload | null {
  if (!rawValue?.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<BadgeValuePayload>;
    const imageUrl = parsed.imageUrl?.trim();

    if (!imageUrl) {
      return null;
    }

    return {
      imageUrl,
      ...(parsed.publicId?.trim() ? { publicId: parsed.publicId.trim() } : {}),
    };
  } catch {
    const trimmed = rawValue.trim();
    if (!/^https?:\/\//i.test(trimmed)) {
      return null;
    }

    return { imageUrl: trimmed };
  }
}

function parseRequiredXpFromLevelUpValue(rawValue?: string | null): number {
  if (!rawValue?.trim()) {
    return Number.MAX_SAFE_INTEGER;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<{ requiredXp: number }>;
    const requiredXp = Number(parsed.requiredXp);
    return Number.isFinite(requiredXp) && requiredXp >= 0
      ? Math.floor(requiredXp)
      : Number.MAX_SAFE_INTEGER;
  } catch {
    const requiredXp = Number(rawValue);
    return Number.isFinite(requiredXp) && requiredXp >= 0
      ? Math.floor(requiredXp)
      : Number.MAX_SAFE_INTEGER;
  }
}

function buildRankOptionsFromLevelUp(items: ExtraItem[]): string[] {
  const byRank = new Map<string, number>();

  for (const item of items) {
    const rankCode = normalizeRankCode(item.name);

    if (!rankCode) {
      continue;
    }

    const requiredXp = parseRequiredXpFromLevelUpValue(item.value);
    const existingXp = byRank.get(rankCode);

    if (existingXp === undefined || requiredXp < existingXp) {
      byRank.set(rankCode, requiredXp);
    }
  }

  if (byRank.size === 0) {
    return [];
  }

  return Array.from(byRank.entries())
    .sort((first, second) => {
      const xpDiff = first[1] - second[1];
      if (xpDiff !== 0) {
        return xpDiff;
      }

      const firstIndex = FALLBACK_RANK_OPTIONS.indexOf(first[0] as typeof FALLBACK_RANK_OPTIONS[number]);
      const secondIndex = FALLBACK_RANK_OPTIONS.indexOf(second[0] as typeof FALLBACK_RANK_OPTIONS[number]);
      return firstIndex - secondIndex;
    })
    .map(([rankCode]) => rankCode);
}

export function BadgeManager() {
  const [items, setItems] = useState<ExtraItem[]>([]);
  const [rankOptions, setRankOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ExtraItem | null>(null);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [form, setForm] = useState<BadgeFormState>(defaultFormState);

  async function loadBadges() {
    setLoading(true);
    setError('');

    try {
      const [badgeResponse, levelUpResponse] = await Promise.all([
        fetchExtras('badge', { page: 1, limit: 200 }),
        fetchExtras('level-up', { page: 1, limit: 200 }),
      ]);
      setItems(badgeResponse.items);
      setRankOptions(buildRankOptionsFromLevelUp(levelUpResponse.items));
    } catch {
      setError('Failed to load rank badges. Please verify backend API and admin session.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadBadges();
  }, []);

  const selectableRankOptions = useMemo(() => {
    const base = rankOptions.length > 0
      ? rankOptions
      : Array.from(FALLBACK_RANK_OPTIONS);

    if (form.rankCode && !base.includes(form.rankCode)) {
      return [form.rankCode, ...base];
    }

    return base;
  }, [form.rankCode, rankOptions]);

  const parsedRows = useMemo(() => {
    return items
      .map((item) => ({
        item,
        parsed: parseBadgeValue(item.value),
      }))
      .filter((row) => selectableRankOptions.includes(normalizeRankCode(row.item.name)))
      .sort((first, second) => {
        const firstIndex = selectableRankOptions.indexOf(normalizeRankCode(first.item.name));
        const secondIndex = selectableRankOptions.indexOf(normalizeRankCode(second.item.name));
        return firstIndex - secondIndex;
      });
  }, [items, selectableRankOptions]);

  function resetForm() {
    setForm(defaultFormState);
    setEditId(null);
    if (selectedImageUrl) {
      URL.revokeObjectURL(selectedImageUrl);
      setSelectedImageUrl(null);
    }
    setSelectedImageFile(null);
  }

  function startEdit(item: ExtraItem) {
    const parsed = parseBadgeValue(item.value);

    setEditId(item._id);
    if (selectedImageUrl) {
      URL.revokeObjectURL(selectedImageUrl);
      setSelectedImageUrl(null);
    }
    setSelectedImageFile(null);
    setForm({
      rankCode: normalizeRankCode(item.name),
      imageUrl: parsed?.imageUrl ?? '',
      imagePublicId: parsed?.publicId ?? '',
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

  async function uploadBadgeImage(file: File): Promise<BadgeValuePayload> {
    const signatureResponse = await apiClient.post('/cloudinary/signature', {
      folder: 'rank-badges',
    });
    const signatureData = signatureResponse.data as CloudinarySignatureResponse;

    const uploadFormData = new FormData();
    uploadFormData.append('file', file);
    uploadFormData.append('api_key', signatureData.apiKey);
    uploadFormData.append('timestamp', String(signatureData.timestamp));
    uploadFormData.append('signature', signatureData.signature);

    if (signatureData.folder) {
      uploadFormData.append('folder', signatureData.folder);
    }

    const uploadResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${signatureData.cloudName}/image/upload`,
      {
        method: 'POST',
        body: uploadFormData,
      },
    );

    if (!uploadResponse.ok) {
      throw new Error('Image upload failed.');
    }

    const uploadedImage = await uploadResponse.json() as CloudinaryUploadResponse;

    return {
      imageUrl: uploadedImage.secure_url,
      publicId: uploadedImage.public_id,
    };
  }

  async function submitBadge(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!selectableRankOptions.includes(form.rankCode)) {
      setError('Please select a valid rank.');
      return;
    }

    if (
      !editId
      && items.some((item) => normalizeRankCode(item.name) === form.rankCode)
    ) {
      setError(`Badge for rank ${form.rankCode} already exists. Edit it instead.`);
      return;
    }

    if (!form.imageUrl.trim() && !selectedImageFile) {
      setError('Badge image is required.');
      return;
    }

    setSaving(true);

    try {
      const uploaded = selectedImageFile
        ? await uploadBadgeImage(selectedImageFile)
        : {
            imageUrl: form.imageUrl.trim(),
            ...(form.imagePublicId.trim() ? { publicId: form.imagePublicId.trim() } : {}),
          };
      const payload = {
        category: 'badge' as const,
        name: form.rankCode.trim(),
        value: JSON.stringify(uploaded),
        enabled: form.enabled,
      };

      if (editId) {
        await updateExtra(editId, payload);
        setSuccess('Rank badge updated successfully.');
      } else {
        await createExtra(payload);
        setSuccess('Rank badge created successfully.');
      }

      resetForm();
      await loadBadges();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save rank badge.');
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
      await loadBadges();
      setSuccess('Rank badge deleted successfully.');
    } catch {
      setError('Unable to delete rank badge.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Rank Badges</h1>
          <p className="mt-1 text-sm text-slate-600">
            Upload one badge image per rank configured in Level Up. Users only see badges up to their current rank.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadBadges()}
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

      <form onSubmit={submitBadge} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <FiPlus size={16} />
          {editId ? 'Edit Rank Badge' : 'Create Rank Badge'}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Rank</label>
            <select
              value={form.rankCode}
              onChange={(event) => setForm((current) => ({ ...current, rankCode: event.target.value }))}
              disabled={Boolean(editId)}
              className={`w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                editId ? 'bg-slate-100 cursor-not-allowed text-slate-500' : ''
              }`}
            >
              <option value="">Select rank</option>
              {selectableRankOptions.map((rank) => (
                <option key={rank} value={rank}>{rank}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Image file</label>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                if (selectedImageUrl) {
                  URL.revokeObjectURL(selectedImageUrl);
                  setSelectedImageUrl(null);
                }
                if (file) {
                  setSelectedImageFile(file);
                  setSelectedImageUrl(URL.createObjectURL(file));
                } else {
                  setSelectedImageFile(null);
                }
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-blue-700"
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

        {(selectedImageFile || form.imageUrl.trim()) && (
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-medium text-slate-500">Preview</p>
            <div className="mt-2 flex items-start gap-3">
              <img
                src={selectedImageFile ? selectedImageUrl ?? '' : form.imageUrl}
                alt={`${form.rankCode || 'Rank'} badge preview`}
                className="h-20 w-20 rounded-lg object-cover"
              />
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    // remove selected image (file or URL)
                    if (selectedImageUrl) {
                      URL.revokeObjectURL(selectedImageUrl);
                      setSelectedImageUrl(null);
                    }
                    setSelectedImageFile(null);
                    setForm((current) => ({ ...current, imageUrl: '', imagePublicId: '' }));
                  }}
                  aria-label="Remove image"
                  title="Remove image"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-white text-sm text-slate-700 hover:bg-slate-50"
                >
                  <span aria-hidden className="-mt-0.5 text-lg">×</span>
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FiSave size={16} />
            {saving ? 'Saving...' : editId ? 'Update Badge' : 'Create Badge'}
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

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Rank</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Badge</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Status</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {loading && (
              <tr>
                <td className="px-6 py-8 text-sm text-slate-500" colSpan={4}>
                  Loading rank badges...
                </td>
              </tr>
            )}

            {!loading && parsedRows.length === 0 && (
              <tr>
                <td className="px-6 py-8 text-sm text-slate-500" colSpan={4}>
                  No rank badges found.
                </td>
              </tr>
            )}

            {!loading && parsedRows.map(({ item, parsed }) => (
              <tr key={item._id} className="hover:bg-slate-50">
                <td className="px-6 py-4">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                    {normalizeRankCode(item.name)}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {parsed?.imageUrl ? (
                    <img
                      src={parsed.imageUrl}
                      alt={`${item.name} badge`}
                      className="h-12 w-12 rounded-md object-cover"
                    />
                  ) : (
                    <span className="text-sm text-slate-500">Missing image</span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm">
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${item.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                    {item.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      className="rounded-lg p-2 text-amber-600 hover:bg-amber-50"
                      title="Edit badge"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const profileId = window.prompt('Enter profile ID to award this badge to (profile._id):');
                        if (!profileId) return;

                        try {
                          await apiClient.post(`/admin/profiles/${encodeURIComponent(profileId)}/badges`, {
                            badgeCode: normalizeRankCode(item.name),
                            name: item.name,
                            iconUrl: parsed?.imageUrl ?? '',
                            tier: 'rank',
                            description: `Awarded rank badge ${item.name}`,
                          });
                          setSuccess('Badge awarded successfully.');
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'Unable to award badge.');
                        }
                      }}
                      className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50"
                      title="Award this badge to a user"
                    >
                      Award
                    </button>
                    <button
                      type="button"
                      onClick={() => openDeleteModal(item)}
                      className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                      title="Delete badge"
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

      <ConfirmModal
        isOpen={deleteModalOpen}
        title="Delete rank badge"
        message={`Are you sure you want to delete ${selectedItem?.name ?? 'this badge'}?`}
        confirmLabel={deleting ? 'Deleting...' : 'Delete'}
        onConfirm={() => void confirmDelete()}
        onCancel={closeDeleteModal}
        intent="danger"
      />
    </div>
  );
}
