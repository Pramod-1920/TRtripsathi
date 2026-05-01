'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';

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
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/media/pending?page=${page}&limit=${itemsPerPage}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
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
      const token = localStorage.getItem('access_token');
      const response = await fetch('/api/media/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
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
        return 'bg-blue-100 text-blue-800';
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'flagged_ai':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const approveMedia = async (mediaId: string) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/media/${mediaId}/approve`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setSelectedMedia(null);
        fetchMedia();
        fetchStats();
      }
    } catch (err) {
      setError('Failed to approve media');
    }
  };

  const rejectMedia = async (mediaId: string) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/media/${mediaId}/reject`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: rejectionReason }),
      });

      if (response.ok) {
        setSelectedMedia(null);
        setRejectionReason('');
        fetchMedia();
        fetchStats();
      }
    } catch (err) {
      setError('Failed to reject media');
    }
  };

  if (error) {
    return <div className="text-red-600 p-4">{error}</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold">Media Moderation</h1>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg shadow">
            <div className="text-xs text-blue-600">Pending</div>
            <div className="text-2xl font-bold text-blue-600">{stats.pending}</div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg shadow">
            <div className="text-xs text-yellow-600">Flagged AI</div>
            <div className="text-2xl font-bold text-yellow-600">{stats.flagged}</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg shadow">
            <div className="text-xs text-green-600">Approved</div>
            <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
          </div>
          <div className="bg-red-50 p-4 rounded-lg shadow">
            <div className="text-xs text-red-600">Rejected</div>
            <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
          </div>
        </div>
      )}

      {/* Media Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-8">Loading...</div>
        ) : media.length === 0 ? (
          <div className="col-span-full text-center py-8 text-gray-500">No media to review</div>
        ) : (
          media.map((item) => (
            <div
              key={item._id}
              onClick={() => setSelectedMedia(item)}
              className="cursor-pointer rounded-lg overflow-hidden shadow hover:shadow-lg transition-shadow"
            >
              <div className="relative aspect-square bg-gray-200">
                <Image
                  src={item.cloudinaryThumbnailUrl}
                  alt="Media"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="p-2 bg-white">
                <div className="text-xs text-gray-600 truncate">{item.uploaderId?.name}</div>
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
          <div className="text-sm text-gray-600">
            Page {page} of {Math.ceil(totalMedia / itemsPerPage)} ({totalMedia} total)
          </div>
          <div className="space-x-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page * itemsPerPage >= totalMedia}
              className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Media Detail Modal */}
      {selectedMedia && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-screen overflow-y-auto">
            <div className="relative aspect-video bg-gray-200">
              <Image
                src={selectedMedia.cloudinaryUrl}
                alt="Media"
                fill
                className="object-contain"
              />
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm text-gray-600">Uploader</label>
                <p className="font-semibold">{selectedMedia.uploaderId?.name}</p>
              </div>

              <div>
                <label className="text-sm text-gray-600">Purpose</label>
                <p className="font-semibold">{selectedMedia.purpose}</p>
              </div>

              <div>
                <label className="text-sm text-gray-600">Status</label>
                <span className={`px-2 py-1 rounded text-sm font-semibold ${getStatusColor(selectedMedia.status)}`}>
                  {selectedMedia.status}
                </span>
              </div>

              {selectedMedia.aiScore > 0 && (
                <div>
                  <label className="text-sm text-gray-600">AI Safety Score</label>
                  <div className="flex items-center mt-1">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
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
                <label className="text-sm text-gray-600">Uploaded</label>
                <p className="text-sm">{new Date(selectedMedia.createdAt).toLocaleString()}</p>
              </div>

              {selectedMedia.rejectionReason && (
                <div>
                  <label className="text-sm text-gray-600">Rejection Reason</label>
                  <p className="bg-red-50 p-2 rounded text-sm">{selectedMedia.rejectionReason}</p>
                </div>
              )}

              {selectedMedia.status === 'pending' || selectedMedia.status === 'flagged_ai' ? (
                <div className="space-y-3 mt-6 pt-4 border-t">
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Rejection reason (if rejecting)"
                    className="w-full border rounded p-2 text-sm"
                    rows={2}
                  />

                  <div className="flex space-x-2">
                    <button
                      onClick={() => approveMedia(selectedMedia._id)}
                      className="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700 font-semibold"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => rejectMedia(selectedMedia._id)}
                      className="flex-1 bg-red-600 text-white py-2 rounded hover:bg-red-700 font-semibold"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <button
              onClick={() => setSelectedMedia(null)}
              className="w-full bg-gray-200 py-2 hover:bg-gray-300 font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
