'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { apiClient } from '@/lib/api';
import { FiMenu, FiChevronsLeft, FiChevronsRight } from 'react-icons/fi';

type HeaderProps = {
  onMenuClick: () => void;
  sidebarCollapsed: boolean;
};

export function Header({ onMenuClick, sidebarCollapsed }: HeaderProps) {
  const user = useAuthStore((state) => state.user);
  const profilePhoto = useAuthStore((state) => state.user?.profilePhoto);
  const setProfilePhoto = useAuthStore((state) => state.setProfilePhoto);

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
    <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-900 transition-colors hover:bg-slate-100"
          aria-label="Toggle sidebar"
        >
          <FiMenu size={20} className="md:hidden" />
          {sidebarCollapsed ? (
            <FiChevronsRight size={18} className="hidden md:block" />
          ) : (
            <FiChevronsLeft size={18} className="hidden md:block" />
          )}
        </button>
        <div>
          <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">Dashboard</h2>
          <p className="text-sm text-slate-500">Welcome back, Admin</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-medium text-slate-900">{user?.phoneNumber || 'Admin'}</p>
          <p className="text-xs text-slate-500">{user?.role || 'admin'}</p>
        </div>
        {profilePhoto ? (
          <img
            src={profilePhoto}
            alt="Admin profile"
            className="h-10 w-10 rounded-full border border-slate-200 object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
            A
          </div>
        )}
      </div>
    </div>
  );
}
