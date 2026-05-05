import { apiClient } from '@/lib/api';

export type CampaignPayload = {
  title: string;
  description?: string;
  category?: string;
  hikeType: 'solo' | 'group';
  maxParticipants?: number;
  startDate: string;
  photos?: { url: string }[];
};

export type CampaignPhase =
  | 'draft'
  | 'open'
  | 'planning'
  | 'verification'
  | 'ready'
  | 'started'
  | 'completed'
  | 'cancelled';

// 🧠 TIMELINE GENERATOR
export function generateTimeline(startDate: Date) {
  const createdAt = new Date();

  const totalDays =
    Math.floor(
      (startDate.getTime() - createdAt.getTime()) /
        (1000 * 60 * 60 * 24)
    ) - 1;

  const openDays = Math.floor(totalDays * 0.33);
  const planningDays = Math.floor(totalDays * 0.33);
  const verificationDays = totalDays - openDays - planningDays;

  const openEnd = new Date(createdAt);
  openEnd.setDate(openEnd.getDate() + openDays);

  const planningEnd = new Date(openEnd);
  planningEnd.setDate(planningEnd.getDate() + planningDays);

  const verificationEnd = new Date(planningEnd);
  verificationEnd.setDate(
    verificationEnd.getDate() + verificationDays
  );

  const restDay = new Date(startDate);
  restDay.setDate(startDate.getDate() - 1);

  return {
    createdAt,
    openEnd,
    planningEnd,
    verificationEnd,
    restDay,
    startDate,
  };
}

// 🚀 CREATE CAMPAIGN
export async function createCampaign(payload: CampaignPayload) {
  if (!payload.title?.trim()) {
    throw new Error('Title is required');
  }

  if (!payload.startDate) {
    throw new Error('Start date is required');
  }

  const now = new Date();
  const startDate = new Date(payload.startDate);

  if (Number.isNaN(startDate.getTime())) {
    throw new Error('Invalid start date');
  }

  // 🔥 GROUP RULES
  if (payload.hikeType === 'group') {
    const minStart = new Date();
    minStart.setDate(now.getDate() + 8); // ✅ 8 days rule

    if (startDate < minStart) {
      throw new Error('Group campaign must be at least 8 days later');
    }

    if (!payload.maxParticipants || payload.maxParticipants < 2) {
      throw new Error('Minimum 2 participants required');
    }
  }

  // SOLO CLEANUP
  if (payload.hikeType === 'solo') {
    payload.maxParticipants = undefined;
  }

  const timeline = generateTimeline(startDate);

  const response = await apiClient.post('/campaigns', {
    ...payload,
    phase: payload.hikeType === 'group' ? 'open' : 'ready',
    timeline,
    joinMode: 'open',
  });

  return response.data;
}