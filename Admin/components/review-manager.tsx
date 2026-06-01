'use client';

import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { apiClient } from '@/lib/api';

interface Review {
  _id: string;
  reviewerId: { _id: string; name: string };
  revieweeId: { _id: string; name: string };
  tripId: string;
  rating: number;
  comment?: string;
  createdAt: string;
}

interface ReviewStats {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: {
    '5': number;
    '4': number;
    '3': number;
    '2': number;
    '1': number;
  };
}

export default function ReviewManager() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalReviews, setTotalReviews] = useState(0);
  const itemsPerPage = 20;

  useEffect(() => {
    fetchReviews();
    fetchStats();
  }, [page]);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/reviews/admin/all', { params: { page, limit: itemsPerPage } });
      const data = response.data;
      setReviews(data.data || []);
      setTotalReviews(data.total || 0);
    } catch (err) {
      setError('Failed to load reviews');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await apiClient.get('/reviews/admin/stats');
      const data = response.data;
      setStats(data);
    } catch (err) {
      console.error('Failed to load stats', err);
    }
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 4) return 'text-green-600';
    if (rating >= 3) return 'text-yellow-600';
    return 'text-red-600';
  };

  const chartData = stats
    ? [
        { name: '5 stars', count: stats.ratingDistribution['5'] },
        { name: '4 stars', count: stats.ratingDistribution['4'] },
        { name: '3 stars', count: stats.ratingDistribution['3'] },
        { name: '2 stars', count: stats.ratingDistribution['2'] },
        { name: '1 star', count: stats.ratingDistribution['1'] },
      ]
    : [];

  if (error) {
    return <div className="p-4 text-destructive">{error}</div>;
  }

  return (
    <div className="space-y-6 p-6 text-foreground">
      <h1 className="text-3xl font-bold">Review Management</h1>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="text-sm text-muted-foreground">Average Rating</div>
            <div className={`text-3xl font-bold ${getRatingColor(stats.averageRating)}`}>
              {stats.averageRating.toFixed(2)} / 5.0
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="text-sm text-muted-foreground">Total Reviews</div>
            <div className="text-3xl font-bold text-primary">{stats.totalReviews}</div>
          </div>
        </div>
      )}

      {/* Rating Distribution Chart */}
      {stats && (
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Rating Distribution</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Reviews List */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold">From</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">To</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Rating</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Comment</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center">
                  Loading...
                </td>
              </tr>
            ) : reviews.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                  No reviews found
                </td>
              </tr>
            ) : (
              reviews.map((review) => (
                <tr key={review._id} className="hover:bg-accent/40">
                  <td className="px-6 py-4 text-sm">{review.reviewerId?.name || 'Unknown'}</td>
                  <td className="px-6 py-4 text-sm">{review.revieweeId?.name || 'Unknown'}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`font-bold ${getRatingColor(review.rating)}`}>
                      {review.rating}⭐
                    </span>
                  </td>
                  <td className="max-w-xs truncate px-6 py-4 text-sm text-muted-foreground">
                    {review.comment || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {new Date(review.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalReviews > 0 && (
          <div className="flex items-center justify-between border-t border-border px-6 py-4">
            <div className="text-sm text-muted-foreground">
              Page {page} of {Math.ceil(totalReviews / itemsPerPage)} ({totalReviews} total)
            </div>
            <div className="space-x-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="rounded-md bg-muted px-3 py-1 hover:bg-accent disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page * itemsPerPage >= totalReviews}
                className="rounded-md bg-muted px-3 py-1 hover:bg-accent disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
