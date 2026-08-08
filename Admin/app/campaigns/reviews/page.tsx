"use client";

import { useEffect, useState } from 'react';
import { fetchAdminReviews, ReviewItem, deleteReview, updateReview } from '@/lib/reviews';
import { StatCard } from '@/components/stat-card';

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRating, setEditRating] = useState<number | ''>('');
  const [editComment, setEditComment] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(50);
  const [sort, setSort] = useState<string>('rating:asc');
  const [tripId, setTripId] = useState<string>('');
  const [reviewerId, setReviewerId] = useState<string>('');
  const [revieweeId, setRevieweeId] = useState<string>('');

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const resp = await fetchAdminReviews(page, limit, {
          sort,
          tripId: tripId || undefined,
          reviewerId: reviewerId || undefined,
          revieweeId: revieweeId || undefined,
        });
        if (!mounted) return;
        setReviews(resp.data || []);
        setTotal(resp.total || (resp.data || []).length);
      } catch (err) {
        console.error('fetch reviews error', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [page, limit, sort, tripId, reviewerId, revieweeId]);

  return (
    <div className="p-4 text-foreground sm:p-6 lg:p-8">
      <h2 className="text-2xl font-semibold mb-4">Trip Reviews</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard title="Total Reviews" value={String(total)} />
        <StatCard title="Lowest Rating" value={reviews.length ? String(reviews[0].rating) : '-'} />
        <StatCard title="Highest Rating" value={reviews.length ? String(reviews[reviews.length - 1].rating) : '-'} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
        <label className="text-sm">Sort:</label>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1">
          <option value="rating:asc">Rating (low → high)</option>
          <option value="rating:desc">Rating (high → low)</option>
          <option value="createdAt:desc">Newest first</option>
          <option value="createdAt:asc">Oldest first</option>
        </select>

        <label className="text-sm ml-4">Trip ID:</label>
        <input value={tripId} onChange={(e) => setTripId(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1" />

        <label className="text-sm ml-4">Reviewer ID:</label>
        <input value={reviewerId} onChange={(e) => setReviewerId(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1" />

        <label className="text-sm ml-4">Reviewee ID:</label>
        <input value={revieweeId} onChange={(e) => setRevieweeId(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1" />

        <button
          type="button"
          onClick={() => setPage(1)}
          className="ml-4 rounded-full bg-primary px-3 py-1 text-primary-foreground hover:bg-primary/90"
        >
          Apply
        </button>
      </div>

      <div className="overflow-x-auto overscroll-x-contain rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="p-3 text-left">Rating</th>
              <th className="p-3 text-left">Comment</th>
              <th className="p-3 text-left">Reviewer</th>
              <th className="p-3 text-left">Reviewee</th>
              <th className="p-3 text-left">Trip</th>
              <th className="p-3 text-left">Created</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="p-4">Loading...</td></tr>
            ) : reviews.length === 0 ? (
              <tr><td colSpan={6} className="p-4">No reviews found</td></tr>
                ) : (
                  reviews.map((r) => (
                    <tr key={r._id} className="border-t border-border hover:bg-accent/30">
                      <td className="p-3 align-top">
                        {editingId === r._id ? (
                          <input type="number" min={1} max={5} value={editRating ?? ''} onChange={(e) => setEditRating(Number(e.target.value) || '')} className="w-16 rounded border border-border px-1" />
                        ) : (
                          r.rating
                        )}
                      </td>
                      <td className="p-3 align-top max-w-xl">
                        {editingId === r._id ? (
                          <input value={editComment} onChange={(e) => setEditComment(e.target.value)} className="w-full rounded border border-border px-1 py-1" />
                        ) : (
                          <div className="truncate">{r.comment ?? '-'}</div>
                        )}
                      </td>
                      <td className="p-3 align-top">{typeof r.reviewerId === 'string' ? r.reviewerId : `${r.reviewerId.firstName ?? ''} ${r.reviewerId.lastName ?? ''}`}</td>
                      <td className="p-3 align-top">{typeof r.revieweeId === 'string' ? r.revieweeId : `${r.revieweeId.firstName ?? ''} ${r.revieweeId.lastName ?? ''}`}</td>
                      <td className="p-3 align-top">{typeof r.tripId === 'string' ? r.tripId : String(r.tripId.title ?? r.tripId.tripCode ?? '-')}</td>
                      <td className="p-3 align-top">{new Date(r.createdAt).toLocaleString()}</td>
                      <td className="p-3 align-top">
                        {editingId === r._id ? (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={async () => {
                                // save
                                try {
                                  setLoading(true);
                                  await updateReview(r._id, { rating: Number(editRating), comment: editComment });
                                  setEditingId(null);
                                  setEditRating('');
                                  setEditComment('');
                                  setPage(1); // refresh
                                } catch (err) {
                                  console.error(err);
                                } finally {
                                  setLoading(false);
                                }
                              }}
                              className="rounded-full bg-secondary px-2 py-1 text-secondary-foreground hover:bg-secondary/90"
                            >
                              Save
                            </button>
                            <button type="button" onClick={() => setEditingId(null)} className="rounded-md border border-border px-2 py-1 hover:bg-accent">Cancel</button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button type="button" onClick={() => { setEditingId(r._id); setEditRating(r.rating); setEditComment(r.comment ?? ''); }} className="rounded-md border border-border px-2 py-1 hover:bg-accent">Edit</button>
                            <button type="button" onClick={async () => { if (!confirm('Delete this review?')) return; try { setLoading(true); await deleteReview(r._id); setPage(1); } catch (err) { console.error(err); } finally { setLoading(false); } }} className="rounded-full bg-destructive px-2 py-1 text-destructive-foreground hover:bg-destructive/90">Delete</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="rounded-md border border-border px-3 py-1 hover:bg-accent"
          disabled={page === 1}
        >
          Prev
        </button>

        <span>Page {page}</span>

        <button
          type="button"
          onClick={() => setPage((p) => p + 1)}
          className="rounded-md border border-border px-3 py-1 hover:bg-accent"
          disabled={reviews.length < limit}
        >
          Next
        </button>
      </div>
    </div>
  );
}
