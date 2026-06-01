'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { apiClient } from '@/lib/api';

interface MediaUpload {
  _id: string;
  uploaderId: { _id: string; name: string };
  purpose: string;
  cloudinaryThumbnailUrl: string;
  cloudinaryUrl: string;
  status: 'pending' | 'approved' | 'rejected' | 'flagged_ai';
  aiScore: number;
  rejectionReason?: string;
  createdAt: string;
}

interface ModerationStats {
  pending: number;
  flagged: number;
  approved: number;
  rejected: number;
}

export default function MediaModerationManager() {
  const [media, setMedia] = useState<MediaUpload[]>([]);
  const [stats, setStats] = useState<ModerationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [page, setPage] = useState(1);
  const [totalMedia, setTotalMedia] = useState(0);
  const [selectedMedia, setSelectedMedia] = useState<MediaUpload | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const itemsPerPage = 20;

  useEffect(() => {
    fetchMedia();
    fetchStats();
  }, [filterStatus, page]);

  const fetchMedia = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/media/pending', { params: { page, limit: itemsPerPage } });
      const data = response.data;
      setMedia(data.data || []);
      setTotalMedia(data.total || 0);
    } catch (err) {
      setError('Failed to load media');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await apiClient.get('/media/stats');
      const data = response.data;
      if (Array.isArray(data) && data.length > 0) {
        setStats(data[0]);
      }
    } catch (err) {
      console.error('Failed to load stats', err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-primary/15 text-primary';
      case 'approved':
        return 'bg-secondary/20 text-secondary';
      case 'rejected':
        return 'bg-destructive/15 text-destructive';
      case 'flagged_ai':
        return 'bg-tertiary/20 text-tertiary';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const approveMedia = async (mediaId: string) => {
    try {
      await apiClient.patch(`/media/${mediaId}/approve`);
      setSelectedMedia(null);
      fetchMedia();
      fetchStats();
    } catch (err) {
      setError('Failed to approve media');
    }
  };

  const rejectMedia = async (mediaId: string) => {
    try {
      await apiClient.patch(`/media/${mediaId}/reject`, { reason: rejectionReason });
      setSelectedMedia(null);
      setRejectionReason('');
      fetchMedia();
      fetchStats();
    } catch (err) {
      setError('Failed to reject media');
    }
  };

  if (error) {
    return <div className="p-4 text-destructive">{error}</div>;
  }

  return (
    <div className="space-y-6 p-6 text-foreground">
      <h1 className="text-3xl font-bold">Media Moderation</h1>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 shadow-sm">
            <div className="text-xs text-primary">Pending</div>
            <div className="text-2xl font-bold text-primary">{stats.pending}</div>
          </div>
          <div className="rounded-xl border border-tertiary/35 bg-tertiary/10 p-4 shadow-sm">
            <div className="text-xs text-tertiary">Flagged AI</div>
            <div className="text-2xl font-bold text-tertiary">{stats.flagged}</div>
          </div>
          <div className="rounded-xl border border-secondary/35 bg-secondary/15 p-4 shadow-sm">
            <div className="text-xs text-secondary">Approved</div>
            <div className="text-2xl font-bold text-secondary">{stats.approved}</div>
          </div>
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 shadow-sm">
            <div className="text-xs text-destructive">Rejected</div>
            <div className="text-2xl font-bold text-destructive">{stats.rejected}</div>
          </div>
        </div>
      )}

      {/* Media Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-8">Loading...</div>
        ) : media.length === 0 ? (
          <div className="col-span-full py-8 text-center text-muted-foreground">No media to review</div>
        ) : (
          media.map((item) => (
            <div
              key={item._id}
              onClick={() => setSelectedMedia(item)}
              className="cursor-pointer overflow-hidden rounded-xl border border-border bg-card shadow-sm transition hover:shadow-lg"
            >
              <div className="relative aspect-square bg-muted">
                <Image
                  src={item.cloudinaryThumbnailUrl}
                  alt="Media"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="bg-card p-2">
                <div className="truncate text-xs text-muted-foreground">{item.uploaderId?.name}</div>
                <div className="flex items-center justify-between mt-1">
                  <span className={`text-xs px-2 py-1 rounded ${getStatusColor(item.status)}`}>
                    {item.status === 'flagged_ai' ? 'Flagged' : item.status}
                  </span>
                  {item.aiScore > 50 && (
                    <span className="text-xs text-red-600 font-bold">AI: {item.aiScore}</span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalMedia > 0 && (
        <div className="flex items-center justify-between px-6 py-4">
          <div className="text-sm text-muted-foreground">
            Page {page} of {Math.ceil(totalMedia / itemsPerPage)} ({totalMedia} total)
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
              disabled={page * itemsPerPage >= totalMedia}
              className="rounded-md bg-muted px-3 py-1 hover:bg-accent disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Media Detail Modal */}
      {selectedMedia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 backdrop-blur-sm">
          <div className="mx-4 max-h-screen w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-card shadow-xl">
            <div className="relative aspect-video bg-muted">
              <Image
                src={selectedMedia.cloudinaryUrl}
                alt="Media"
                fill
                className="object-contain"
              />
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm text-muted-foreground">Uploader</label>
                <p className="font-semibold">{selectedMedia.uploaderId?.name}</p>
              </div>

              <div>
                <label className="text-sm text-muted-foreground">Purpose</label>
                <p className="font-semibold">{selectedMedia.purpose}</p>
              </div>

              <div>
                <label className="text-sm text-muted-foreground">Status</label>
                <span className={`px-2 py-1 rounded text-sm font-semibold ${getStatusColor(selectedMedia.status)}`}>
                  {selectedMedia.status}
                </span>
              </div>

              {selectedMedia.aiScore > 0 && (
                <div>
                  <label className="text-sm text-muted-foreground">AI Safety Score</label>
                  <div className="flex items-center mt-1">
                    <div className="h-2 flex-1 rounded-full bg-muted">
                      <div
                        className={`h-2 rounded-full ${
                          selectedMedia.aiScore > 70
                            ? 'bg-red-600'
                            : selectedMedia.aiScore > 40
                              ? 'bg-yellow-600'
                              : 'bg-green-600'
                        }`}
                        style={{ width: `${selectedMedia.aiScore}%` }}
                      />
                    </div>
                    <span className="ml-2 font-semibold">{selectedMedia.aiScore}</span>
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm text-muted-foreground">Uploaded</label>
                <p className="text-sm">{new Date(selectedMedia.createdAt).toLocaleString()}</p>
              </div>

              {selectedMedia.rejectionReason && (
                <div>
                  <label className="text-sm text-muted-foreground">Rejection Reason</label>
                  <p className="rounded-md bg-destructive/10 p-2 text-sm">{selectedMedia.rejectionReason}</p>
                </div>
              )}

              {selectedMedia.status === 'pending' || selectedMedia.status === 'flagged_ai' ? (
                <div className="mt-6 space-y-3 border-t border-border pt-4">
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Rejection reason (if rejecting)"
                    className="w-full rounded-md border border-border bg-background p-2 text-sm"
                    rows={2}
                  />

                  <div className="flex space-x-2">
                    <button
                      onClick={() => approveMedia(selectedMedia._id)}
                      className="flex-1 rounded-full bg-secondary py-2 font-semibold text-secondary-foreground hover:bg-secondary/90"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => rejectMedia(selectedMedia._id)}
                      className="flex-1 rounded-full bg-destructive py-2 font-semibold text-destructive-foreground hover:bg-destructive/90"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <button
              onClick={() => setSelectedMedia(null)}
              className="w-full bg-muted py-2 font-semibold hover:bg-accent"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
