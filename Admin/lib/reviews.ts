import { apiClient } from './api';

export interface ReviewItem {
  _id: string;
  reviewerId: Record<string, unknown> | string;
  revieweeId: Record<string, unknown> | string;
  tripId: Record<string, unknown> | string;
  rating: number;
  comment?: string;
  createdAt: string;
}

export async function fetchAdminReviews(
  page = 1,
  limit = 50,
  opts?: { sort?: string; reviewerId?: string; revieweeId?: string; tripId?: string },
) {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));
  if (opts?.sort) params.set('sort', opts.sort);
  if (opts?.reviewerId) params.set('reviewerId', opts.reviewerId);
  if (opts?.revieweeId) params.set('revieweeId', opts.revieweeId);
  if (opts?.tripId) params.set('tripId', opts.tripId);

  const resp = await apiClient.get(`/reviews/admin/all?${params.toString()}`);
  return resp.data as { data: ReviewItem[]; total: number };
}

export async function submitReview(tripId: string, revieweeId: string, payload: { rating: number; comment?: string }) {
  const resp = await apiClient.post(`/reviews/trips/${tripId}/users/${revieweeId}`, payload);
  return resp.data;
}

export async function deleteReview(reviewId: string) {
  const resp = await apiClient.delete(`/reviews/${reviewId}`);
  return resp.data;
}

export async function updateReview(reviewId: string, payload: { rating?: number; comment?: string }) {
  const resp = await apiClient.patch(`/reviews/${reviewId}`, payload);
  return resp.data;
}

const reviewsApi = { fetchAdminReviews, submitReview, deleteReview, updateReview };
export default reviewsApi;
