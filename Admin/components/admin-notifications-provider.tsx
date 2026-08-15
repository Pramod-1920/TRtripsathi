'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api';

export type AdminNotification = {
  id: string;
  type: 'report' | 'campaign' | 'photo_verification';
  title: string;
  description: string;
  createdAt: string;
  status?: string;
  href: string;
};

type AdminNotificationResponse = {
  items: AdminNotification[];
  unreadCount: number;
  lastReadAt: string;
};

type AdminNotificationContextValue = {
  notifications: AdminNotification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markAllRead: () => Promise<void>;
};

const AdminNotificationContext = createContext<AdminNotificationContextValue | null>(null);

export function AdminNotificationsProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await apiClient.get<AdminNotificationResponse>('/admin/notifications', {
        params: { limit: 50 },
      });
      setNotifications(response.data.items ?? []);
      setUnreadCount(response.data.unreadCount ?? 0);
      setError(null);
    } catch {
      setError('Notifications are temporarily unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    await apiClient.patch('/admin/notifications/read');
    setUnreadCount(0);
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30000);
    const handleFocus = () => void refresh();
    window.addEventListener('focus', handleFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', handleFocus);
    };
  }, [refresh]);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      loading,
      error,
      refresh,
      markAllRead,
    }),
    [notifications, unreadCount, loading, error, refresh, markAllRead],
  );

  return <AdminNotificationContext.Provider value={value}>{children}</AdminNotificationContext.Provider>;
}

export function useAdminNotifications() {
  const context = useContext(AdminNotificationContext);
  if (!context) {
    throw new Error('useAdminNotifications must be used inside AdminNotificationsProvider');
  }
  return context;
}
