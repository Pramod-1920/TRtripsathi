'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

export default function LayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === '/login';
  const isLoading = useAuthStore((state) => state.isLoading);
  const setLoading = useAuthStore((state) => state.setLoading);
  const setSession = useAuthStore((state) => state.setSession);
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    if (isLoginPage) {
      setLoading(false);
      return;
    }

    let mounted = true;

    async function loadSession() {
      setLoading(true);

      try {
        const response = await apiClient.get('/auth/me');
        const user = response.data as {
          id: string;
          phoneNumber: string;
          role: 'admin' | 'user';
        };

        if (!mounted) {
          return;
        }

        if (user.role !== 'admin') {
          logout();
          router.replace('/login?reason=admin-only');
          return;
        }

        setSession(user);
      } catch {
        if (!mounted) {
          return;
        }

        logout();
        router.replace('/login');
      }
    }

    void loadSession();

    return () => {
      mounted = false;
    };
  }, [isLoginPage, logout, router, setLoading, setSession]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-blue-500" />
          <p className="text-sm text-slate-400">Checking admin session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
