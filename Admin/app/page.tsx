'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    let active = true;

    async function redirect() {
      try {
        await apiClient.get('/auth/me');

        if (active) {
          router.replace('/dashboard');
        }
      } catch {
        if (active) {
          router.replace('/login');
        }
      }
    }

    void redirect();

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );
}
