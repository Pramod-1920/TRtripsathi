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
  createdAt?: string;
  updatedAt?: string;
};

export type ExtraPayload = {
  category: ExtraCategory;
  name: string;
  description?: string;
  value?: string;
  enabled?: boolean;
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

export async function fetchAdminPlaceHierarchy(params?: { includeDisabled?: boolean }) {
  const response = await apiClient.get('/extra/places/hierarchy', {
    params: {
      includeDisabled: params?.includeDisabled ?? true,
    },
  });

  return response.data as PlaceCatalogResponse;
}