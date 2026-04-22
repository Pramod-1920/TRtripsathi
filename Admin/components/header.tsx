'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { apiClient } from '@/lib/api';

export function Header() {
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
    <div className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Dashboard</h2>
        <p className="text-sm text-slate-500">Welcome back, Admin</p>
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
