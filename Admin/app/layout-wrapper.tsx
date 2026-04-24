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

  // Inactivity logout: if admin page is inactive for 5 minutes, sign out
  useEffect(() => {
    if (isLoginPage) return;

    let timeoutId: number | undefined;

    const INACTIVITY_MS = 5 * 60 * 1000; // 5 minutes

    const resetTimeout = () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      timeoutId = window.setTimeout(async () => {
        try {
          // attempt server logout
          await apiClient.post('/auth/logout');
        } catch (_) {}
        logout();
        // force full navigation to login to avoid cached dashboard flashes
        window.location.replace('/login');
      }, INACTIVITY_MS);
    };

    const events = ['mousemove', 'keydown', 'touchstart', 'click'];
    events.forEach((e) => window.addEventListener(e, resetTimeout));

    // start timer
    resetTimeout();

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      events.forEach((e) => window.removeEventListener(e, resetTimeout));
    };
  }, [isLoginPage, logout]);

  // On tab close/unload, attempt to clear server session using sendBeacon so cookies are removed
  useEffect(() => {
    const handleBeforeUnload = () => {
      try {
        const url = `${(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000')}/auth/logout`;
        const blob = new Blob([], { type: 'application/json' });
        // sendBeacon will do a POST; server should accept and clear cookies
        navigator.sendBeacon(url, blob);
      } catch (_) {
        // ignore
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Handle pages restored from Back-Forward Cache (BFCache) and popstate navigation.
  // Some browsers restore the page instantly from cache after navigating back which can show protected UI
  // before client-side auth checks run. Detect BFCache and force a fresh check/navigation.
  useEffect(() => {
    // pageshow handler must be synchronous to match EventListener type; use promises inside
    const handlePageShow = (event: Event) => {
      const p = event as PageTransitionEvent;
      if (p && 'persisted' in p && (p as PageTransitionEvent).persisted) {
        apiClient
          .get('/auth/me')
          .then(() => {
            // session still valid - reload to get fresh state
            window.location.reload();
          })
          .catch(() => {
            logout();
            window.location.replace('/login');
          });
      }
    };

    const handlePopState = () => {
      apiClient
        .get('/auth/me')
        .catch(() => {
          logout();
          window.location.replace('/login');
        });
    };

    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [logout]);

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
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
