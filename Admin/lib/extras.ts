import { apiClient } from '@/lib/api';

export type ExtraCategory =
  | 'places'
  | 'difficulty'
  | 'activities'
  | 'xp'
  | 'badge'
  | 'level-up'
  | 'achievement';

export type ExtraItem = {
  _id: string;
  extraCode?: string;
  category: ExtraCategory;
  name: string;
  description?: string | null;
  value?: string | null;
  enabled?: boolean;
  adminApprovalRequired?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type ExtraPayload = {
  category: ExtraCategory;
  name: string;
  description?: string;
  value?: string;
  enabled?: boolean;
  adminApprovalRequired?: boolean;
};

export type ExtraListPagination = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type ExtraListResponse = {
  items: ExtraItem[];
  pagination: ExtraListPagination;
};

export type PlaceCatalogItem = {
  provinceNumber?: number;
  province: string;
  districts: string[];
  districtItems?: PlaceCatalogDistrictItem[];
};

export type PlaceCatalogDistrictItem = {
  district: string;
  places: string[];
};

export type PlaceCatalogResponse = {
  source: 'extras' | 'json';
  items: PlaceCatalogItem[];
  totals?: {
    provinces: number;
    districts: number;
    places?: number;
  };
};

export type PlaceMunicipalityNode = {
  id: string;
  name: string;
  deleted?: boolean;
};

export type PlaceDistrictNode = {
  id: string;
  name: string;
  municipalities: PlaceMunicipalityNode[];
  deleted?: boolean;
};

export type PlaceProvinceNode = {
  id: string;
  name: string;
  districts: PlaceDistrictNode[];
  deleted?: boolean;
};

export type PlacesHierarchyResponse = {
  provinces: PlaceProvinceNode[];
};

export type PlacePatchOperation = {
  op: 'add' | 'rename' | 'delete' | 'restore' | 'hard_delete';
  type?: 'province' | 'district' | 'municipality';
  parentId?: string;
  id?: string;
  name?: string;
};

export type DifficultyTier = {
  id: string;
  label: string;
  adminApprovalRequired: boolean;
  xpMultiplier: number;
  order: number;
  enabled: boolean;
};

export type DifficultyValidationError = {
  index: number;
  field: keyof DifficultyTier | 'root';
  message: string;
};

export const DEFAULT_DIFFICULTY_TIERS: DifficultyTier[] = [
  {
    id: 'easy',
    label: 'Easy',
    adminApprovalRequired: false,
    xpMultiplier: 1,
    order: 1,
    enabled: true,
  },
  {
    id: 'moderate',
    label: 'Moderate',
    adminApprovalRequired: false,
    xpMultiplier: 1.2,
    order: 2,
    enabled: true,
  },
  {
    id: 'hard',
    label: 'Hard',
    adminApprovalRequired: true,
    xpMultiplier: 1.5,
    order: 3,
    enabled: true,
  },
  {
    id: 'extreme',
    label: 'Extreme',
    adminApprovalRequired: true,
    xpMultiplier: 2,
    order: 4,
    enabled: true,
  },
  {
    id: 'challenging',
    label: 'Challenging',
    adminApprovalRequired: true,
    xpMultiplier: 3,
    order: 5,
    enabled: true,
  },
];

export function normalizeExtraListResponse(data: unknown): ExtraListResponse {
  if (typeof data === 'object' && data !== null) {
    const asRecord = data as {
      items?: unknown;
      pagination?: Partial<ExtraListPagination>;
    };

    if (Array.isArray(asRecord.items)) {
      const total = Number(asRecord.pagination?.total ?? asRecord.items.length);
      const page = Number(asRecord.pagination?.page ?? 1);
      const limit = Number((asRecord.pagination?.limit ?? asRecord.items.length) || 1);
      const totalPages = Number(
        asRecord.pagination?.totalPages
          ?? (limit > 0 ? Math.max(1, Math.ceil(total / limit)) : 1)
      );

      return {
        items: asRecord.items as ExtraItem[],
        pagination: {
          total,
          page,
          limit,
          totalPages,
        },
      };
    }
  }

  return {
    items: [],
    pagination: {
      total: 0,
      page: 1,
      limit: 1,
      totalPages: 1,
    },
  };
}

function normalizeDifficultySettings(data: unknown): DifficultyTier[] {
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map((item, index) => {
      if (typeof item !== 'object' || item === null) {
        return null;
      }

      const row = item as Partial<DifficultyTier>;
      const id = typeof row.id === 'string' ? row.id.trim() : '';
      const label = typeof row.label === 'string' ? row.label.trim() : '';
      const xpMultiplier = Number(row.xpMultiplier);

      if (!id || !label || !Number.isFinite(xpMultiplier)) {
        return null;
      }

      return {
        id,
        label,
        adminApprovalRequired: row.adminApprovalRequired === true,
        xpMultiplier,
        order: Number.isFinite(Number(row.order)) ? Number(row.order) : index + 1,
        enabled: row.enabled !== false,
      };
    })
    .filter((item): item is DifficultyTier => Boolean(item))
    .sort((a, b) => a.order - b.order)
    .map((item, index) => ({ ...item, order: index + 1 }));
}

export async function fetchExtras(category: ExtraCategory, params?: { page?: number; limit?: number }) {
  const response = await apiClient.get('/extra', {
    params: {
      category,
      page: params?.page ?? 1,
      limit: params?.limit ?? 20,
    },
  });

  return normalizeExtraListResponse(response.data);
}

export async function fetchExtraById(id: string) {
  const response = await apiClient.get(`/extra/${id}`);
  return response.data as ExtraItem;
}

export async function createExtra(payload: ExtraPayload) {
  const response = await apiClient.post('/extra', payload);
  return response.data as ExtraItem;
}

export async function updateExtra(id: string, payload: ExtraPayload) {
  const response = await apiClient.patch(`/extra/${id}`, payload);
  return response.data as ExtraItem;
}

export async function deleteExtra(id: string) {
  const response = await apiClient.delete(`/extra/${id}`);
  return response.data as { message?: string };
}

export async function fetchPlaceCatalog() {
  const response = await apiClient.get('/places/catalog');
  return response.data as PlaceCatalogResponse;
}

export async function fetchAdminPlaceHierarchy(params?: { includeDeleted?: boolean }) {
  const response = await apiClient.get('/extra/places/hierarchy', {
    params: {
      includeDeleted: params?.includeDeleted ?? false,
    },
  });

  return response.data as PlacesHierarchyResponse;
}

export async function fetchPlacesHierarchy(params?: { includeDeleted?: boolean }) {
  const response = await apiClient.get('/extra/places/hierarchy', {
    params: {
      includeDeleted: params?.includeDeleted ?? false,
    },
  });

  return response.data as PlacesHierarchyResponse;
}

export async function bulkSeedPlaces(payload: PlacesHierarchyResponse) {
  const response = await apiClient.post('/extra/places/bulk-seed', payload);
  return response.data as PlacesHierarchyResponse;
}

export async function patchPlaces(operations: PlacePatchOperation[]) {
  const response = await apiClient.patch('/extra/places', { operations });
  return response.data as PlacesHierarchyResponse;
}

export async function fetchDifficultySettings() {
  const response = await apiClient.get('/extra/difficulty');
  return normalizeDifficultySettings(response.data);
}

export async function saveDifficultySettings(payload: DifficultyTier[]) {
  const response = await apiClient.put('/extra/difficulty', payload);
  return normalizeDifficultySettings(response.data);
}
