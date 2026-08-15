'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { apiClient } from '@/lib/api';
import { FiBell, FiMenu, FiChevronsLeft, FiChevronsRight } from 'react-icons/fi';
import Link from 'next/link';
import { useAdminNotifications } from '@/components/admin-notifications-provider';

type HeaderProps = {
  onMenuClick: () => void;
  sidebarCollapsed: boolean;
};

export function Header({ onMenuClick, sidebarCollapsed }: HeaderProps) {
  const user = useAuthStore((state) => state.user);
  const profilePhoto = useAuthStore((state) => state.user?.profilePhoto);
  const setProfilePhoto = useAuthStore((state) => state.setProfilePhoto);
  const { unreadCount } = useAdminNotifications();

  useEffect(() => {
    let active = true;

    async function loadProfilePhoto() {
      try {
        const response = await apiClient.get('/user/profile');

        if (active) {
          const photo = (response.data as { profilePhoto?: string | null }).profilePhoto ?? null;
          setProfilePhoto(photo);
        }
      } catch {
        if (active) {
          setProfilePhoto(null);
        }
      }
    }

    if (!profilePhoto) {
      void loadProfilePhoto();
    }

    return () => {
      active = false;
    };
  }, [profilePhoto, setProfilePhoto]);

  return (
    <div className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border/60 bg-background/95 px-3 py-3 shadow-sm backdrop-blur-sm sm:px-6 sm:py-4 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card text-foreground transition-colors hover:bg-accent"
          aria-label="Toggle sidebar"
        >
          <FiMenu size={20} className="md:hidden" />
          {sidebarCollapsed ? (
            <FiChevronsRight size={18} className="hidden md:block" />
          ) : (
            <FiChevronsLeft size={18} className="hidden md:block" />
          )}
        </button>
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-foreground sm:text-2xl">Dashboard</h2>
          <p className="hidden text-sm text-muted-foreground sm:block">Welcome back, Admin</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3 sm:gap-4">
        <Link
          href="/notifications"
          aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
          className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card text-foreground transition-colors hover:bg-accent"
        >
          <FiBell size={20} />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground ring-2 ring-background">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : null}
        </Link>
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium text-foreground">{user?.phoneNumber || 'Admin'}</p>
          <p className="text-xs text-muted-foreground">{user?.role || 'admin'}</p>
        </div>
        {profilePhoto ? (
          <img
            src={profilePhoto}
            alt="Admin profile"
            className="h-10 w-10 rounded-full border border-border object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
            A
          </div>
        )}
      </div>
    </div>
  );
}
