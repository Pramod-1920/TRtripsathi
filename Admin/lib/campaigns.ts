import { apiClient } from '@/lib/api';

export type JoinMode = 'open' | 'request';
export type CampaignScheduleType = 'instant' | 'scheduled';

export type CampaignPhoto = {
  url: string;
  publicId?: string;
  caption?: string;
};

export type Campaign = {
  _id: string;
  campaignCode?: string;
  title: string;
  description?: string | null;
  location?: string | null;
  province?: string | null;
  district?: string | null;
  placeName?: string | null;
  difficulty?: string | null;
  durationDays?: number;
  maxParticipants?: number;
  estimatedNPR?: number;
  scheduleType?: CampaignScheduleType;
  startDate?: string | null;
  endDate?: string | null;
  joinOpenDate?: string | null;
  joinMode?: JoinMode;
  photos?: CampaignPhoto[];
  completed?: boolean;
  creator?: {
    name?: string;
    role?: 'admin' | 'user';
    phoneNumber?: string | null;
  };
  createdAt?: string;
  updatedAt?: string;
};

export type CampaignPayload = {
  title: string;
  description?: string;
  location?: string;
  province?: string;
  district?: string;
  placeName?: string;
  difficulty?: string;
  durationDays?: number;
  maxParticipants?: number;
  estimatedNPR?: number;
  scheduleType?: CampaignScheduleType;
  startDate?: string;
  endDate?: string;
  joinOpenDate?: string;
  joinMode?: JoinMode;
  photos?: CampaignPhoto[];
};

export type CampaignListPagination = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type CampaignListResponse = {
  items: Campaign[];
  pagination: CampaignListPagination;
};

export function normalizeCampaignList(data: unknown): Campaign[] {
  if (Array.isArray(data)) {
    return data as Campaign[];
  }

  if (typeof data === 'object' && data !== null) {
    const maybeItems = (data as { items?: unknown }).items;
    if (Array.isArray(maybeItems)) {
      return maybeItems as Campaign[];
    }
  }

  return [];
}

export function normalizeCampaignListResponse(data: unknown): CampaignListResponse {
  if (Array.isArray(data)) {
    return {
      items: data as Campaign[],
      pagination: {
        total: data.length,
        page: 1,
        limit: data.length,
        totalPages: 1,
      },
    };
  }

  if (typeof data === 'object' && data !== null) {
    const asRecord = data as {
      items?: unknown;
      pagination?: Partial<CampaignListPagination>;
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
        items: asRecord.items as Campaign[],
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

export function toIsoFromDateInput(value: string) {
  if (!value) {
    return undefined;
  }

  const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

  if (dateOnlyPattern.test(value)) {
    return new Date(`${value}T00:00:00.000Z`).toISOString();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString();
}

export function toDateInputValue(value?: string | null) {
  if (!value) {
    return '';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return parsed.toISOString().slice(0, 10);
}

export function toDateTimeLocalValue(value?: string | null) {
  if (!value) {
    return '';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  const localAdjusted = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000);
  return localAdjusted.toISOString().slice(0, 16);
}

export function formatDateTimeLocal(value: Date) {
  const localAdjusted = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
  return localAdjusted.toISOString().slice(0, 16);
}

export async function fetchCampaigns(params?: {
  page?: number;
  limit?: number;
  includeFuture?: boolean;
}) {
  const response = await apiClient.get('/campaigns/admin/list', {
    params: {
      page: params?.page ?? 1,
      limit: params?.limit ?? 50,
      includeFuture: params?.includeFuture ?? true,
    },
  });

  return normalizeCampaignListResponse(response.data);
}

export async function fetchCampaignById(id: string) {
  const response = await apiClient.get(`/campaigns/${id}`);
  return response.data as Campaign;
}

export async function createCampaign(payload: CampaignPayload) {
  const response = await apiClient.post('/campaigns', payload);
  return response.data as Campaign;
}

export async function updateCampaign(id: string, payload: CampaignPayload) {
  const response = await apiClient.patch(`/campaigns/${id}`, payload);
  return response.data as Campaign;
}

export async function deleteCampaign(id: string, reason?: string) {
  const response = await apiClient.delete(`/campaigns/${id}`, {
    params: reason?.trim() ? { reason: reason.trim() } : undefined,
  });
  return response.data as { message?: string };
}
