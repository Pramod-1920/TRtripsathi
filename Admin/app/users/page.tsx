'use client';

import { useEffect, useState } from 'react';
import { FiEdit, FiTrash2, FiSearch, FiPlus } from 'react-icons/fi';
import Link from 'next/link';
import { apiClient } from '@/lib/api';

interface User {
  _id: string;
  firstName: string;
  middleName?: string | null;
  lastName?: string | null;
  age?: number | null;
  profilePhoto?: string | null;
  bio?: string | null;
  location?: string | null;
  province?: string | null;
  district?: string | null;
  landmark?: string | null;
  experienceLevel?: string | null;
  level?: number;
  xp?: number;
  badge?: string;
  profileCompleted: boolean;
  isProfilePublic?: boolean;
  createdAt?: string;
}

export default function UsersPage() {
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'complete' | 'incomplete'>('all');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<Set<string>>(new Set());
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearchQuery(searchInput.trim());
    }, 300);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [searchInput]);

  useEffect(() => {
    let active = true;

    async function loadUsers() {
      setLoading(true);
      setError('');

      try {
        const response = await apiClient.get('/user/admin/profiles', {
          params: {
            page,
            limit,
            q: searchQuery || undefined,
            status: filterStatus,
          },
        });

        if (active) {
          const items = response.data?.items ?? [];
          const pagination = response.data?.pagination;
          setUsers(items);
          setTotal(Number(pagination?.total ?? items.length));
          setTotalPages(Math.max(1, Number(pagination?.totalPages ?? 1)));
        }
      } catch {
        if (active) {
          setError('Failed to load user profiles from the backend.');
          setUsers([]);
          setTotal(0);
          setTotalPages(1);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadUsers();

    return () => {
      active = false;
    };
  }, [page, limit, searchQuery, filterStatus, refreshKey]);

  const getStatusBadge = (profileCompleted: boolean) => {
    return profileCompleted ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700';
  };

  async function handleDeleteUser(userId: string) {
    const confirmed = window.confirm('Delete this profile and linked auth account?');

    if (!confirmed) {
      return;
    }

    setDeleting(prev => new Set([...prev, userId]));
    setDeleteError(null);

    try {
      await apiClient.delete(`/user/admin/profiles/${userId}`);
      if (users.length === 1 && page > 1) {
        setPage((currentPage) => Math.max(1, currentPage - 1));
      } else {
        setRefreshKey((current) => current + 1);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete user';
      setDeleteError(errorMessage);
      console.error('Delete error:', err);
    } finally {
      setDeleting(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Users Management</h1>
        <button
          type="button"
          onClick={() => setRefreshKey((current) => current + 1)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <FiPlus size={20} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {deleteError && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex justify-between items-center">
          <span>Error: {deleteError}</span>
          <button
            type="button"
            onClick={() => setDeleteError(null)}
            className="text-red-700 hover:text-red-800 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {loading && (
        <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
          Loading user profiles from the backend...
        </div>
      )}

      {/* Search and Filter */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-3 text-slate-400" size={20} />
              <input
                type="text"
                placeholder="Search by name, phone, or email..."
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value as typeof filterStatus);
                setPage(1);
              }}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
            <option value="all">All Profiles</option>
            <option value="complete">Completed</option>
            <option value="incomplete">Incomplete</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Name</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Location</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Experience</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Profile</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Created</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {users.map((user) => (
              <tr key={user._id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <div>
                    <p className="font-medium text-slate-900">{user.firstName} {user.lastName}</p>
                    <p className="text-xs text-slate-500">{user.badge || 'No badge yet'}</p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <p className="text-sm text-slate-600">{user.location || 'N/A'}</p>
                  <p className="text-xs text-slate-400">{user.province || ''} {user.district ? `• ${user.district}` : ''}</p>
                </td>
                <td className="px-6 py-4">
                  <p className="text-sm font-medium text-slate-700">Level {user.level ?? 1}</p>
                  <p className="text-xs text-slate-500">{user.experienceLevel || 'beginner'}</p>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(user.profileCompleted)}`}>
                    {user.profileCompleted ? 'Completed' : 'Incomplete'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/users/${user._id}`}
                      className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                      title="View Details"
                    >
                      <FiEdit size={18} />
                    </Link>
                    <button
                      type="button"
                      onClick={() => void handleDeleteUser(user._id)}
                      disabled={deleting.has(user._id)}
                      className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title={deleting.has(user._id) ? 'Deleting...' : 'Delete User'}
                    >
                      {deleting.has(user._id) ? '⏳' : <FiTrash2 size={18} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Empty State */}
      {users.length === 0 && !loading && (
        <div className="bg-white rounded-lg border border-slate-200 py-12 text-center">
          <p className="text-slate-500">No users found</p>
        </div>
      )}

      {/* Pagination */}
      <div className="mt-6 flex items-center justify-between">
        <p className="text-sm text-slate-600">
          Showing {total === 0 ? 0 : (page - 1) * limit + 1}
          -
          {Math.min(page * limit, total)} of {total} profiles
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
            className="px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <button type="button" className="px-3 py-2 bg-blue-600 text-white rounded-lg">
            {page}
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((currentPage) => Math.min(totalPages, currentPage + 1))}
            className="px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
