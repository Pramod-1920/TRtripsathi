import { apiClient } from "@/lib/api";

export type CampaignApprovalStatus =
  "draft" | "submitted" | "approved" | "rejected";
export type CampaignScheduleType = "instant" | "scheduled";
export type JoinMode = "open" | "request";
export type CampaignLifecyclePhase =
  | "draft"
  | "open"
  | "planning"
  | "verification"
  | "ready"
  | "started"
  | "completed"
  | "cancelled";

export type CampaignPayload = {
  title: string;
  description?: string;
  category: string;
  subcategory?: string;
  hikeType: "solo" | "group";
  location?: string;
  province?: string;
  district?: string;
  municipality?: string;
  placeName?: string;
  difficulty?: string;
  durationDays?: number;
  maxParticipants?: number;
  minParticipants?: number;
  estimatedNPR?: number;
  scheduleType?: CampaignScheduleType;
  startDate?: string;
  endDate?: string;
  joinOpenDate?: string;
  joinMode?: JoinMode;
  photos?: Array<{ url: string; publicId?: string; caption?: string }>;
};

export type CampaignParticipant = {
  userId: string;
  status: "pending" | "accepted" | "rejected" | "left" | "removed";
  role?: "host" | "co-host" | "member";
  confirmed?: boolean;
  confirmedAt?: string | null;
  verified?: boolean;
  completionDays?: number | null;
  [key: string]: unknown;
};

export type CampaignTask = {
  _id: string;
  title: string;
  assignedUserId?: string | null;
  completed: boolean;
  completedAt?: string | null;
};

export type Campaign = {
  _id: string;
  campaignCode?: string;
  title: string;
  description?: string | null;
  category?: string;
  subcategory?: string | null;
  hikeType: "solo" | "group";
  location?: string | null;
  province?: string | null;
  district?: string | null;
  municipality?: string | null;
  placeName?: string | null;
  difficulty?: string | null;
  durationDays?: number;
  maxParticipants?: number;
  minParticipants?: number;
  estimatedNPR?: number;
  scheduleType?: CampaignScheduleType;
  startDate?: string | null;
  endDate?: string | null;
  joinOpenDate?: string | null;
  joinMode?: JoinMode;
  photos?: Array<{
    url: string;
    publicId?: string | null;
    caption?: string | null;
  }>;
  approvalStatus: CampaignApprovalStatus;
  lifecyclePhase?: CampaignLifecyclePhase;
  deletedByAdmin?: boolean;
  completed?: boolean;
  failed?: boolean;
  failedAt?: string | null;
  submittedAt?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  approvedBy?: string | null;
  rejectedBy?: string | null;
  hostVerified?: boolean;
  verifiedAt?: string | null;
  verificationDeadline?: string | null;
  awaitingVerification?: boolean;
  minimumParticipantDecisionRequired?: boolean;
  minimumParticipantDecisionRequestedAt?: string | null;
  minimumParticipantDecision?: "continue" | "end" | null;
  minimumParticipantDecisionAt?: string | null;
  approvalNote?: string | null;
  participants?: CampaignParticipant[];
  planning?: {
    transportDecision?: string | null;
    meetingPoint?: string | null;
    meetingTime?: string | null;
    costBreakdown?: {
      transport?: number;
      food?: number;
      guide?: number;
      misc?: number;
      totalCost?: number;
      costPerPerson?: number;
    };
    tasks?: CampaignTask[];
    isComplete?: boolean;
    completenessErrors?: string[];
  };
  timeline?: {
    createdAt?: string | null;
    openAt?: string | null;
    planningAt?: string | null;
    verificationAt?: string | null;
    readyAt?: string | null;
    startedAt?: string | null;
    completedAt?: string | null;
    cancelledAt?: string | null;
    nextTransitionAt?: string | null;
  };
  creator?: {
    name?: string;
    role?: string;
    phoneNumber?: string | null;
  };
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

type CampaignListResponse = {
  items: Campaign[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

type FetchCampaignsParams = {
  page?: number;
  limit?: number;
  includeFuture?: boolean;
  approvalStatus?: CampaignApprovalStatus;
};

function normalizeCampaign(item: unknown): Campaign {
  const record =
    item && typeof item === "object" ? (item as Record<string, unknown>) : {};

  return {
    ...record,
    _id: String(record._id ?? ""),
  } as Campaign;
}

export function formatDateTimeLocal(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function toDateTimeLocalValue(value?: string | Date | null): string {
  if (!value) {
    return "";
  }
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return formatDateTimeLocal(parsed);
}

export function toIsoFromDateInput(value: string): string {
  if (!value) {
    return "";
  }
  const parsed = new Date(value);
  return parsed.toISOString();
}

export type CampaignDisplayStatus =
  | "active"
  | "awaiting_approval"
  | "campaign_expired"
  | "draft"
  | "happening_soon"
  | "host_decision_required"
  | "ongoing"
  | "photo_verification"
  | "planning"
  | "rejected"
  | "verification_in_progress";

export function getCampaignDisplayStatus(
  campaign: Campaign,
  now = new Date(),
): { key: CampaignDisplayStatus; label: string } {
  const phase = String(campaign.lifecyclePhase ?? "").toLowerCase();
  const rawStatus = String(campaign.status ?? "").toLowerCase();
  const approval = String(campaign.approvalStatus ?? "").toLowerCase();
  const start = parseCampaignDate(campaign.startDate);
  const explicitEnd = parseCampaignDate(campaign.endDate);
  const durationDays = Math.max(
    1,
    Math.min(365, Number(campaign.durationDays ?? 1)),
  );
  const calculatedEnd = start
    ? new Date(start.getTime() + durationDays * 24 * 60 * 60 * 1000)
    : null;
  const end = explicitEnd ?? calculatedEnd;
  const verificationDeadline = parseCampaignDate(campaign.verificationDeadline);
  const awaitingPhotoVerification =
    campaign.awaitingVerification === true &&
    (!verificationDeadline || verificationDeadline.getTime() > now.getTime());

  if (campaign.minimumParticipantDecisionRequired === true) {
    return {
      key: "host_decision_required",
      label: "Host Decision Required",
    };
  }

  if (awaitingPhotoVerification) {
    return { key: "photo_verification", label: "Photo Verification" };
  }

  if (
    campaign.failed === true ||
    phase === "cancelled" ||
    rawStatus === "cancelled" ||
    campaign.completed === true ||
    phase === "completed" ||
    rawStatus === "completed" ||
    (end && end.getTime() <= now.getTime())
  ) {
    return { key: "campaign_expired", label: "Campaign Expired" };
  }

  if (approval === "rejected") return { key: "rejected", label: "Rejected" };
  if (approval === "submitted") {
    return { key: "awaiting_approval", label: "Awaiting Approval" };
  }
  if (approval === "draft" || phase === "draft")
    return { key: "draft", label: "Draft" };
  if (phase === "verification") {
    return {
      key: "verification_in_progress",
      label: "Verification in Progress",
    };
  }
  if (phase === "planning") return { key: "planning", label: "Planning" };
  if (phase === "ready")
    return { key: "happening_soon", label: "Happening Soon" };
  if (
    phase === "started" ||
    rawStatus === "ongoing" ||
    (start &&
      start.getTime() <= now.getTime() &&
      (!end || end.getTime() > now.getTime()))
  ) {
    return { key: "ongoing", label: "Ongoing" };
  }
  if (start && start.getTime() > now.getTime()) {
    return { key: "happening_soon", label: "Happening Soon" };
  }
  return { key: "active", label: "Active" };
}

export function getCampaignStatusBadgeClass(status: CampaignDisplayStatus) {
  switch (status) {
    case "campaign_expired":
    case "rejected":
      return "bg-red-50 text-red-700";
    case "photo_verification":
    case "verification_in_progress":
      return "bg-violet-50 text-violet-700";
    case "happening_soon":
    case "awaiting_approval":
    case "host_decision_required":
      return "bg-amber-50 text-amber-700";
    case "ongoing":
    case "active":
      return "bg-emerald-50 text-emerald-700";
    case "planning":
      return "bg-blue-50 text-blue-700";
    case "draft":
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function parseCampaignDate(value?: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function fetchCampaigns(
  params: FetchCampaignsParams = {},
): Promise<CampaignListResponse> {
  const response = await apiClient.get("/campaigns/admin/list", {
    params: {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      includeFuture: params.includeFuture ?? true,
      ...(params.approvalStatus
        ? { approvalStatus: params.approvalStatus }
        : {}),
    },
  });

  return {
    ...response.data,
    items: (response.data.items ?? []).map(normalizeCampaign),
  };
}

export async function fetchCampaignById(id: string): Promise<Campaign> {
  const response = await apiClient.get(`/campaigns/${id}`);
  return normalizeCampaign(response.data);
}

export async function fetchCampaignBin(
  params: { page?: number; limit?: number } = {},
): Promise<CampaignListResponse> {
  const response = await apiClient.get("/campaigns/admin/bin", {
    params: { page: params.page ?? 1, limit: params.limit ?? 20 },
  });
  return {
    ...response.data,
    items: (response.data.items ?? []).map(normalizeCampaign),
  };
}

export async function createCampaign(
  payload: CampaignPayload,
): Promise<Campaign> {
  const response = await apiClient.post("/campaigns", payload);
  return normalizeCampaign(response.data);
}

export async function updateCampaign(
  id: string,
  payload: CampaignPayload,
): Promise<Campaign> {
  const response = await apiClient.patch(`/campaigns/${id}`, payload);
  return normalizeCampaign(response.data);
}

export async function submitCampaign(id: string): Promise<Campaign> {
  const response = await apiClient.post(`/campaigns/${id}/submit`);
  return normalizeCampaign(response.data);
}

export async function approveCampaign(
  id: string,
  note?: string,
): Promise<Campaign> {
  const response = await apiClient.post(`/campaigns/${id}/approve`, {
    note: note?.trim() || undefined,
  });
  return normalizeCampaign(response.data);
}

export async function rejectCampaign(
  id: string,
  reason: string,
): Promise<Campaign> {
  const response = await apiClient.post(`/campaigns/${id}/reject`, { reason });
  return normalizeCampaign(response.data);
}

export async function approvePlanningVerification(
  id: string,
  note?: string,
): Promise<Campaign> {
  const response = await apiClient.post(
    `/campaigns/${id}/verification/approve`,
    {
      note: note?.trim() || undefined,
    },
  );
  return normalizeCampaign(response.data);
}

export async function rejectPlanningVerification(
  id: string,
  reason: string,
): Promise<Campaign> {
  const response = await apiClient.post(
    `/campaigns/${id}/verification/reject`,
    { reason },
  );
  return normalizeCampaign(response.data);
}

export async function transitionCampaignPhase(
  id: string,
  toPhase: CampaignLifecyclePhase,
  reason?: string,
): Promise<Campaign> {
  const response = await apiClient.post(`/campaigns/${id}/phase-transition`, {
    toPhase,
    reason: reason?.trim() || undefined,
  });
  return normalizeCampaign(response.data);
}

export async function updatePlanning(
  id: string,
  payload: {
    transportDecision?: string;
    meetingPoint?: string;
    meetingTime?: string;
    costBreakdown?: {
      transport?: number;
      food?: number;
      guide?: number;
      misc?: number;
    };
  },
): Promise<Campaign> {
  const response = await apiClient.patch(`/campaigns/${id}/planning`, payload);
  return normalizeCampaign(response.data);
}

export async function addCampaignTask(
  id: string,
  payload: { title: string; assignedUserId?: string },
): Promise<Campaign> {
  const response = await apiClient.post(`/campaigns/${id}/tasks`, payload);
  return normalizeCampaign(response.data);
}

export async function updateCampaignTask(
  id: string,
  taskId: string,
  payload: { title?: string; assignedUserId?: string; completed?: boolean },
): Promise<Campaign> {
  const response = await apiClient.patch(
    `/campaigns/${id}/tasks/${taskId}`,
    payload,
  );
  return normalizeCampaign(response.data);
}

export async function updateCampaignParticipantRole(
  id: string,
  participantId: string,
  role: "host" | "co-host" | "member",
): Promise<Campaign> {
  const response = await apiClient.patch(
    `/campaigns/${id}/participants/${participantId}/role`,
    { role },
  );
  return normalizeCampaign(response.data);
}

export async function confirmCampaignParticipation(
  id: string,
): Promise<Campaign> {
  const response = await apiClient.post(`/campaigns/${id}/confirm`);
  return normalizeCampaign(response.data);
}

export async function leaveCampaign(id: string): Promise<Campaign> {
  const response = await apiClient.post(`/campaigns/${id}/leave`);
  return normalizeCampaign(response.data);
}

export async function joinCampaign(id: string): Promise<{
  message: string;
  campaign: Campaign;
}> {
  const response = await apiClient.post(`/campaigns/${id}/join`);
  return {
    message: response.data.message,
    campaign: normalizeCampaign(response.data.campaign),
  };
}

export async function deleteCampaign(
  id: string,
  reason?: string,
): Promise<{ message: string }> {
  const response = await apiClient.delete(`/campaigns/${id}`, {
    params: { ...(reason?.trim() ? { reason: reason.trim() } : {}) },
  });
  return response.data;
}

export async function restoreCampaign(id: string): Promise<Campaign> {
  const response = await apiClient.post(`/campaigns/${id}/restore`);
  return normalizeCampaign(response.data);
}

export async function permanentlyDeleteCampaign(
  id: string,
  reason?: string,
): Promise<{ message: string }> {
  const response = await apiClient.delete(`/campaigns/${id}/permanent`, {
    params: { ...(reason?.trim() ? { reason: reason.trim() } : {}) },
  });
  return response.data;
}
