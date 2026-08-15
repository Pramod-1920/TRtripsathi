'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { FiBell, FiCamera, FiChevronRight, FiFlag, FiMapPin, FiRefreshCw } from 'react-icons/fi';
import { AdminNotification, useAdminNotifications } from '@/components/admin-notifications-provider';

type NotificationFilter = 'all' | AdminNotification['type'];

const filters: Array<{ value: NotificationFilter; label: string }> = [
  { value: 'all', label: 'All activity' },
  { value: 'report', label: 'Reports' },
  { value: 'campaign', label: 'Campaigns' },
  { value: 'photo_verification', label: 'Photo requests' },
];

function notificationIcon(type: AdminNotification['type']) {
  if (type === 'report') return FiFlag;
  if (type === 'campaign') return FiMapPin;
  return FiCamera;
}

function relativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  const seconds = Math.max(1, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString();
}

export default function NotificationsPage() {
  const { notifications, loading, error, refresh, markAllRead } = useAdminNotifications();
  const [filter, setFilter] = useState<NotificationFilter>('all');

  useEffect(() => {
    void markAllRead().catch(() => undefined);
  }, [markAllRead]);

  const visibleNotifications = useMemo(
    () => (filter === 'all' ? notifications : notifications.filter((item) => item.type === filter)),
    [filter, notifications],
  );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-4 border-b border-border bg-gradient-to-r from-primary/10 via-card to-secondary/10 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <FiBell size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Notifications</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Reports, campaign creation and verification work that needs attention.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-semibold transition-colors hover:bg-accent disabled:opacity-60"
          >
            <FiRefreshCw className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto border-b border-border px-4 py-3 sm:px-6">
          {filters.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                filter === item.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="divide-y divide-border">
          {error ? (
            <div className="p-8 text-center text-sm text-destructive">{error}</div>
          ) : loading && notifications.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">Loading notifications...</div>
          ) : visibleNotifications.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-14 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <FiBell size={24} />
              </div>
              <h2 className="mt-4 font-semibold">Nothing new here</h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                New traveler activity will appear here automatically.
              </p>
            </div>
          ) : (
            visibleNotifications.map((notification) => {
              const Icon = notificationIcon(notification.type);
              return (
                <Link
                  key={notification.id}
                  href={notification.href}
                  className="group flex items-start gap-4 px-4 py-5 transition-colors hover:bg-accent/50 sm:px-6"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon size={19} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <h2 className="font-semibold text-foreground">{notification.title}</h2>
                      {notification.status ? (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold capitalize text-muted-foreground">
                          {notification.status.replaceAll('_', ' ')}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{notification.description}</p>
                    <p className="mt-2 text-xs font-medium text-muted-foreground">
                      {relativeTime(notification.createdAt)}
                    </p>
                  </div>
                  <FiChevronRight className="mt-3 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
