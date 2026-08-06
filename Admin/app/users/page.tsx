'use client';

import { useEffect, useState } from 'react';
import { FiEdit, FiTrash2, FiSearch, FiPlus } from 'react-icons/fi';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { ConfirmModal } from '@/components/ui/confirm-modal';

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
  isActive?: boolean;
  deactivatedAt?: string | null;
  profileCompleted: boolean;
  isProfilePublic?: boolean;
  createdAt?: string;
}

export default function UsersPage() {
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive' | 'complete' | 'incomplete'>('all');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<Set<string>>(new Set());
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [pendingDeleteUser, setPendingDeleteUser] = useState<User | null>(null);
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
    return profileCompleted ? 'bg-secondary/15 text-secondary' : 'bg-primary/15 text-primary';
  };

  async function handleDeleteUser(userId: string) {
    setDeleting(prev => new Set([...prev, userId]));
    setDeleteError(null);
    setActionNotice(null);

    try {
      const response = await apiClient.delete(`/user/admin/profiles/${userId}`);
      const action = response.data?.action as 'deactivated' | 'deleted' | undefined;

      if (action === 'deactivated') {
        setActionNotice('User deactivated. Their sessions were revoked and they can no longer sign in.');
        setRefreshKey((current) => current + 1);
      } else if (users.length === 1 && page > 1) {
        setActionNotice('User permanently deleted.');
        setPage((currentPage) => Math.max(1, currentPage - 1));
      } else {
        setActionNotice('User permanently deleted.');
        setRefreshKey((current) => current + 1);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete user';
      setDeleteError(errorMessage);
      console.error('Delete error:', err);
    } finally {
      setPendingDeleteUser(null);
      setDeleting(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  }

  return (
    <div className="p-4 text-foreground sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 sm:mb-8">
        <h1 className="text-2xl font-bold sm:text-3xl">Users Management</h1>
        <button
          type="button"
          onClick={() => setRefreshKey((current) => current + 1)}
          className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/90"
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
        <div className="mb-6 flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <span>Error: {deleteError}</span>
          <button
            type="button"
            onClick={() => setDeleteError(null)}
            className="font-bold text-destructive hover:opacity-80"
          >
            ✕
          </button>
        </div>
      )}

      {actionNotice && (
        <div className="mb-6 flex items-center justify-between rounded-lg border border-secondary/30 bg-secondary/10 p-4 text-sm text-secondary">
          <span>{actionNotice}</span>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="ml-3 font-bold hover:opacity-80"
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      )}

      {loading && (
        <div className="mb-6 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          Loading user profiles from the backend...
        </div>
      )}

      {/* Search and Filter */}
      <div className="mb-6 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-3 text-muted-foreground" size={20} />
              <input
                type="text"
                placeholder="Search by name, phone, or email..."
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-border bg-background py-2 pr-4 pl-10 focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value as typeof filterStatus);
                setPage(1);
              }}
              className="rounded-lg border border-border bg-background px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
            <option value="all">All Profiles</option>
            <option value="active">Active Users</option>
            <option value="inactive">Inactive Users</option>
            <option value="complete">Completed</option>
            <option value="incomplete">Incomplete</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {/* Mobile user cards */}
        <div className="divide-y divide-border xl:hidden">
          {users.map((user) => (
            <article key={user._id} className="flex items-center gap-3 p-3 sm:px-4">
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {[user.firstName, user.lastName].filter(Boolean).join(' ') || 'Unnamed user'}
                  </p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${user.isActive === false ? 'bg-slate-200 text-slate-700' : getStatusBadge(user.profileCompleted)}`}>
                    {user.isActive === false ? 'Inactive' : user.profileCompleted ? 'Complete' : 'Incomplete'}
                  </span>
                </div>
                <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                  {user.location ? (
                    <span className="truncate">{user.location}</span>
                  ) : null}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <Link
                  href={`/users/${user._id}`}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-primary transition-colors hover:bg-primary/10"
                  title="Edit user"
                  aria-label={`Edit ${user.firstName || 'user'}`}
                >
                  <FiEdit size={17} />
                </Link>
                <button
                  type="button"
                  onClick={() => setPendingDeleteUser(user)}
                  disabled={deleting.has(user._id)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={`${user.isActive === false ? 'Permanently delete' : 'Deactivate'} ${user.firstName || 'user'}`}
                  title={deleting.has(user._id) ? 'Processing user' : user.isActive === false ? 'Permanently delete user' : 'Deactivate user'}
                >
                  <FiTrash2 size={17} />
                </button>
              </div>
            </article>
          ))}
        </div>

        {/* Desktop user table */}
        <div className="hidden overflow-x-auto xl:block">
        <table className="w-full min-w-[940px]">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Name</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Location</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Profile</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Created</th>
              <th className="sticky right-0 w-44 bg-muted px-4 py-3 text-right text-sm font-semibold text-foreground shadow-[-1px_0_0_0_var(--border)]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((user) => (
              <tr key={user._id} className="group transition-colors hover:bg-accent/30">
                <td className="px-6 py-4">
                  <div>
                    <p className="font-medium text-foreground">{user.firstName} {user.lastName}</p>
                    <p className="text-xs text-muted-foreground">{user.location || 'No location provided'}</p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <p className="text-sm text-muted-foreground">{user.location || 'N/A'}</p>
                  <p className="text-xs text-muted-foreground">{user.province || ''} {user.district ? `• ${user.district}` : ''}</p>
                </td>
                <td className="px-6 py-4">
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${user.isActive === false ? 'bg-slate-200 text-slate-700' : getStatusBadge(user.profileCompleted)}`}>
                    {user.isActive === false ? 'Inactive' : user.profileCompleted ? 'Completed' : 'Incomplete'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-muted-foreground">{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</td>
                <td className="sticky right-0 w-44 bg-card px-4 py-4 shadow-[-1px_0_0_0_var(--border)] transition-colors group-hover:bg-accent">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/users/${user._id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                      title="View Details"
                    >
                      <FiEdit size={16} />
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => setPendingDeleteUser(user)}
                      disabled={deleting.has(user._id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-2.5 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                      title={deleting.has(user._id) ? 'Processing...' : user.isActive === false ? 'Permanently delete user' : 'Deactivate user'}
                    >
                      <FiTrash2 size={16} />
                      {deleting.has(user._id) ? 'Working' : user.isActive === false ? 'Delete' : 'Deactivate'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Empty State */}
      {users.length === 0 && !loading && (
        <div className="rounded-xl border border-border bg-card py-12 text-center">
          <p className="text-muted-foreground">No users found</p>
        </div>
      )}

      {/* Pagination */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {total === 0 ? 0 : (page - 1) * limit + 1}
          -
          {Math.min(page * limit, total)} of {total} profiles
        </p>
        <div className="flex gap-2 self-end sm:self-auto">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
            className="rounded-lg border border-border px-3 py-2 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <button type="button" className="rounded-lg bg-primary px-3 py-2 text-primary-foreground">
            {page}
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((currentPage) => Math.min(totalPages, currentPage + 1))}
            className="rounded-lg border border-border px-3 py-2 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      <ConfirmModal
        open={Boolean(pendingDeleteUser)}
        title={pendingDeleteUser?.isActive === false ? 'Permanently delete user?' : 'Deactivate user?'}
        description={pendingDeleteUser
          ? pendingDeleteUser.isActive === false
            ? `This is the second deletion step. ${[pendingDeleteUser.firstName, pendingDeleteUser.lastName].filter(Boolean).join(' ') || 'This user'} and their linked authentication account will be permanently deleted. This cannot be undone.`
            : `${[pendingDeleteUser.firstName, pendingDeleteUser.lastName].filter(Boolean).join(' ') || 'This user'} will be marked inactive, signed out, and prevented from signing in. Their data will remain available for later permanent deletion.`
          : ''}
        confirmLabel={pendingDeleteUser?.isActive === false ? 'Delete permanently' : 'Deactivate user'}
        cancelLabel="Keep user"
        intent="danger"
        isProcessing={pendingDeleteUser ? deleting.has(pendingDeleteUser._id) : false}
        onConfirm={() => {
          if (pendingDeleteUser) {
            void handleDeleteUser(pendingDeleteUser._id);
          }
        }}
        onCancel={() => {
          if (!pendingDeleteUser || !deleting.has(pendingDeleteUser._id)) {
            setPendingDeleteUser(null);
          }
        }}
      />
    </div>
  );
}
